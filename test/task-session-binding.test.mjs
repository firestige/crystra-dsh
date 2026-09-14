import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTaskSessionBinding} from '../src/client/task-session-binding.js';
const delivery=(id,task,session)=>({deliveryId:id,task:{identity:task,displayName:null},lifecycle:'BOUND',detached:false,recoverable:false,navigation:{sessionCorrelation:session}});
const ready=deliveries=>({kind:'ready',snapshot:{schemaVersion:'execution.delivery-control-plane@1.0.0',generation:1,deliveries}});
const sessions=(...ids)=>({phase:'ready',ids,byId:Object.fromEntries(ids.map(id=>[id,{id}]))});
test('binds only the exact Task and a session owned by this runtime',()=>{
 const state=ready([delivery('d1','t1','s1'),delivery('d2','t2','s2')]);
 assert.deepEqual(resolveTaskSessionBinding('t1',state,sessions('s1','s2')),{kind:'bound',sessionId:'s1',deliveryIds:['d1']});
 assert.equal(resolveTaskSessionBinding('t3',state,sessions('s1')).kind,'unbound');
 assert.equal(resolveTaskSessionBinding('t1',state,sessions('s2')).kind,'unavailable');
});
test('multiple sessions require selection; multiple deliveries on one session do not',()=>{
 assert.equal(resolveTaskSessionBinding('t',ready([delivery('d1','t','s1'),delivery('d2','t','s2')]),sessions('s1','s2')).kind,'ambiguous');
 assert.deepEqual(resolveTaskSessionBinding('t',ready([delivery('d2','t','s1'),delivery('d1','t','s1')]),sessions('s1')),{kind:'bound',sessionId:'s1',deliveryIds:['d1','d2']});
});
test('does not collapse a foreign candidate into the single local candidate',()=>{
 assert.equal(resolveTaskSessionBinding('t',ready([delivery('d1','t','s1'),delivery('d2','t','foreign')]),sessions('s1')).kind,'ambiguous');
});
test('stale, corrupt and not-yet-ready sources cannot authorize a binding',()=>{
 const good=ready([delivery('d1','t','s')]);
 assert.equal(resolveTaskSessionBinding('t',{...good,kind:'reconnecting'},sessions('s')).kind,'unavailable');
 assert.equal(resolveTaskSessionBinding('t',{...good,snapshot:{...good.snapshot,generation:0}},sessions('s')).kind,'unavailable');
 assert.equal(resolveTaskSessionBinding('t',good,{...sessions('s'),phase:'loading'}).kind,'unavailable');
 assert.equal(resolveTaskSessionBinding('',good,sessions('s')).kind,'unavailable');
});
