// Local Codex-protocol transport; no account credentials or remote model calls.
import {Context} from '@deepseek-ai/cordis';
import {join} from 'node:path';
import * as backend from '../../src/backend/index.js';
const [root,baseURL,cleanup]=process.argv.slice(2);
const ctx=new Context();
const load=async(n,c={})=>{const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,c);};
const token=`fixture.${Buffer.from(JSON.stringify({'https://api.openai.com/auth':{chatgpt_account_id:'local-fixture'}})).toString('base64')}.fixture`;
try {
  for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);
  await load('dsh-credentials-local',{path:join(root,'credentials.json'),watch:false});
  await ctx.credentials.set('CRYSTRA_LOCAL_EXIT_KEY',token);
  await load('dsh-llm-pi-ai',{providers:{'openai-codex':{apiKeyEnv:'CRYSTRA_LOCAL_EXIT_KEY',baseURL,retryPolicy:{mode:'normal',maxRetries:0}}}});
  await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});
  await load('dsh-tools',{mode:'native'});
  await load('dsh-session-persistence-jsonl',{root:join(root,'sessions'),compression:'none'});
  await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
  if(['plugin','isolation','failed','timeout'].includes(cleanup)) {
    const lifecycle=await import('../../src/backend/dsh-pi-ai-lifecycle.js');
    await ctx.plugin(lifecycle);
  }
  if(cleanup==='explicit') {
    const {closeOpenAICodexWebSocketSessions}=await import('@earendil-works/pi-ai/api/openai-codex-responses');
    ctx.on('agent/disposed',({agent})=>closeOpenAICodexWebSocketSessions(String(agent.session.id)));
  }
  await ctx.plugin(backend,{resolveConsensus:async()=>{throw Error('No consensus in reflection');},reflection:{agentOptions:{provider:'openai-codex',model:'gpt-6-astra'},timeoutMs:cleanup==='timeout'?1000:5000}});
  let other;
  if(cleanup==='isolation') {
    const {createUserMessage}=await import('@deepseek-ai/dsh-llm');
    other=await ctx.agents.create({sessionId:'other-active-session',agentOptions:{provider:'openai-codex',model:'gpt-6-astra'},setup:ac=>{ac.tools.restrict({allow:[]});}});
    other.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Keep this session available for a second request.'}]}));
    await other.agent.whenIdle();
  }
  const result=await ctx.crystraReflection.run({root,files:['core.mjs'],goal:'Read the fixture and submit three-axis source-based hypotheses.',experiments:[]});
  process.stdout.write(JSON.stringify({checkpoint:'report',status:result.status,id:result.id,error:result.error,reads:result.reads,end:result.events.findLast(e=>e.type==='turn/end')?.data.reason})+'\n');
  if(result.status!=='completed')process.exitCode=1;
  if(other) {
    const {createUserMessage}=await import('@deepseek-ai/dsh-llm');
    other.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Continue after the reflection session was disposed.'}]}));
    await other.agent.whenIdle();
    const turns=other.agent.session.snapshotEvents().filter(e=>e.type==='turn/end');
    process.stdout.write(JSON.stringify({checkpoint:'other-session',turns:turns.map(e=>e.data.reason.kind)})+'\n');
    if(turns.length!==2||turns.some(e=>e.data.reason.kind!=='completed'))process.exitCode=1;
    await ctx.sessions.flush(other.agent.session);
    await other.dispose();
  }
} finally {
  await ctx.fiber.dispose();
  process.stdout.write(JSON.stringify({checkpoint:'disposed',resources:process.getActiveResourcesInfo()})+'\n');
}
