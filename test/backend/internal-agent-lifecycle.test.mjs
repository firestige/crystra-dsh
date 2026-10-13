import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReflection} from '../../src/backend/reflection.js';
import {createCrystallizationEvaluator} from '../../src/backend/crystallization-agent.js';
const config={agentOptions:{provider:'fixture',model:'quality'},timeoutMs:1000};
function host({disposeError=false,journalCloseError=false,holdFlush=false}={}){
 const records=new Map(),handles=[];let closes=0;let releaseFlush,markFlushing;const flushing=new Promise(r=>{markFlushing=r;}),flushGate=new Promise(r=>{releaseFlush=r;});
 const persistence={async open(id){if(!records.has(id))throw Object.assign(Error('missing'),{name:'SessionPersistenceNotFoundError',sessionId:id});return journal(id);},async create(header){records.set(header.sessionId??header.id,[]);return journal(header.sessionId??header.id);}};
 function journal(id){return {read:async()=>({events:records.get(id)}),append:async events=>{records.get(id).push(...structuredClone(events));},flush:async()=>{},close:async()=>{closes++;if(journalCloseError)throw Error('journal close failure');}};}
 const ctx={sessionPersistence:persistence,sessions:{flush:async()=>{markFlushing();if(holdFlush)await flushGate;}},agents:{create:async spec=>{const agent={status:'idle',cancel(){},whenIdle:async()=>{},followup(){},session:{id:spec.sessionId,snapshotEvents:()=>[{seq:0,type:'turn/end',data:{reason:{kind:'completed'}}}]}};const handle={agent,dispose:async()=>{if(disposeError)throw Error('dispose failure');}};handles.push(handle);return handle;}}};
 return {ctx,records,handles,flushing,releaseFlush,get closes(){return closes;}};
}
async function settled(promise){let timer;try{return await Promise.race([promise.then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),150);})]);}finally{clearTimeout(timer);}}
for(const fault of ['disposeError','journalCloseError'])test(`reflection close settles even when ${fault} cleanup rejects`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-lifecycle-'));try{
  await writeFile(join(root,'core.mjs'),'export const x=1;');const f=host({[fault]:true,holdFlush:fault==='journalCloseError'}),service=createReflection(f.ctx,config);
  const running=service.run({root,files:['core.mjs'],goal:'inspect'});let closing;
  if(fault==='journalCloseError'){await f.flushing;closing=service.close();f.releaseFlush();}
  await assert.rejects(running,fault==='disposeError'?/dispose failure/:/journal close failure/);
  assert.equal(await settled(closing??service.close()),true,'failed cleanup must release the tracked run rather than hang service close');
  const final=[...f.records.values()][0].at(-1).data.state;assert.equal(final.status,fault==='journalCloseError'?'cancelled':'incomplete');assert.equal(f.closes,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('crystallization preserves rejected dispose and still closes its lifecycle',async()=>{
 const f=host({disposeError:true}),service=createCrystallizationEvaluator(f.ctx,config);
 await assert.rejects(service.evaluate({id:'job',scope:'P',boundary:'tool',context:{},observations:[]}),/dispose failure/);assert.equal(await settled(service.close()),true);
});

test('internal role identities keep existing prefixes and do not classify ordinary sessions',async()=>{
 const {internalAgentRole,internalSessionId,isInternalAgent}=await import('../../src/backend/internal-agents.js');
 for(const [role,prefix]of [['reflection','crystra-reflection-'],['crystallization','crystra-crystallization-eval-']]){
  const id=internalSessionId(role);assert.match(id,new RegExp('^'+prefix+'[0-9a-f-]{36}$'));assert.equal(internalAgentRole(id),role);assert.ok(isInternalAgent({session:{id}}));assert.equal(internalAgentRole(prefix+'legacy'),role);
 }
 for(const id of ['worker','crystra-backend-x','prefix-crystra-reflection-x',undefined])assert.equal(internalAgentRole(id),null);
 assert.equal(isInternalAgent({}),false);assert.throws(()=>internalSessionId('commander'),/Unknown/);
});

for(const kind of ['reflection','crystallization'])test(`${kind} closing during agent creation cancels before followup and waits for disposal`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-create-close-'));try{
  await writeFile(join(root,'core.mjs'),'export const x=1;');const f=host();let started,release,followups=0,cancelled=0,disposed=false;
  const creating=new Promise(r=>{started=r;}),gate=new Promise(r=>{release=r;}),create=f.ctx.agents.create;
  f.ctx.agents.create=async spec=>{started();await gate;const h=await create(spec);h.agent.followup=()=>{followups++;};h.agent.cancel=()=>{cancelled++;};h.dispose=async()=>{disposed=true;};return h;};
  const service=kind==='reflection'?createReflection(f.ctx,config):createCrystallizationEvaluator(f.ctx,config);
  const running=kind==='reflection'?service.run({root,files:['core.mjs'],goal:'inspect'}):service.evaluate({id:'job',observations:[]});
  await creating;let closed=false;const closing=service.close().then(()=>{closed=true;});await Promise.resolve();assert.equal(closed,false);release();
  const result=await running;await closing;assert.equal(kind==='reflection'?result.status:result.evaluation.status,'cancelled');assert.equal(followups,0);assert.ok(cancelled>0);assert.equal(disposed,true);
  await assert.rejects(kind==='reflection'?service.run({root,files:['core.mjs'],goal:'again'}):service.evaluate({id:'again',observations:[]}),/closed/);
 }finally{await rm(root,{recursive:true,force:true});}
});

for(const kind of ['reflection','crystallization'])for(const failure of ['create','flush'])test(`${kind} ${failure} failure releases the run and permits a new evaluation`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-run-failure-'));try{
  await writeFile(join(root,'core.mjs'),'export const x=1;');const f=host(),original=failure==='create'?f.ctx.agents.create:f.ctx.sessions.flush;
  if(failure==='create')f.ctx.agents.create=async()=>{throw Error('create failed');};else f.ctx.sessions.flush=async()=>{throw Error('flush failed');};
  const service=kind==='reflection'?createReflection(f.ctx,config):createCrystallizationEvaluator(f.ctx,config),run=()=>kind==='reflection'?service.run({root,files:['core.mjs'],goal:'inspect'}):service.evaluate({id:'job',observations:[]});
  const failed=await run();assert.equal(kind==='reflection'?failed.status:failed.evaluation.status,'failed');assert.match(failed.error,new RegExp(failure+' failed'));
  if(failure==='create')f.ctx.agents.create=original;else f.ctx.sessions.flush=original;
  const retried=await run();assert.equal(kind==='reflection'?retried.status:retried.evaluation.status,'incomplete');assert.equal(await settled(service.close()),true);
 }finally{await rm(root,{recursive:true,force:true});}
});
for(const id of ['crystra-reflection-legacy','crystra-crystallization-eval-legacy'])test(`${id} remains excluded from project initialization and automatic observation`,async()=>{
 const {selectedProject}=await import('../../src/backend/native-config.js'),{initializeProject}=await import('../../src/backend/project-initialization.js'),{connectCrystallization}=await import('../../src/backend/crystallization-dsh.js');
 const agent={session:{id,header:{cwd:tmpdir()}}};assert.equal(selectedProject(agent,tmpdir()),false);
 await assert.rejects(initializeProject({}, {root:tmpdir(),scope:'P'},{agent}),/Internal evaluator/);
 const listeners=new Map(),ctx={on(name,handler){listeners.set(name,handler);return()=>listeners.delete(name);}},ready={then(){throw Error('Internal work must not enter the automatic crystallization service');}};
 const connector=connectCrystallization(ctx,ready,{namespace:'P'});
 assert.equal(await listeners.get('tools/execute')({agent,name:'ordinary_input_tool',arguments:{input:1}},async()=> 'original'),'original');assert.equal(connector.status().pending,0);await connector.close();
});
