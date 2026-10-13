import {nativeEvidence} from '../../src/backend/dsh-evidence.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Controller } from '../../src/backend/controller.js';
import { digest } from '../../src/backend/value.js';
const data = { body: 'Local backend only' };
const ref = { id:'c1', published_version:1, publication_event_id:'p1', actor:'user:owner', data_hash:digest(data) };
const manifest = { scope:'backend', references:[ref] };
const write = { id:'write', kind:'tool-completed', tool:'write_file', match:{ path:'a.js' } };
const run = { id:'test', kind:'tool-completed', tool:'run_test', match:{ suite:'public' } };
function fixture() {
  let stored = null, unavailable = false, failWrite = false;
  const events = [];
  const journal = { read:async()=>structuredClone(stored), append:async(value)=>{ if(failWrite)throw Error('disk failure'); stored=structuredClone(value); } };
  const options = { workerSessionId:'worker', journal, resolve:async()=>{if(unavailable)throw Error('offline');return {reference:ref,data,effective:true};}, evidence:nativeEvidence(async()=>({sessionId:'worker',seq:events.length,events:structuredClone(events)})) };
  const completed=(name,args)=>{
    const id='call-'+events.length;
    events.push({seq:events.length+1,type:'tool/call',data:{callId:id,name,arguments:JSON.stringify(args)}});
    events.push({seq:events.length+1,type:'tool/result',sourceEventSeqs:[events.length],data:{message:{source:{callId:id},content:[{type:'tool-result',toolCallId:id,content:[{type:'text',text:'{}'}]}]}}});
  };
  return { options, completed, offline:()=>unavailable=true, fail:()=>failWrite=true };
}
test('missing work blocks successor and finish; native execution permits durable closure',async()=>{
  const f=fixture(), c=await Controller.open(f.options,manifest);
  assert.equal(await c.finish(),'NO_GO');
  assert.equal(await c.declare({label:'write and test',actions:[write,run]}),'GO');
  f.completed('write_file',{path:'a.js'});
  assert.equal(await c.declare({label:'skip',actions:[run]}),'NO_GO');
  assert.equal(await c.finish(),'NO_GO');
  f.completed('run_test',{suite:'public'});
  assert.equal(await c.finish(),'GO');
  const restored=await Controller.open(f.options);
  assert.equal(restored.snapshot().history.length,1);
  assert.equal(await restored.finish(),'GO');
  assert.equal(restored.snapshot().active,null);
});
test('split cannot drop responsibility and successor must inherit exact deferred assertion',async()=>{
  const f=fixture(),c=await Controller.open(f.options,manifest);
  await c.declare({label:'write and test',actions:[write,run]});
  f.completed('write_file',{path:'a.js'});
  assert.equal(await c.revise({baseVersion:1,retain:['write'],defer:['test'],reason:'Write complete, test must follow.'}),'GO');
  assert.equal(await c.finish(),'NO_GO');
  const pending=c.snapshot().pending[0];
  assert.equal(await c.declare({label:'weaken',actions:[{...run,match:{suite:'other'}}],inherits:[pending.id]}),'NO_GO');
  assert.equal(await c.declare({label:'remaining test',actions:[run],inherits:[pending.id]}),'GO');
  f.completed('run_test',{suite:'public'});
  assert.equal(await c.finish(),'GO');
  assert.equal(c.snapshot().pending.length,0);
  assert.equal(c.snapshot().history[0].versions.length,1);
});
test('consensus outage blocks closure without erasing active responsibility',async()=>{
  const f=fixture(),c=await Controller.open(f.options,manifest);
  await c.declare({label:'write',actions:[write]});f.completed('write_file',{path:'a.js'});f.offline();
  assert.equal(await c.finish(),'NO_GO');
  assert.ok(c.snapshot().active);
});
test('failed persistence does not acknowledge an operation or allow further mutations',async()=>{
  const f=fixture(),c=await Controller.open(f.options,manifest);f.fail();
  await assert.rejects(c.declare({label:'write',actions:[write]}),/disk failure/);
  assert.equal(c.snapshot().active,null);
  await assert.rejects(c.declare({label:'write',actions:[write]}),/journal unavailable/);
});
test('concurrent declarations serialize and restored identity cannot change',async()=>{
  const f=fixture(),c=await Controller.open(f.options,manifest);
  const results=await Promise.all([c.declare({label:'one',actions:[write]}),c.declare({label:'two',actions:[run]})]);
  assert.deepEqual(results,['GO','NO_GO']);
  await assert.rejects(Controller.open({...f.options,workerSessionId:'other'}),/identity/);
});
test('explicit rebind/unload use revision CAS, preserve history and cannot erase active responsibility',async()=>{
 const f=fixture(),c=await Controller.open(f.options,manifest);
 await assert.rejects(c.setManifest(manifest,{expectedRevision:0,reason:''}));
 await c.declare({label:'write',actions:[write]});
 await assert.rejects(c.setManifest(null,{expectedRevision:0,reason:'Unload'}));
 f.completed('write_file',{path:'a.js'});await c.finish();
 await c.setManifest(null,{expectedRevision:0,reason:'Explicitly unload after completion'});
 await assert.rejects(c.context());assert.equal(await c.finish(),'NO_GO');
 const resumed=await Controller.open(f.options);
 assert.equal(resumed.snapshot().manifest,null);
 await assert.rejects(resumed.setManifest(manifest,{expectedRevision:0,reason:'stale'}));
 await resumed.setManifest(manifest,{expectedRevision:1,reason:'Explicitly load approved binding'});
 assert.equal(resumed.snapshot().bindingHistory.length,2);
 assert.equal((await resumed.context()).scope,'backend');
});

test('restored abnormal revision history rejects another split without changing responsibility',async()=>{
  const f=fixture(), c=await Controller.open(f.options,manifest);
  await c.declare({label:'Write then test',actions:[write,run]});f.completed('write_file',{path:'a.js'});
  const abnormal=c.snapshot();abnormal.active.versions=[{versions:[{versions:[]}]}];
  await f.options.journal.append(abnormal);
  const restored=await Controller.open(f.options,manifest);
  assert.equal(await restored.revise({baseVersion:1,reason:'Write complete',retain:['write'],defer:['test']}),'NO_GO');
  assert.deepEqual(restored.snapshot().active,abnormal.active);
  assert.deepEqual(restored.snapshot().pending,abnormal.pending);
  assert.equal(await restored.finish(),'NO_GO');
});

test('proposal may retain either equivalent action and still requires fresh execution for its successor',async()=>{
  for(const retained of ['a','b']){
    const f=fixture(),c=await Controller.open(f.options,manifest);
    const actions=['a','b'].map(id=>({...write,id}));
    await c.declare({label:'Two writes',actions});f.completed('write_file',{path:'a.js'});
    const deferred=actions.find(a=>a.id!==retained);
    assert.equal(await c.revise({baseVersion:1,reason:'One write completed; carry the other',retain:[retained],defer:[deferred.id]}),'GO');
    const revised=c.snapshot();assert.equal(revised.active.revision.basis[0].actionId,retained);
    assert.equal(revised.pending.length,1);assert.deepEqual(revised.pending[0].action,deferred);
    assert.equal(await c.finish(),'NO_GO');
    const pending=c.snapshot().pending[0];
    assert.equal(await c.declare({label:'Perform remaining write',actions:[pending.action],inherits:[pending.id]}),'GO');
    assert.equal(await c.finish(),'NO_GO','Old execution predates successor declaration');
    f.completed('write_file',{path:'a.js'});
    assert.equal(await c.finish(),'GO');
    const restored=await Controller.open(f.options,manifest);assert.equal(restored.snapshot().pending.length,0);
    assert.equal(restored.snapshot().history.length,2);assert.deepEqual(restored.snapshot(),c.snapshot());
  }
});

test('explicit initialization cannot claim managed work before the first approved binding',async()=>{
 const f=fixture(),seed={scope:'backend',references:[]};
 await assert.rejects(Controller.open(f.options,seed));
 const c=await Controller.open({...f.options,initializing:true},seed);
 assert.equal(c.snapshot().initializing,true);
 await assert.rejects(c.context(),/initial|共识/i);
 assert.equal(await c.declare({label:'premature work',actions:[write]}),'NO_GO');
 assert.equal(await c.finish(),'NO_GO');
 await c.setManifest(manifest,{expectedRevision:0,reason:'approved first agreement'});
 assert.equal(c.snapshot().initializing,false);
 assert.equal((await c.context()).documents.length,1);
 const restored=await Controller.open({...f.options,initializing:true});
 assert.equal(restored.snapshot().initializing,false);
 assert.equal(await restored.declare({label:'managed work',actions:[write]}),'GO');
});
