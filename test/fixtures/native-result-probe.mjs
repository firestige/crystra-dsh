import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

// Real DSH renderer and session producer, deterministic model boundary.
export async function captureNativeResults(specs) {
  const root=await mkdtemp(join(tmpdir(),'crystra-native-results-')),ctx=new Context();let handle;
  const load=async(n,c={})=>{const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,c);};
  class Calls extends LlmAdapter {
    index=0;
    async *stream(){const spec=specs[this.index++];const block=spec?{type:'tool-call',id:spec.callId,name:spec.tool,arguments:JSON.stringify(spec.args??{suite:'public'})}:{type:'text',text:'Done'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:spec?'tool-calls':'stop'}};}
  }
  try {
    for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);
    await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});await load('dsh-session-persistence-jsonl',{root,compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
    ctx.llm.registerAdapter(['native-fixture'],new Calls());
    handle=await ctx.agents.create({sessionId:'native-results',agentOptions:{provider:'native-fixture',model:'offline'},setup:(ac)=>{
      for(const tool of new Set(specs.map(s=>s.tool)))ac.tools.register({name:tool,description:'Render a known native result',parameters:{type:'object'},output:{schema:{type:'object'},render:(args,value)=>{const spec=specs.find(s=>s.tool===tool&&JSON.stringify(s.args??{suite:'public'})===JSON.stringify(args));return spec.content??[{type:'text',text:JSON.stringify(value)}];}},execute:args=>specs.find(s=>s.tool===tool&&JSON.stringify(s.args??{suite:'public'})===JSON.stringify(args)).value??{exitCode:0}});
    }});
    handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Execute the native result fixtures.'}]}));await handle.agent.whenIdle();await ctx.sessions.flush(handle.agent.session);
    return {events:handle.agent.session.snapshotEvents(),sessionId:handle.agent.session.id,seq:handle.agent.session.seq-1};
  }finally{await handle?.dispose();await ctx.fiber.dispose();await rm(root,{recursive:true,force:true});}
}
