import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {digest} from '../../src/backend/value.js';
import {candidate} from '../fixtures/code-candidate.mjs';
import * as backend from '../../src/backend/index.js';
const emit=async function*(block){yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'usage',usage:{inputTokens:10,outputTokens:2}};yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};};
const call=(name,args)=>({type:'tool-call',id:randomUUID(),name,arguments:JSON.stringify(args)});
async function host(root,mode='candidate',timeoutMs=2000,automatic=false){
 const ctx=new Context(),counts={original:0,evaluation:0,built:0,bodies:0},capabilities=new Map();
 let serial=0;const controls={basis:1,version:1,errorInput:null,prose:false,extraArgs:{},proposal:candidate()};
 class Fixture extends LlmAdapter {
  rounds=new Map();
  async *stream(options){
   const evaluator=options.model==='evaluator';if(evaluator)counts.evaluation++;else counts.original++;
   const input=JSON.parse(options.messages.find(m=>m.role==='user').content[0].text);
   const key=evaluator?input.id:input.id,n=(this.rounds.get(key)??0)+1;this.rounds.set(key,n);
   if(!evaluator){yield*emit(n===1?call('double',{input:input.input,...controls.extraArgs}):{type:'text',text:'Done'});return;}
   assert(!options.tools.some(t=>['double','crystra_declare_step','inherited_write'].includes(t.name)));
   if(mode==='timeout'){await new Promise(r=>{const t=setTimeout(r,1000);options.signal.addEventListener('abort',()=>{clearTimeout(t);r();},{once:true});});yield {type:'finish',reason:{kind:'stop'}};return;}
   if(mode==='incomplete'){yield*emit({type:'text',text:'I think it is reusable.'});return;}
   if(n===1){yield*emit(call('crystra_crystallization_read',{index:0,offset:0}));return;}
   if(n===2&&mode==='candidate'){yield*emit(automatic.code?call('crystra_code_register',controls.proposal):call('build_double',{}));return;}
   let ref=[...capabilities.values()].at(-1)?.reference;
   if(automatic.code){
    const texts=[];const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object'){if(v.type==='text')texts.push(v.text);if(v.content)visit(v.content);}};visit(options.messages);
    for(const text of texts){try{const value=JSON.parse(text);if(value.reference)ref=value.reference;}catch{}}
   }
   const proposal=mode==='candidate'?{decision:'candidate',reason:'Repeated local arithmetic can be replaced under the integer guard.',reference:ref}:{decision:mode,reason:'Cost does not justify building yet.'};
   yield*emit(n===(mode==='candidate'?3:2)?call('crystra_crystallization_propose',proposal):{type:'text',text:'Finished'});
  }
 }
 const load=async(n,c={})=>{const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,c);};
 for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);
 await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});
 await load('dsh-session-persistence-jsonl',{root,compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
 ctx.llm.registerAdapter(['crystallization-fixture'],new Fixture());
 const original=async request=>{
  const handle=await ctx.agents.create({sessionId:'original-'+randomUUID(),agentOptions:{provider:'crystallization-fixture',model:'original'},setup:(ac)=>{
   ac.tools.restrict({allow:[]});ac.tools.register({name:'double',description:'Double the supplied value',parameters:{type:'object'},output:{schema:{type:'number'},render:(_a,v)=>[{type:'text',text:controls.prose?'Result: '+v:JSON.stringify(v)}]},execute:({input})=>{counts.bodies++;if(input.x===controls.errorInput)throw Error('Original failed');return input.x*2;}});
  }});
  try{
   handle.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:JSON.stringify({id:++serial,input:request.input})}]}));
   await handle.agent.whenIdle();await ctx.sessions.flush(handle.agent.session);
   const events=handle.agent.session.snapshotEvents();return {sessionId:handle.agent.session.id,callSeq:events.find(e=>e.type==='tool/call').seq,resultSeq:events.find(e=>e.type==='tool/result').seq};
  }finally{await handle.dispose();}
 };
 await ctx.plugin(backend,{resolveConsensus:async()=>{throw Error('No Barrier attachment expected');},crystallization:{namespace:'native-test',...(automatic===false?{auto:false}:automatic.default?{}:{auto:true}),context:async()=>({consensusVersion:controls.basis}),...(automatic.noOriginal?{}:{original}),...(automatic.code?{code:{root:join(root,'code'),python:'/usr/bin/python3',timeoutMs:2000}}:{resolve:async ref=>capabilities.get(ref.id)}),agentOptions:{provider:'crystallization-fixture',model:'evaluator'},timeoutMs,setupEvaluator:(ac)=>{
  ac.tools.register({name:'build_double',description:'Build and freeze a local capability in the host registry.',parameters:{type:'object'},output:{schema:{type:'object'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:()=>{
   counts.built++;const material={source:'x=>x*2',version:controls.version},reference={id:'native-double',version:controls.version,hash:digest(material)};
   capabilities.set(reference.id,{reference,material,guard:i=>Number.isSafeInteger(i.x)&&i.x>=0,run:async i=>i.x*2,check:o=>Number.isSafeInteger(o)});return reference;
  }});
 }}});
 return {ctx,counts,capabilities,controls,work:original};
}
const req=x=>({scope:'college',boundary:'double',input:{x}});
for(const mode of ['candidate','defer','decline','incomplete','timeout'])test(`native DSH crystallization closes loop: ${mode}`,{timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-crystal-'));let ctx;
 try{
  const f=await host(dir,mode,mode==='timeout'?30:2000);ctx=f.ctx;
  const service=await ctx.crystraCrystallization.ready;
  await service.run(req(1));assert.equal(f.counts.evaluation,0);
  await service.run(req(2));const family=Object.values(service.snapshot().families)[0],job=family.jobs[0];
  assert.equal(job.status,mode==='candidate'?'promoted':['defer','decline'].includes(mode)?mode:'failed',JSON.stringify(job));
  assert.equal(job.evaluation.status,mode==='incomplete'?'incomplete':mode==='timeout'?'timed_out':'completed');
  const handle=await ctx.sessionPersistence.open(job.evaluation.sessionId,'read');let events;try{events=(await handle.read()).events;}finally{await handle.close();}
  assert(events.some(e=>e.type==='turn/end'));assert.equal(job.evaluation.model.model,'evaluator');
  if(mode!=='timeout')assert(job.evaluation.usage.length>0,'Capture native assistant usage instead of inventing an llm/usage event');
  if(mode==='candidate'){
   assert.equal(f.counts.built,1);assert(events.some(e=>e.type==='tool/call'&&e.data.name==='build_double'));
   const originalCalls=f.counts.original,evalCalls=f.counts.evaluation;
   assert.equal((await service.run(req(3))).path,'crystallized');assert.equal(f.counts.original,originalCalls);assert.equal(f.counts.evaluation,evalCalls);
   await ctx.fiber.dispose();ctx=null;
   const restored=await host(dir);ctx=restored.ctx;restored.capabilities.set('native-double',f.capabilities.get('native-double'));
   const next=await ctx.crystraCrystallization.ready;assert.equal((await next.run(req(4))).output,8);assert.equal(restored.counts.original,0);assert.equal(restored.counts.evaluation,0);
  }else assert.equal(f.counts.built,0);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});

test('ordinary DSH work automatically discovers, qualifies and routes without calling the service', {timeout:10000}, async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-'));let ctx;
 try{
  const f=await host(dir,'candidate',2000,{noOriginal:true,default:true});ctx=f.ctx;
  await f.work(req(1));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.evaluation,0);
  await f.work(req(1));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.evaluation,0);
  await f.work(req(2));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.built,1);
  const service=await ctx.crystraCrystallization.ready,family=Object.values(service.snapshot().families)[0];
  assert.equal(family.jobs[0].status,'promoted');assert.equal(family.observations.length,2);
  const n=f.counts.bodies,e=f.counts.evaluation;
  const receipt=await f.work(req(3));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,n);assert.equal(f.counts.evaluation,e);
  const h=await ctx.sessionPersistence.open(receipt.sessionId,'read');let events;try{events=(await h.read()).events;}finally{await h.close();}
  const result=events.find(e=>e.seq===receipt.resultSeq);assert.equal(JSON.parse(result.data.message.content[0].content[0].text),6);
  const route=Object.values(service.snapshot().routes)[0];assert.equal(route.path,'crystallized');assert.deepEqual(route.receipt,receipt);
  assert.equal(Object.values(service.snapshot().families)[0].observations.length,2,'Fast output is not a new independent original');
  await ctx.fiber.dispose();ctx=null;
  const restored=await host(dir,'candidate',2000,true);ctx=restored.ctx;restored.capabilities.set('native-double',f.capabilities.get('native-double'));
  await restored.work(req(4));await ctx.crystraCrystallization.whenIdle();assert.equal(restored.counts.bodies,0);assert.equal(restored.counts.evaluation,0);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});

for(const mode of ['defer','decline','incomplete','timeout'])test(`automatic observation handles ${mode} without an application request`,{timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-choice-'));let ctx;
 try{
  const f=await host(dir,mode,mode==='timeout'?30:2000,true);ctx=f.ctx;
  await f.work(req(1));await ctx.crystraCrystallization.whenIdle();await f.work(req(2));await ctx.crystraCrystallization.whenIdle();
  const n=f.counts.evaluation;await f.work(req(2));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.evaluation,n);
  const family=Object.values((await ctx.crystraCrystallization.ready).snapshot().families)[0];assert.equal(family.active,null);assert.equal(family.jobs[0].status,['defer','decline'].includes(mode)?mode:'failed');assert.equal(f.counts.built,0);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('automatic observation skips native errors, prose and additional arguments, then recovers', {timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-unsupported-'));let ctx;
 try{
  const f=await host(dir,'candidate',2000,true);ctx=f.ctx;f.controls.errorInput=1;
  await f.work(req(1));await ctx.crystraCrystallization.whenIdle();f.controls.prose=true;
  await f.work(req(2));await ctx.crystraCrystallization.whenIdle();f.controls.prose=false;f.controls.extraArgs={option:'different'};
  await f.work(req(3));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.evaluation,0);assert.equal(ctx.crystraCrystallization.observationStatus().observed,0);
  f.controls.extraArgs={};await f.work(req(4));await ctx.crystraCrystallization.whenIdle();await f.work(req(5));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.built,1);
  assert.equal(Object.keys((await ctx.crystraCrystallization.ready).snapshot().families).length,1,'Evaluator build tools must not recursively become observations');
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('automatic fallback and context changes requalify through ordinary work', {timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-fallback-'));let ctx;
 try{
  const f=await host(dir,'candidate',2000,true);ctx=f.ctx;
  for(const x of [1,2]){await f.work(req(x));await ctx.crystraCrystallization.whenIdle();}
  const e=f.counts.evaluation;await f.work(req(-1));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.evaluation,e);
  const old=f.capabilities.get('native-double');f.capabilities.set('native-double',{...old,run:async()=>{throw Error('Changed page format');}});
  const n=f.counts.bodies;await f.work(req(3));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,n+1);assert.equal(f.counts.built,2);
  f.controls.version=2;const material={source:'x=>x*2',version:2};f.capabilities.set('native-double',{...old,material,reference:{id:'native-double',version:2,hash:digest(material)}});
  await f.work(req(4));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.built,3);
  f.controls.basis=2;const before=f.counts.bodies;
  for(const x of [5,6,7]){await f.work(req(x));await ctx.crystraCrystallization.whenIdle();}
  assert.equal(f.counts.bodies,before+2);assert.equal(f.counts.built,4);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('explicit calls and automatic observation do not deadlock or duplicate original receipts', {timeout:5000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-explicit-'));let ctx;
 try{
  const f=await host(dir,'candidate',2000,true);ctx=f.ctx;const service=await ctx.crystraCrystallization.ready;
  await service.run(req(1));await service.run(req(2));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.built,1);assert.equal(f.counts.bodies,2);assert.equal(ctx.crystraCrystallization.observationStatus().observed,0);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('automatic observation errors are visible and prevent silent continuation', {timeout:5000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-error-'));let ctx;
 try{
  const f=await host(dir,'candidate',2000,true);ctx=f.ctx;const service=await ctx.crystraCrystallization.ready;
  service.config.readFacts=async()=>{throw Error('Native storage unavailable');};await f.work(req(1));await assert.rejects(ctx.crystraCrystallization.whenIdle(),/storage unavailable/);
  assert.match(ctx.crystraCrystallization.observationStatus().error,/storage unavailable/);const n=f.counts.bodies;
  await f.work(req(2));assert.equal(f.counts.bodies,n);assert.equal(f.counts.built,0);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('simultaneous native workers remain observable after their sessions are disposed', {timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-parallel-'));let ctx;
 try{
  const f=await host(dir,'candidate',2000,true);ctx=f.ctx;
  await Promise.all([1,2,3,4].map(x=>f.work(req(x))));await ctx.crystraCrystallization.whenIdle();
  assert.equal(f.counts.built,1);assert.equal(ctx.crystraCrystallization.observationStatus().error,null);
  const observations=Object.values((await ctx.crystraCrystallization.ready).snapshot().families)[0].observations;assert(observations.length>=2);assert(observations.every(o=>Number.isFinite(o.durationMs)));
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('a final DSH pipeline rejection revokes the fast version for the next invocation', {timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-auto-final-'));let ctx;
 try{
  const f=await host(dir,'candidate',2000,true);ctx=f.ctx;
  for(const x of [1,2]){await f.work(req(x));await ctx.crystraCrystallization.whenIdle();}
  const off=ctx.on('tools/post-execute',async(exec,result,next)=>exec.name==='double'&&result.value===6?{kind:'block',feedback:[{type:'text',text:'Final pipeline rejected'}]}:next());
  await f.work(req(3));await ctx.crystraCrystallization.whenIdle();const service=await ctx.crystraCrystallization.ready;
  assert.equal(Object.values(service.snapshot().families)[0].active,null);assert.equal(Object.values(service.snapshot().routes)[0].isError,true);
  off();const n=f.counts.bodies;await f.work(req(4));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,n+1);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});

test('DSH discovers, builds and runs actual Python candidate files, then restores them', {timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-code-dsh-'));let ctx;
 try{
  const f=await host(dir,'candidate',10000,{code:true,noOriginal:true});ctx=f.ctx;
  for(const x of [1,2]){await f.work(req(x));await ctx.crystraCrystallization.whenIdle();}
  const service=await ctx.crystraCrystallization.ready,family=Object.values(service.snapshot().families)[0];assert.equal(family.jobs[0].status,'promoted',JSON.stringify(family.jobs[0]));
  for(const shadow of family.jobs[0].shadows){const receipt=await ctx.crystraCodeCapabilities.readReceipt(shadow.execution.id);assert.equal(receipt.mode,'shadow');assert.equal(receipt.stages.execute.exitCode,0);}
  const n=f.counts.bodies;await f.work(req(3));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,n);
  await f.work(req(-1));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,n+1);
  await ctx.fiber.dispose();ctx=null;
  const restored=await host(dir,'candidate',10000,{code:true,noOriginal:true});ctx=restored.ctx;await restored.work(req(4));await ctx.crystraCrystallization.whenIdle();assert.equal(restored.counts.bodies,0);assert.equal(restored.counts.evaluation,0);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('real code check failure falls back, agent registers repaired code and requalifies', {timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-code-repair-'));let ctx;
 try{
  const f=await host(dir,'candidate',10000,{code:true,noOriginal:true});ctx=f.ctx;f.controls.proposal=candidate("import json,sys\nx=json.load(open(sys.argv[1]))\njson.dump(999 if x['x']==3 else x['x']*2,open(sys.argv[2],'w'))\n");
  for(const x of [1,2]){await f.work(req(x));await ctx.crystraCrystallization.whenIdle();}
  const n=f.counts.bodies;await f.work(req(3));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,n+1);
  const service=await ctx.crystraCrystallization.ready;assert.equal(Object.values(service.snapshot().families)[0].active,null);
  f.controls.proposal=candidate();await f.work(req(4));await ctx.crystraCrystallization.whenIdle();assert(Object.values(service.snapshot().families)[0].active);
  const before=f.counts.bodies;await f.work(req(5));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,before);
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('DSH rejects modified snapshots and invalid validation, retaining the original route', {timeout:30000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'crystra-code-tamper-'));let ctx;
 try{
  const f=await host(dir,'candidate',10000,{code:true,noOriginal:true});ctx=f.ctx;
  for(const x of [1,2]){await f.work(req(x));await ctx.crystraCrystallization.whenIdle();}
  const entry=await ctx.crystraCodeCapabilities.describe('double');const {writeFile}=await import('node:fs/promises');await writeFile(join(dir,'code',entry.snapshot,'execute.py'),'raise RuntimeError("modified")');
  f.controls.proposal=candidate();f.controls.proposal.files['validate.py']='raise RuntimeError("invalid")';const before=f.counts.bodies;
  await f.work(req(3));await ctx.crystraCrystallization.whenIdle();assert.equal(f.counts.bodies,before+1);
  const family=Object.values((await ctx.crystraCrystallization.ready).snapshot().families)[0];assert.equal(family.active,null);assert.equal(family.jobs.at(-1).status,'failed');
 }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
