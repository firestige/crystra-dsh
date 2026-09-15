import test from 'node:test';import assert from 'node:assert/strict';
import {projectTraceDirectory,createTraceDirectoryController} from '../src/client/trace-directory.js';
const delivery={deliveryId:'d',task:{identity:'task-a',displayName:'Actual task'},workflow:{identity:'wf-a',packageName:'workflow-a',exactPackageVersion:'1.2.3'},lifecycle:'TERMINAL',terminal:{outcome:'SUCCEEDED'},detached:false,recoverable:false,navigation:null,timing:{startedAt:1700000000000}};
const inventory={kind:'ready',snapshot:{schemaVersion:'execution.delivery-control-plane@1.0.0',generation:1,deliveries:[delivery]}};
const root={kind:'DELIVERY_ROOT_BINDING',truth:{availability:'AVAILABLE',completeness:null,expiry:'ACTIVE',expires_at:null},relationships:[{kind:'DELIVERY_ROOT',from:{kind:'SPAN',key:['a'.repeat(32),'b'.repeat(16)]},to:{kind:'DELIVERY',key:['d']}}]};
function source(value){const listeners=new Set();return {getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(next){value=next;for(const fn of listeners)fn();}};}
test('directory joins exact owner timing and workflow identity with an admitted Delivery root',()=>{
 const result=projectTraceDirectory(inventory,[root],Date.now());assert.equal(result.records.length,1);
 assert.deepEqual(result.records[0],{deliveryId:'d',taskId:'task-a',taskName:'Actual task',workflowId:'wf-a',workflowName:'workflow-a',workflowVersion:'1.2.3',startedAt:new Date(delivery.timing.startedAt).toISOString(),traceId:'a'.repeat(32)});
 assert.equal(projectTraceDirectory({...inventory,kind:'reconnecting'},[root],Date.now()).records.length,0);
});
test('expired, missing, or ambiguous roots never become a guessed Trace',()=>{
 assert.equal(projectTraceDirectory(inventory,[],Date.now()).unavailable[0].reason,'ROOT_UNAVAILABLE');
 assert.equal(projectTraceDirectory(inventory,[{...root,truth:{...root.truth,expires_at:'2020-01-01T00:00:00.000000Z'}}],Date.now()).records.length,0);
 const other=structuredClone(root);other.relationships[0].from.key[1]='c'.repeat(16);
 assert.equal(projectTraceDirectory(inventory,[root,other],Date.now()).unavailable[0].reason,'ROOT_AMBIGUOUS');
});
test('paginated root reads must share a snapshot and a later failure clears earlier records',async()=>{
 const input=source(inventory);let mismatch=false;
 const model=createTraceDirectoryController({inventory:input,decode:(_,value)=>({ok:true,value}),gateway:{call:async(_,query)=>({ok:true,value:{snapshot:query.cursor&&mismatch?'changed':'s1',next_cursor:query.cursor?null:'p2',items:query.cursor?[]:[root]}})}});
 await model.refresh();assert.equal(model.getSnapshot().records.length,1);mismatch=true;await model.refresh();
 assert.equal(model.getSnapshot().phase,'error');assert.equal(model.getSnapshot().records.length,0);assert.equal(model.getSnapshot().error,'FACT_SNAPSHOT_CHANGED');model.dispose();
});
test('a response from an older inventory cannot restore records after the binding becomes unavailable',async()=>{
 const input=source(inventory);let finish;
 const model=createTraceDirectoryController({inventory:input,decode:(_,value)=>({ok:true,value}),gateway:{call:()=>new Promise(resolve=>{finish=resolve;})}});
 const pending=model.refresh();input.set({kind:'error'});finish({ok:true,value:{snapshot:'s',next_cursor:null,items:[root]}});await pending;
 assert.equal(model.getSnapshot().phase,'unavailable');assert.equal(model.getSnapshot().records.length,0);model.dispose();
});

test('the published decoder admits the recorded T6 service root and its SPAN to DELIVERY direction',async()=>{
 const {readFile}=await import('node:fs/promises');const {decodeEvidencePage}=await import('crystra-ui-core');
 const page=JSON.parse(await readFile(new URL('./fixtures/qualified-delivery-root-page.json',import.meta.url),'utf8'));
 const decoded=decodeEvidencePage('facts',page,200);assert.equal(decoded.ok,true,JSON.stringify(decoded));
 const fact=decoded.value.items[0];const deliveryId=fact.relationships[0].to.key[0];
 const result=projectTraceDirectory({...inventory,snapshot:{...inventory.snapshot,deliveries:[{...delivery,deliveryId}]}},decoded.value.items,Date.parse('2026-09-15T00:00:00Z'));
 assert.equal(result.records[0].traceId,fact.source.trace_id);
 assert.equal(result.records[0].deliveryId,deliveryId);
});
