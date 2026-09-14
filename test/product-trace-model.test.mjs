import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductTraceController} from '../src/client/product-trace-model.js';
const a='a'.repeat(32),b='b'.repeat(32);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(load){return createProductTraceController({gateway:{call(){}},decode(){},load,compile:items=>({status:'READY',nodes:items})});}
test('a later exact trace selection rejects stale responses and clears the previous view',async()=>{
 const calls=[];const c=setup((port,id)=>{const d=deferred();calls.push({id,...d});return d.promise;});
 const first=c.open(a),second=c.open(b);
 assert.equal(c.getSnapshot().trace,undefined);
 calls[1].resolve({ok:true,state:'ABSENT'});await second;
 calls[0].resolve({ok:true,state:'AVAILABLE'});await first;
 assert.equal(c.getSnapshot().traceId,b);assert.equal(c.getSnapshot().phase,'absent');
});
test('invalid input does not query; failures remain explicit',async()=>{
 let calls=0;const c=setup(async()=>{calls++;throw new Error('offline');});
 await c.open('../bad');assert.equal(calls,0);assert.equal(c.getSnapshot().phase,'error');
 await c.open(a);assert.equal(c.getSnapshot().phase,'error');assert.match(c.getSnapshot().error,/offline/);
});
test('formal decoder and shared paginated loader feed the renderer only after success',async()=>{
 const requests=[];const c=createProductTraceController({gateway:{async call(endpoint,filters){requests.push({endpoint,filters});return {ok:true,value:{items:[filters.cursor??'first']}};}},decode:(route,value)=>({ok:true,value}),load:async(port,id)=>{await port.getTracesPage({trace_id:id,limit:200});await port.getTracesPage({trace_id:id,limit:200,cursor:'next'});return {ok:true,state:'PARTIAL'};},compile:items=>({status:'READY',nodes:items})});
 await c.open(a);assert.deepEqual(c.getSnapshot().trace.nodes,['first','next']);assert.equal(c.getSnapshot().phase,'partial');assert.equal(requests[1].endpoint,'traces/read');
});
