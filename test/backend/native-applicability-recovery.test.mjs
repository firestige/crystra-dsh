import {nativeCrystallizationConfig} from '../../src/backend/dsh-evidence.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Context} from '@deepseek-ai/cordis';
import {nativeConfig} from '../../src/backend/native-config.js';
import {openJournal} from '../../src/backend/dsh-journal.js';
import {Crystallization} from '../../src/backend/crystallization.js';
import {digest} from '../../src/backend/value.js';
async function host(root){const ctx=new Context();for(const name of ['dsh-session','dsh-session-persistence-jsonl']){const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,name.endsWith('jsonl')?{root,compression:'none'}:{});}return ctx;}
const request=x=>({scope:'test',boundary:'double',input:{x}});
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'native-crystal-recovery-'));let ctx=await host(join(root,'sessions')),journal,service,originals=0,broken=false;
 let input={enabled:true,project:{root,scope:'test',references:[{id:'a',published_version:1,publication_event_id:'p',actor:'user',data_hash:'a'.repeat(64)}]},squidex:{baseUrl:'http://127.0.0.1:1946',app:'test',schema:'agreements',managementTokenRef:'WRITE',consumerTokenRef:'READ'},reflection:{enabled:true,provider:'expert',model:'A',files:['core.js']},crystallization:{enabled:true,provider:'expert',model:'A',python:'/usr/bin/python3'}};
 const events=new Map(),material={source:'double'},reference={id:'double',version:1,hash:digest(material)};
 const runtime=()=>nativeConfig({crystraConsensus:{ready:Promise.resolve({resolve:async()=>{if(broken)throw Error('consensus unavailable');}})}},input);
 const namespace=runtime().core.crystallization.namespace;
 const ports={namespace,context:()=>runtime().core.crystallization.context(),original:async r=>{const id=`original-${++originals}`,value=r.input.x*2;events.set(id,[{seq:1,type:'tool/call',data:{callId:'c',name:'double',arguments:JSON.stringify({input:r.input})}},{seq:2,type:'tool/result',sourceEventSeqs:[1],data:{message:{source:{callId:'c'},content:[{type:'tool-result',toolCallId:'c',content:[{type:'text',text:JSON.stringify(value)}]}]}}}]);return {sessionId:id,callSeq:1,resultSeq:2};},readEvents:async id=>events.get(id),evaluate:async()=>({decision:'candidate',reference,reason:'Two independent examples agree'}),resolve:async()=>({reference,material,guard:()=>true,run:async i=>i.x*2,check:out=>typeof out==='number'})};
 async function open(seed){journal=await openJournal(ctx.sessionPersistence,`crystallization:${namespace}`);if(seed)await journal.append(seed);service=await Crystallization.open(nativeCrystallizationConfig(ports),journal);return service;}
 return {root,namespace,reference,runtime,open,get service(){return service;},get originals(){return originals;},get input(){return input;},set input(v){input=v;},broken:v=>{broken=v;},restart:async()=>{await service?.close();await journal?.close();await ctx.fiber.dispose();ctx=await host(join(root,'sessions'));return open();},dispose:async()=>{await service?.close();await journal?.close();await ctx.fiber.dispose();await rm(root,{recursive:true,force:true});}};
}
test('legacy v1 whole-config families and receipt deduplication recover without unsafe rebind or data loss',async()=>{
 const f=await fixture();try{
  const runtime=f.runtime(),context={projectRoot:runtime.projectRoot,references:runtime.manifest.references,configuration:digest(runtime.config)},key=digest({scope:'test',boundary:'double',context});
  const receipt={sessionId:'legacy-original',callSeq:1,resultSeq:2},receiptKey=digest(receipt);
  const oldFamily={scope:'test',boundary:'double',context,observations:[{input:{x:0},output:0,receipt}],jobs:[{id:'legacy-job',status:'promoted',report:{note:'preserve'}}],active:{reference:f.reference,jobId:'legacy-job'},failures:[],nextEvaluation:2};
  await f.open({schemaVersion:1,workerSessionId:`crystallization:${f.namespace}`,families:{[key]:oldFamily},receipts:{[receiptKey]:key}});
  await f.restart();assert.deepEqual(f.service.snapshot().families[key],oldFamily);
  assert.equal((await f.service.observe(request(0),receipt)).path,'ignored','old evidence cannot be counted again under the new identity');
  assert.equal((await f.service.run(request(1))).path,'original','legacy admission is not silently rebound');
  await f.service.run(request(2));assert.equal((await f.service.run(request(3))).path,'crystallized');
  await f.restart();assert.equal((await f.service.run(request(4))).path,'crystallized');
  const state=f.service.snapshot();assert.deepEqual(state.families[key],oldFamily);assert.equal(state.receipts[receiptKey],key);assert.equal(Object.keys(state.families).length,2);assert.equal(f.originals,2);
 }finally{await f.dispose();}
});
test('unrelated configuration changes preserve admitted crystals across native persistence restart',async()=>{
 const f=await fixture();try{
  await f.open();await f.service.run(request(1));await f.service.run(request(2));const before=f.service.snapshot(),n=f.originals;
  f.input={...f.input,reflection:{...f.input.reflection,model:'B',files:['changed.js']},crystallization:{...f.input.crystallization,provider:'other',model:'B',timeoutMs:42},squidex:{...f.input.squidex,managementTokenRef:'ROTATED_WRITE',consumerTokenRef:'ROTATED_READ',timeoutMs:100}};
  await f.restart();assert.equal((await f.service.run(request(3))).path,'crystallized');assert.equal(f.originals,n);assert.equal(Object.keys(f.service.snapshot().families).length,1);assert.deepEqual(Object.values(f.service.snapshot().families)[0].active,Object.values(before.families)[0].active);
 }finally{await f.dispose();}
});
test('relevant execution changes require new admission while unavailable consensus refuses execution and can recover',async()=>{
 const f=await fixture();try{
  await f.open();await f.service.run(request(1));await f.service.run(request(2));const old=f.service.snapshot();
  f.input={...f.input,crystallization:{...f.input.crystallization,executionTimeoutMs:3000}};await f.restart();
  assert.equal((await f.service.run(request(3))).path,'original');assert.equal(Object.keys(f.service.snapshot().families).length,2);assert.deepEqual(f.service.snapshot().families[Object.keys(old.families)[0]],Object.values(old.families)[0]);
  await f.service.run(request(4));assert.equal((await f.service.run(request(5))).path,'crystallized');
  const before=f.service.snapshot(),n=f.originals;f.broken(true);await assert.rejects(f.service.run(request(6)),/consensus unavailable/);assert.equal(f.originals,n);assert.deepEqual(f.service.snapshot(),before);
  f.broken(false);await f.restart();assert.equal((await f.service.run(request(6))).path,'crystallized');assert.equal(f.originals,n);
 }finally{await f.dispose();}
});
