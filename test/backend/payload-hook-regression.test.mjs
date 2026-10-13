import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Context } from '@deepseek-ai/cordis';
import { LlmAdapter, createUserMessage } from '@deepseek-ai/dsh-llm';
import * as backend from '../../src/backend/index.js';
import { digest } from '../../src/backend/value.js';
const data={body:'Require observable successful probe evidence.'};
const ref={id:'payload',published_version:1,publication_event_id:'publication',actor:'user:test',data_hash:digest(data)};
async function host(root){
  const ctx=new Context();
  const load=async(name,config={})=>{const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,config);};
  for(const name of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(name);
  await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});
  await load('dsh-tools',{mode:'native'});
  await load('dsh-session-persistence-jsonl',{root,compression:'none'});
  await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
  await ctx.plugin(backend,{resolveConsensus:async()=>({reference:ref,data,effective:true})});
  return ctx;
}
const message=text=>createUserMessage({source:{kind:'human'},content:[{type:'text',text}]});
async function idle(agent){
  const deadline=Date.now()+8000;
  while(agent.status!=='idle'){if(Date.now()>deadline)throw Error('Native loop did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
}
test('native turn-stopping rejects overflowing result, allows fresh evidence, and restores closed responsibility',{timeout:20000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'crystra-payload-hook-'));
  let ctx,handle,attachment,calls=0,runs=0;
  const observed=[];
  class Fixture extends LlmAdapter{
    async *stream(options){
      const index=++calls;
      let block;
      if(index===1)block={type:'tool-call',id:'declare',name:'crystra_declare_step',arguments:JSON.stringify({label:'Probe produces x zero',actions:[{id:'probe',kind:'result-equals',tool:'probe',match:{suite:'public'},path:['x'],equals:0}]})};
      else if(index===2)block={type:'tool-call',id:'bad',name:'probe',arguments:'{"suite":"public","normal":false}'};
      else if(index===3)block={type:'text',text:'The probe is complete.'};
      else if(index===4){
        observed.push({decision:(await attachment.ready).snapshot().lastCheck.decision,messages:JSON.stringify(options.messages)});
        block={type:'tool-call',id:'good',name:'probe',arguments:'{"suite":"public","normal":true}'};
      }else if(index===5)block={type:'text',text:'Fresh probe evidence is complete.'};
      else throw Error('Unexpected repeated feedback after fresh evidence');
      yield {type:'block-start',index:0,blockType:block.type};
      yield {type:'block-end',index:0,block};
      yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};
    }
  }
  try{
    ctx=await host(root);ctx.llm.registerAdapter(['fixture'],new Fixture());
    handle=await ctx.agents.create({sessionId:'worker',agentOptions:{provider:'fixture',model:'offline'},setup:(ac,agent)=>{
      attachment=ctx.crystraBackend.attach(ac,agent,{scope:'payload-hook',references:[ref]});
      ac.tools.register({name:'probe',description:'Native payload probe',parameters:{type:'object'},output:{schema:{type:'object'},render:args=>[{type:'text',text:args.normal?'{"x":0}':'{"x":1e400}'}]},execute:()=>{runs++;return {x:0};}});
    }});
    await attachment.ready;handle.agent.followup(message('Execute the declared probe.'));await idle(handle.agent);await ctx.sessions.flush(handle.agent.session);
    const events=handle.agent.session.snapshotEvents();
    assert.equal(events.findLast(e=>e.type==='turn/end').data.reason.kind,'completed','turn-stopping must not throw on malformed comparison evidence');
    assert.equal(calls,5,'NO_GO must cause a repair iteration, then stop after actual good evidence');
    assert.equal(runs,2);assert.equal(observed[0].decision,'NO_GO');assert.match(observed[0].messages,/NO_GO/);
    const state=(await attachment.ready).snapshot();assert.equal(state.active,null);assert.equal(state.pending.length,0);assert.equal(state.history.length,1);assert.equal(state.history[0].verification.decision,'GO');
    const bad=events.find(e=>e.type==='tool/call'&&e.data.callId==='bad');
    const good=events.find(e=>e.type==='tool/call'&&e.data.callId==='good');
    assert.ok(bad&&good);assert.equal(state.history[0].verification.matches[0].callSeq,good.seq,'closed responsibility must use fresh execution, never overflow payload');
    await handle.dispose();handle=null;await attachment.close();attachment=null;await ctx.fiber.dispose();ctx=null;
    ctx=await host(root);
    class Resume extends LlmAdapter{async *stream(){yield {type:'block-start',index:0,blockType:'text'};yield {type:'block-end',index:0,block:{type:'text',text:'Already complete.'}};yield {type:'finish',reason:{kind:'stop'}};}}
    ctx.llm.registerAdapter(['fixture'],new Resume());
    handle=await ctx.agents.resume({resumeSessionId:'worker',agentOptions:{provider:'fixture',model:'offline'},setup:(ac,agent)=>{attachment=ctx.crystraBackend.attach(ac,agent);}});
    const restored=await attachment.ready;assert.equal(restored.snapshot().history.length,1);assert.equal(restored.snapshot().active,null);assert.equal(await restored.finish(),'GO');
    handle.agent.followup(message('Resume without repeating completed work.'));await idle(handle.agent);
    assert.equal(handle.agent.session.snapshotEvents().findLast(e=>e.type==='turn/end').data.reason.kind,'completed');
    assert.equal(handle.agent.session.snapshotEvents().filter(e=>e.type==='tool/call'&&e.data.name==='probe').length,2);
  }finally{await handle?.dispose();await attachment?.close();await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
});
