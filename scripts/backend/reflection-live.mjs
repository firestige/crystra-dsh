// Explicit opt-in model run. Credentials stay in DSH's credential service.
import {Context} from '@deepseek-ai/cordis';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import * as backend from '../../src/backend/index.js';
import * as piAiLifecycle from '../../src/backend/dsh-pi-ai-lifecycle.js';
const root=resolve(import.meta.dirname,'../..');
const output=resolve(root,process.env.CRYSTRA_REFLECTION_OUTPUT??'artifacts/backend-rebuild/reflection-live');
await mkdir(output,{recursive:true});
const ctx=new Context();
const load=async(n,c={})=>{const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,c);};
try {
  for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);
  await load('dsh-credentials-local',{path:process.env.CRYSTRA_CREDENTIALS_PATH,watch:false});
  await load('dsh-llm-pi-ai',{providers:{'openai-codex':{retryPolicy:{mode:'normal',maxRetries:1}}}});
  await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});
  await load('dsh-tools',{mode:'native'});
  await load('dsh-session-persistence-jsonl',{root:resolve(output,'sessions'),compression:'none'});
  await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
  await ctx.plugin(piAiLifecycle);
  await ctx.plugin(backend,{resolveConsensus:async()=>{throw Error('Not part of reflection');},reflection:{agentOptions:{provider:'openai-codex',model:process.env.CRYSTRA_REFLECTION_MODEL??'gpt-6-astra',reasoningEffort:'high',maxTokens:8192},timeoutMs:300000}});
  const result=await ctx.crystraReflection.run({root,files:['src/backend/barrier.js','src/backend/value.js','test/backend/barrier.test.mjs','scripts/backend/reflection-benchmark.mjs'],goal:'Independently investigate current core commitment verification correctness, robustness and performance. Its inputs are compiled commitments and DSH native events, not arbitrary untrusted JSON. Assess documented rules in the tests, potential missed cases, and scaling with long histories. Run both supplied experiments. Provide concrete findings, conditions, fixes and next regression or comparison design; do not claim an optimization was implemented. Findings with no experimental reproduction must be identified as hypotheses. Do not modify source or commitments.',experiments:[{id:'regression',command:process.execPath,args:['--test','test/backend/barrier.test.mjs']},{id:'history-scaling',command:process.execPath,args:['scripts/backend/reflection-benchmark.mjs']}]});
  await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({id:result.id,status:result.status,model:result.model,experiments:result.experiments.map(e=>({id:e.id,experiment:e.experiment,exitCode:e.exitCode})),summary:result.report?.summary,error:result.error}));
  if(result.status!=='completed')process.exitCode=1;
}finally{await ctx.fiber.dispose();}
