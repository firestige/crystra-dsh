// Explicit opt-in credentialed acceptance; no fixture adapter or provider is registered.
import {Context} from '@deepseek-ai/cordis';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import * as backend from 'dsh-crystra';
import * as lifecycle from 'dsh-crystra/pi-ai-lifecycle';
import {fixture,publish,content,principals} from '../../test/integration/squidex-fixture.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const exec=promisify(execFile),repo=resolve(import.meta.dirname,'../..');
const output=resolve(repo,process.env.CRYSTRA_LIVE_OUTPUT??'artifacts/backend-rebuild/four-capabilities-live/run-'+Date.now());
const contract='Recurring pure local numerical summarization. Input: {values: array of integers each in [-1000000,1000000], length 0..100}. Output exactly {unique: ascending sorted distinct input values, sum: sum of ALL input values including duplicates}. Empty => {unique:[],sum:0}. No network or external state. These requests recur many times. Original boundary uses a live model; a deterministic replacement is desirable only if applicable and validated. Python candidate commands receive input.json, output.json, context.json as arguments; validate checks code, guard and check print JSON booleans, execute writes output.json.';
const workerOptions={provider:'openai-codex',model:process.env.CRYSTRA_WORKER_MODEL??'gpt-6.1-sol',reasoningEffort:'low',maxTokens:6000};
const expertOptions={provider:'openai-codex',model:process.env.CRYSTRA_EXPERT_MODEL??'gpt-6-astra',reasoningEffort:'high',maxTokens:12000};
const result={passed:false,output,models:{worker:workerOptions,expert:expertOptions},phases:[],business:[],originals:[],checks:{},faults:[],note:'All agents use real models. The deterministic oracle only checks results outside execution. Controlled faults are not spontaneous hallucinations.'};
const phaseNames=['fresh-cms','real-host-and-consensus','barrier-negative-and-repair','automatic-discovery-and-code-takeover','worker-requested-independent-reflection','tamper-fallback-and-requalification','native-host-restart-and-reuse'];
if(process.argv.includes('--plan')){console.log(JSON.stringify({output,models:result.models,phases:phaseNames,contract,sourceFiles:['src/backend/barrier.js','src/backend/value.js','test/backend/barrier.test.mjs','scripts/backend/reflection-benchmark.mjs'],transport:'DSH openai-codex provider / SSE',requiresExplicitCredentialPath:true},null,2));process.exit(0);}
if(!process.env.CRYSTRA_CREDENTIALS_PATH)throw Error('Explicit DSH credentials path required for opt-in real-model acceptance');
await mkdir(output,{recursive:true});
const save=async()=>writeFile(join(output,'progress.json'),JSON.stringify(result,null,2));
async function phase(name,fn){console.log(name);const start=Date.now();try{const value=await fn();result.phases.push({name,passed:true,elapsedMs:Date.now()-start});await save();return value;}catch(e){result.phases.push({name,passed:false,error:e.message,elapsedMs:Date.now()-start});await save();throw e;}}
const oracle=values=>({unique:[...new Set(values)].sort((a,b)=>a-b),sum:values.reduce((s,v)=>s+v,0)});
let ctx,cms,worker,attachment,compose,serial=0,originalBodies=0,publication;
const modelTurns=[];
const textOf=message=>message?.content?.filter(b=>b.type==='text').map(b=>b.text).join('')??'';
async function idle(agent,ms=420000){let timer;try{await Promise.race([agent.whenIdle(),new Promise((_,reject)=>{timer=setTimeout(()=>{agent.cancel({kind:'hook',reason:'Live acceptance time budget'});reject(Error('Live agent timeout'));},ms);})]);}finally{clearTimeout(timer);}const end=agent.session.snapshotEvents().findLast(e=>e.type==='turn/end');assert.equal(end?.data.reason.kind,'completed',JSON.stringify(end?.data.reason));}
async function capture(handle){await ctx.sessions.flush(handle.agent.session);const events=handle.agent.session.snapshotEvents();const usage=events.filter(e=>e.type==='assistant/message'&&e.data.usage).map(e=>({seq:e.seq,...e.data.usage}));modelTurns.push({sessionId:handle.agent.session.id,usage});return events;}
async function original(input){
 originalBodies++;const handle=await ctx.agents.create({sessionId:'live-original-'+randomUUID(),agentOptions:workerOptions,setup(ac){ac.tools.restrict({allow:[]});ac.systemPrompt.section({name:'task',order:40,text:contract+' Calculate the result yourself and output one JSON object, without code fences or commentary.'});}});
 try{handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:JSON.stringify(input)}]}));await idle(handle.agent);const events=await capture(handle);const message=events.findLast(e=>e.type==='assistant/message');const actual=JSON.parse(textOf(message.data.message));assert.deepEqual(actual,oracle(input.values),'Live original disagrees with external oracle');result.originals.push({sessionId:handle.agent.session.id,input,output:actual});return actual;}finally{await handle.dispose();}
}
async function host(){
 const c=new Context();ctx=c;const load=async(n,config={})=>{const m=await import('@deepseek-ai/'+n);await c.plugin(m.default??m,config);};
 for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);
 await load('dsh-credentials-local',{path:process.env.CRYSTRA_CREDENTIALS_PATH,watch:false});
 await load('dsh-llm-pi-ai',{providers:{'openai-codex':{transport:'sse',models:[...new Set([workerOptions.model,expertOptions.model])].map(id=>({id,contextWindow:131072,maxTokens:16000,reasoningEfforts:{low:'low',high:'high'}})),retryPolicy:{mode:'normal',maxRetries:1}}}});
 await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});
 await load('dsh-session-persistence-jsonl',{root:join(output,'dsh'),compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});await c.plugin(lifecycle);
 await c.plugin(backend,{consensus:{namespace:cms.app,client:cms.client,principals,identifyAgent:()=> 'A1'},reflection:{agentOptions:expertOptions,timeoutMs:300000,requestFor:async(_a,goal)=>({root:repo,goal,files:['src/backend/barrier.js','src/backend/value.js','test/backend/barrier.test.mjs','scripts/backend/reflection-benchmark.mjs'],experiments:[{id:'regression',command:process.execPath,args:['--test','test/backend/barrier.test.mjs']},{id:'scaling',command:process.execPath,args:['scripts/backend/reflection-benchmark.mjs']}]})},crystallization:{namespace:'all-live',context:async()=>{await cms.client.resolve(publication.reference);return {contract,consensus:publication.reference};},code:{root:join(output,'code'),python:'/usr/bin/python3',timeoutMs:3000},agentOptions:expertOptions,timeoutMs:300000}});
 return c;
}
const out={schema:{type:'object'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]};
async function spawnWorker(resume=false){
 const setup=(ac,agent)=>{
  ac.tools.restrict({allow:[]});attachment=ctx.crystraBackend.attach(ac,agent,resume?undefined:{scope:'project:live',references:[publication.reference],requiredIds:[publication.reference.id],allowedScopes:['project:live']});
  ac.tools.register({name:'summarize_values',description:contract,parameters:{type:'object',properties:{input:{type:'object',properties:{values:{type:'array',items:{type:'integer',minimum:-1000000,maximum:1000000},maxItems:100}},required:['values'],additionalProperties:false}},required:['input'],additionalProperties:false},output:out,execute:({input})=>original(input)});
  ac.tools.register({name:'run_public_test',description:'Run actual public Barrier regression tests.',parameters:{type:'object',properties:{suite:{type:'string',enum:['public']}},required:['suite'],additionalProperties:false},output:out,execute:async()=>{const r=await exec(process.execPath,['--test',join(repo,'test/backend/barrier.test.mjs')],{cwd:repo,timeout:30000});return {exitCode:0,stdout:r.stdout};}});
 };
 worker=await (resume?ctx.agents.resume({resumeSessionId:'live-worker',agentOptions:workerOptions,setup}):ctx.agents.create({sessionId:'live-worker',agentOptions:workerOptions,setup}));await attachment.ready;
}
async function ask(text){worker.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text}]}));await idle(worker.agent);await ctx.crystraCrystallization.whenIdle();await capture(worker);const state=(await attachment.ready).snapshot();assert(state.history.length>0&&!state.active&&!state.pending.length,'Unresolved commitment responsibility');await writeFile(join(output,'worker-state.json'),JSON.stringify(state,null,2));return state;}
async function work(values){
 const before=originalBodies,eventsBefore=worker.agent.session.snapshotEvents().at(-1)?.seq??-1;
 await ask(`Process batch ${++serial}: ${JSON.stringify({values})}. Use summarize_values exactly once with this input. Declare observable intention before executing; the result is unknown in advance, so tool-completed is sufficient. Respect the effective consensus and return the actual result. Do not request reflection for this batch.`);
 const events=worker.agent.session.snapshotEvents().filter(e=>e.seq>eventsBefore),calls=events.filter(e=>e.type==='tool/call'&&e.data.name==='summarize_values');assert.equal(calls.length,1,'One boundary execution per batch required');
 const receipt=events.find(e=>e.type==='tool/result'&&e.sourceEventSeqs?.includes(calls[0].seq));const actual=JSON.parse(receipt.data.message.content[0].content[0].text);assert.deepEqual(actual,oracle(values));
 const row={batch:serial,values,actual,path:originalBodies>before?'original-live-model':'crystallized-python',callSeq:calls[0].seq,resultSeq:receipt.seq};result.business.push(row);console.log(JSON.stringify(row));await save();return row;
}
try{
 await phase(phaseNames[0],async()=>{
  const project='crystra-live-'+randomUUID().slice(0,8);compose=join(output,'squidex.compose.yml');const source=(await readFile(join(repo,'test/integration/squidex.compose.yml'),'utf8')).replaceAll('crystra-squidex-trial',project).replaceAll('1946','3946').replace('172.30.194.0/28','172.30.196.0/28');await writeFile(compose,source);
  const start=await exec('docker-compose',['-f',compose,'up','-d','--wait'],{timeout:120000});await writeFile(join(output,'cms-start.log'),start.stdout+start.stderr);
  const until=Date.now()+90000;while(true){try{if((await fetch('http://127.0.0.1:3946/api/ping')).ok)break;}catch{}if(Date.now()>until)throw Error('CMS not ready');await new Promise(r=>setTimeout(r,1000));}
  process.env.CRYSTRA_SQUIDEX_URL='http://127.0.0.1:3946';cms=await fixture(join(output,'cms-setup'));
  publication=await publish(cms,content('LIVE-CONSENSUS-LOCAL-ONLY: Keep the task local and focused. No tenancy, remote services or security expansion. Before each managed step declare checkable actions; do not claim tests not executed. Sum counts duplicate values. Independent reflection investigates correctness/robustness/performance and is advisory. '+contract,'project:live'));
  await writeFile(join(output,'publication.json'),JSON.stringify(publication.reference,null,2));
 });
 await phase(phaseNames[1],async()=>{await host();await spawnWorker();assert.equal((await (await attachment.ready).context()).documents[0].reference.data_hash,publication.reference.data_hash);});
 await phase(phaseNames[2],async()=>{
  result.faults.push({type:'controlled-early-finish',note:'Explicit early finish instruction, not spontaneous hallucination.'});
  await ask('Controlled negative probe: declare an action promising run_public_test with match {suite:"public"}, kind result-equals, path ["exitCode"], equals 0. In your first response after declaration deliberately stop before running it: this is an injected missing-execution case. If you subsequently receive NO_GO, inspect the commitment and actually execute the test, then finish. Do not weaken or revise the promise.');
  const events=worker.agent.session.snapshotEvents();assert(events.some(e=>e.type==='user/message'&&textOf(e.data)==='NO_GO'),'No actual Barrier rejection');assert(events.some(e=>e.type==='tool/call'&&e.data.name==='run_public_test'));result.checks.barrierNoGoRepair=true;
 });
 await phase(phaseNames[3],async()=>{for(const v of [[3,1,3],[0,-2,0,8],[5,-1,5,0]])await work(v);const state=(await ctx.crystraCrystallization.ready).snapshot();await writeFile(join(output,'before-fault.json'),JSON.stringify(state,null,2));assert(Object.values(state.families).some(f=>f.active),'No candidate admitted');assert(result.business.some(r=>r.path==='crystallized-python'),'No code takeover');result.checks.automaticCrystallization=true;});
 await phase(phaseNames[4],async()=>{
  await ask('Declare a checkable intent to call crystra_reflect_core and request independent high-model reflection of current Barrier core correctness, robustness and performance. Ask it to read scoped source/tests and actually run both regression and scaling experiments; distinguish observations from hypotheses. Inspect its returned status and summarize the concrete report without treating it as GO/NO_GO.');
  const events=worker.agent.session.snapshotEvents(),call=events.findLast(e=>e.type==='tool/call'&&e.data.name==='crystra_reflect_core');assert(call,'Worker did not request reflection');const receipt=events.findLast(e=>e.type==='tool/result'&&e.sourceEventSeqs?.includes(call.seq));const compact=JSON.parse(receipt.data.message.content[0].content[0].text);const record=await ctx.crystraReflection.read(compact.id);await writeFile(join(output,'reflection.json'),JSON.stringify(record,null,2));assert.equal(record.status,'completed');assert.equal(new Set(record.experiments.filter(e=>e.exitCode===0).map(e=>e.experiment)).size,2,'Required experiments skipped');result.checks.independentReflection=true;
 });
 await phase(phaseNames[5],async()=>{
  const service=await ctx.crystraCrystallization.ready,family=Object.values(service.snapshot().families).find(f=>f.active),entry=await ctx.crystraCodeCapabilities.describe(family.active.reference.id);
  await writeFile(join(output,'code',entry.snapshot,entry.execute[0]),'raise RuntimeError("controlled post-admission tamper")\n');result.faults.push({type:'candidate-file-tamper',reference:family.active.reference});
  assert.equal((await work([10,10,-4])).path,'original-live-model','Changed code did not fall back');const state=service.snapshot();await writeFile(join(output,'after-fault.json'),JSON.stringify(state,null,2));assert(Object.values(state.families).some(f=>f.failures.length&&f.active&&f.jobs.filter(j=>j.status==='promoted').length>=2),'Requalification incomplete');result.checks.tamperRecovery=true;
 });
 await phase(phaseNames[6],async()=>{
  const state=(await attachment.ready).snapshot();await worker.dispose();worker=null;await attachment.close();attachment=null;await ctx.fiber.dispose();ctx=null;await host();await spawnWorker(true);
  assert.deepEqual((await attachment.ready).snapshot().history,state.history,'Recovered obligations changed');assert.equal((await work([1,7,1])).path,'crystallized-python');result.checks.restartReuse=true;
 });
 result.consensus=publication.reference;result.crystallization=(await ctx.crystraCrystallization.ready).snapshot();result.observation=ctx.crystraCrystallization.observationStatus();result.passed=true;
}catch(error){result.error={message:error.message,stack:error.stack};console.error(error.message);process.exitCode=1;}
finally{
 try{if(worker)await capture(worker);await worker?.dispose();await attachment?.close();await ctx?.fiber.dispose();await cms?.close();}catch(e){result.cleanupError=e.message;result.passed=false;process.exitCode=1;}
 if(compose)try{const c=await exec('docker-compose',['-f',compose,'down','-v'],{timeout:30000});await writeFile(join(output,'cms-cleanup.log'),c.stdout+c.stderr);}catch(e){result.cmsCleanupError=e.message;result.passed=false;process.exitCode=1;}
 result.modelsObserved=modelTurns;await writeFile(join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,output,checks:result.checks,error:result.error?.message}));
}
