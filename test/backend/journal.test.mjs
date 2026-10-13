import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { openJournal } from '../../src/backend/dsh-journal.js';
async function host(root) {
  const ctx=new Context();
  for(const name of ['dsh-session','dsh-session-persistence-jsonl']) {
    const mod=await import('@deepseek-ai/'+name);
    await ctx.plugin(mod.default??mod,name.endsWith('jsonl')?{root,compression:'none'}:{});
  }
  return ctx;
}
test('official JSONL journal survives a fresh host and refuses a competing writer',async()=>{
  const root=await mkdtemp(join(tmpdir(),'crystra-journal-'));
  let ctx=await host(root);
  try {
    const journal=await openJournal(ctx.sessionPersistence,'worker');
    assert.equal(await journal.read(),null);
    const state={schemaVersion:1,workerSessionId:'worker',active:{id:'step-1'}};
    await journal.append(state);
    await assert.rejects(openJournal(ctx.sessionPersistence,'worker'),/owned|ownership/i);
    await journal.close(); await ctx.fiber.dispose(); ctx=await host(root);
    const resumed=await openJournal(ctx.sessionPersistence,'worker');
    assert.deepEqual(await resumed.read(),state);
    await resumed.close();
  } finally { await ctx.fiber.dispose(); await rm(root,{recursive:true,force:true}); }
});
test('separate installed persistence copies recognize only matching native missing-session identity',async()=>{
 // A separately installed DSH package has its own constructor identity.
 class OtherCopyNotFound extends Error {constructor(id){super('missing');this.name='SessionPersistenceNotFoundError';this.sessionId=id;}}
 let created=0;const persistence={async open(id){throw new OtherCopyNotFound(id);},async create(){created++;return {read:async()=>({events:[]}),close:async()=>{}};}};
 const journal=await openJournal(persistence,'native-worker');assert.equal(created,1);await journal.close();
 for(const error of [Object.assign(new Error('disk failure'),{sessionId:'wrong'}),new OtherCopyNotFound('wrong')]){
 await assert.rejects(openJournal({...persistence,open:async()=>{throw error;}},'native-worker'),e=>e===error);
 }
 assert.equal(created,1);
});

// Envelope v1 remains stable while independently owned component schemas evolve.
test('domain v2 survives a fresh native host without upgrading the v1 envelope or another component',async()=>{
 const root=await mkdtemp(join(tmpdir(),'journal-domain-version-'));let ctx=await host(root);
 try{
  const a=await openJournal(ctx.sessionPersistence,'a'),b=await openJournal(ctx.sessionPersistence,'b');
  const old={schemaVersion:1,workerSessionId:'a',history:[{receipt:'old'}]},next={...old,schemaVersion:2,newField:{retained:true}},other={schemaVersion:1,workerSessionId:'b',active:null};
  await a.append(old);await b.append(other);await a.append(next);await a.close();await b.close();await ctx.fiber.dispose();ctx=await host(root);
  const restored=await openJournal(ctx.sessionPersistence,'a'),unchanged=await openJournal(ctx.sessionPersistence,'b');
  assert.deepEqual(await restored.read(),next);assert.deepEqual(await unchanged.read(),other);
  const {Controller}=await import('../../src/backend/controller.js');
  await assert.rejects(Controller.open({workerSessionId:'a',journal:restored}),/Unsupported state/,'domain owner still rejects unsupported versions');
  await restored.close();await unchanged.close();
 }finally{await ctx.fiber.dispose();await rm(root,{recursive:true,force:true});}
});
function memoryPersistence(events=[]){
 let closed=0,stored=structuredClone(events),fail=false;
 const handle={read:async()=>({events:structuredClone(stored)}),append:async rows=>{if(fail)throw Error('disk failure');stored.push(...structuredClone(rows));},flush:async()=>{},close:async()=>{closed++;}};
 return {persistence:{open:async()=>handle},get closed(){return closed;},get events(){return stored;},fail:()=>{fail=true;}};
}
test('invalid domain state identities and versions refuse before append and do not poison a valid journal',async()=>{
 const f=memoryPersistence(),j=await openJournal(f.persistence,'worker');
 for(const state of [null,[],{}, {schemaVersion:1,workerSessionId:'wrong'}, ...[undefined,0,-1,1.5,'2',NaN,Infinity].map(schemaVersion=>({schemaVersion,workerSessionId:'worker'}))])await assert.rejects(j.append(state),/Invalid journal state identity/);
 assert.equal(f.events.length,0);await j.append({schemaVersion:2,workerSessionId:'worker'});assert.equal(f.events[0].data.schemaVersion,1);assert.equal(f.events[0].data.state.schemaVersion,2);
 f.fail();await assert.rejects(j.append({schemaVersion:2,workerSessionId:'worker'}),/disk failure/);await assert.rejects(j.append({schemaVersion:2,workerSessionId:'worker'}),/unavailable/);await j.close();
});
test('unknown envelopes and mismatched embedded identities fail closed and release the native handle',async()=>{
 const valid={type:'crystra/backend-state',seq:0,data:{schemaVersion:1,workerSessionId:'worker',state:{schemaVersion:1,workerSessionId:'worker',history:['preserved']}}};
 const bad=[{...valid,type:'other'}, {...valid,data:{...valid.data,schemaVersion:2}}, {...valid,data:{...valid.data,workerSessionId:'wrong'}}, {...valid,data:{...valid.data,state:{schemaVersion:1,workerSessionId:'wrong'}}}, {...valid,data:{...valid.data,state:{schemaVersion:0,workerSessionId:'worker'}}}, {...valid,data:{...valid.data,state:null}}];
 for(const e of bad){const f=memoryPersistence([e]);await assert.rejects(openJournal(f.persistence,'worker'),/schema|identity/);assert.equal(f.closed,1);assert.deepEqual(f.events,[e]);}
 const f=memoryPersistence([valid]),j=await openJournal(f.persistence,'worker');assert.deepEqual(await j.read(),valid.data.state);const s=await j.read();s.history=[];assert.deepEqual((await j.read()).history,['preserved']);await j.close();
});
