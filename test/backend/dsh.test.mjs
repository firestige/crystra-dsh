import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { Context } from '@deepseek-ai/cordis';
import { LlmAdapter, createUserMessage } from '@deepseek-ai/dsh-llm';
import * as backend from '../../src/backend/index.js';
import { digest } from '../../src/backend/value.js';
const exec=promisify(execFile);
const data={body:'Keep backend local; run the public test.'};
const ref={id:'c1',published_version:1,publication_event_id:'p1',actor:'user:owner',data_hash:digest(data)};
const manifest={scope:'backend',references:[ref]};
async function host(root) {
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
test('native DSH barrier intercepts early finish, resumes persisted facts, and does not repeat completed work',{timeout:15000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-loop-'));
  let ctx=await host(join(dir,'records')),handle,attachment;
  let calls=0, testRuns=0;
  const verdicts=[];
  class Fixture extends LlmAdapter {
    async *stream(options) {
      calls++;
      assert.match(JSON.stringify(options),/Keep backend local/);
      const system=options.messages.find(message=>message.role==='system');
      assert.match(JSON.stringify(system),/Current commitment state/);
      const action={id:'test',kind:'result-equals',tool:'run_public_test',match:{suite:'public'},path:['exitCode'],equals:0};
      let block;
      if(calls===1)block={type:'tool-call',id:'declare',name:'crystra_declare_step',arguments:JSON.stringify({label:'Execute and pass public test',actions:[action]})};
      else if(calls===2)block={type:'text',text:'I claim the test passed without running it.'};
      else if(calls===3) {
        const state=(await attachment.ready).snapshot();verdicts.push(state.lastCheck.decision);
        block={type:'tool-call',id:'test-run',name:'run_public_test',arguments:JSON.stringify({suite:'public'})};
      } else block={type:'text',text:'Test executed; finished.'};
      yield {type:'block-start',index:0,blockType:block.type};
      yield {type:'block-end',index:0,block};
      yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};
    }
  }
  try {
    await writeFile(join(dir,'public.test.mjs'),"import test from 'node:test'; import assert from 'node:assert/strict'; test('known result',()=>assert.equal(2+2,4));\n");
    ctx.llm.registerAdapter(['fixture'],new Fixture());
    handle=await ctx.agents.create({sessionId:'worker',agentOptions:{provider:'fixture',model:'offline'},setup:(ac,agent)=>{
      attachment=ctx.crystraBackend.attach(ac,agent,manifest);
      ac.tools.register({name:'run_public_test',description:'Run public tests',parameters:{type:'object',properties:{suite:{type:'string'}},required:['suite'],additionalProperties:false},output:{schema:{type:'object',properties:{exitCode:{type:'integer'}},required:['exitCode']},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},execute:async()=>{testRuns++;await exec(process.execPath,['--test','public.test.mjs'],{cwd:dir});return {exitCode:0};}});
    }});
    await attachment.ready;
    handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Run the fixture task.'}]}));
    const deadline=Date.now()+8000;
    while(handle.agent.status!=='idle'){if(Date.now()>deadline)throw Error('Fixture did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
    await ctx.sessions.flush(handle.agent.session);
    const events=handle.agent.session.snapshotEvents();
    assert.deepEqual(verdicts,['NO_GO'], JSON.stringify(events.findLast(e=>e.type==='turn/end')));
    assert.equal(testRuns,1);
    assert.equal(events.findLast(e=>e.type==='turn/end').data.reason.kind,'completed');
    assert.equal((await attachment.ready).snapshot().history.length,1);
    assert.equal(events.filter(e=>e.type==='tool/call'&&e.data.name==='run_public_test').length,1);
    await handle.dispose();handle=null;await attachment.close();await ctx.fiber.dispose();
    ctx=await host(join(dir,'records'));
    class Resume extends LlmAdapter {async *stream(){const block={type:'text',text:'Continue from persisted completed work.'};yield {type:'block-start',index:0,blockType:'text'};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:'stop'}};}}
    ctx.llm.registerAdapter(['fixture'],new Resume());
    handle=await ctx.agents.resume({resumeSessionId:'worker',agentOptions:{provider:'fixture',model:'offline'},setup:(ac,agent)=>{attachment=ctx.crystraBackend.attach(ac,agent);}});
    const restored=await attachment.ready;
    assert.equal(restored.snapshot().history[0].verification.decision,'GO');
    assert.equal(await restored.finish(),'GO');
    handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Resume the completed fixture without repeating it.'}]}));
    const resumeDeadline=Date.now()+5000;
    while(handle.agent.status!=='idle'){if(Date.now()>resumeDeadline)throw Error('Resume did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
    const resumedEvents=handle.agent.session.snapshotEvents();
    assert.equal(resumedEvents.findLast(e=>e.type==='turn/end').data.reason.kind,'completed');
    assert.equal(resumedEvents.filter(e=>e.type==='tool/call'&&e.data.name==='run_public_test').length,1);
    assert.equal(testRuns,1);
    assert.match(await readFile(join(dir,'public.test.mjs'),'utf8'),/known result/);
  } finally {
    await handle?.dispose();await attachment?.close();await ctx.fiber.dispose();await rm(dir,{recursive:true,force:true});
  }
});
