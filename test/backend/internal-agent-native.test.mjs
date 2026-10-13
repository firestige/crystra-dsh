import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {createReflection} from '../../src/backend/reflection.js';
import {createCrystallizationEvaluator} from '../../src/backend/crystallization-agent.js';
const emit=async function*(){yield{type:'block-start',index:0,blockType:'text'};yield{type:'block-end',index:0,block:{type:'text',text:'Ordinary worker completed.'}};yield{type:'finish',reason:{kind:'stop'}};};
async function nativeHost(root,adapter){
 const ctx=new Context();const load=async(name,config={})=>{const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,config);};
 for(const name of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(name);
 await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});
 await load('dsh-session-persistence-jsonl',{root,compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});ctx.llm.registerAdapter(['lifecycle-fixture'],adapter);
 return ctx;
}
const options=model=>({agentOptions:{provider:'lifecycle-fixture',model},timeoutMs:4000});
const message=()=>createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Continue ordinary work.'}]});
test('real DSH internal lifecycles close independently and preserve another live worker and durable reflection',{timeout:10000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-internal-native-')),started=new Map(['reflection','crystal'].map(k=>[k,Promise.withResolvers()]));let ctx,worker,reflection,crystal;
 class Fixture extends LlmAdapter{async *stream(opts){
  if(opts.model==='worker'){yield*emit();return;}
  assert(!opts.tools.some(t=>t.name==='inherited_write'));started.get(opts.model).resolve();
  await new Promise(resolve=>{if(opts.signal.aborted)resolve();else opts.signal.addEventListener('abort',resolve,{once:true});});yield{type:'finish',reason:{kind:'stop'}};
 }}
 try{
  await writeFile(join(root,'core.mjs'),'export const x=1;');ctx=await nativeHost(join(root,'sessions'),new Fixture());
  ctx.tools.register({name:'inherited_write',description:'Ordinary worker capability only',parameters:{type:'object'},output:{schema:{type:'object'},render:()=>[]},execute:()=>{throw Error('Internal agent must not inherit this tool');}});
  worker=await ctx.agents.create({sessionId:'ordinary-worker',agentOptions:options('worker').agentOptions});
  reflection=createReflection(ctx,options('reflection'));crystal=createCrystallizationEvaluator(ctx,options('crystal'));
  const reviewing=reflection.run({root,files:['core.mjs'],goal:'Investigate without editing'}),evaluating=crystal.evaluate({id:'job',scope:'P',boundary:'tool',context:{},observations:[]});let evaluationEnded=false;evaluating.then(()=>{evaluationEnded=true;});
  await Promise.all([...started.values()].map(d=>d.promise));await reflection.close();const review=await reviewing;
  assert.equal(review.status,'cancelled');assert.equal(evaluationEnded,false,'closing reflection must not close crystallization');assert.equal((await reflection.read(review.id)).status,'cancelled');
  assert.ok(ctx.agents.list().some(a=>a.session.id==='ordinary-worker'));assert.ok(ctx.agents.list().some(a=>a.session.id.startsWith('crystra-crystallization-eval-')));
  worker.agent.followup(message());await worker.agent.whenIdle();assert.equal(worker.agent.session.snapshotEvents().findLast(e=>e.type==='turn/end').data.reason.kind,'completed');
  await crystal.close();const evaluation=await evaluating;assert.equal(evaluation.evaluation.status,'cancelled');
  const h=await ctx.sessionPersistence.open(evaluation.evaluation.sessionId,'read');try{assert.ok((await h.read()).events.some(e=>e.type==='turn/end'));}finally{await h.close();}
  assert.deepEqual(ctx.agents.list().map(a=>a.session.id),['ordinary-worker']);
  worker.agent.followup(message());await worker.agent.whenIdle();assert.equal(worker.agent.session.snapshotEvents().filter(e=>e.type==='turn/end').length,2);
 }finally{await reflection?.close();await crystal?.close();await worker?.dispose();await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
});
test('real DSH evaluator setup failure is reported and does not prevent a later independent run',{timeout:8000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-internal-setup-'));let ctx,service;let fail=true;
 class Empty extends LlmAdapter{async *stream(){yield*emit();}}
 try{
  ctx=await nativeHost(root,new Empty());service=createCrystallizationEvaluator(ctx,{...options('worker'),setupEvaluator(){if(fail)throw Error('setup unavailable');}});
  const job={id:'job',scope:'P',boundary:'tool',context:{},observations:[]};const failed=await service.evaluate(job);assert.equal(failed.evaluation.status,'failed');assert.match(failed.error,/setup unavailable/);
  fail=false;assert.equal((await service.evaluate({...job,id:'retry'})).evaluation.status,'incomplete');await service.close();assert.deepEqual(ctx.agents.list(),[]);
 }finally{await service?.close();await ctx?.fiber.dispose();await rm(root,{recursive:true,force:true});}
});
