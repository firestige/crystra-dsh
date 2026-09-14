import test from 'node:test';import assert from 'node:assert/strict';
import {createDraftTaskAdapter} from '../src/client/draft-task-adapter.js';
const context={draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),environment:'exploration',taskId:'draft-a',goalRevision:'goal-a',planRevision:null,adapterId:'crystra-task-file@1',accessAllowed:true,allowFixtures:true};
const {accessAllowed,allowFixtures,...binding}=context;
const projection={binding,expiresAt:'2026-09-16T00:00:00.000Z',snapshotRevision:'s1',provenance:'fixture',surfaces:Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(k=>[k,{state:'unavailable',reason:'missing'}]))};
const create=gateway=>createDraftTaskAdapter({gateway,now:()=>Date.parse('2026-09-15T00:00:00Z'),setTimer:()=>1,clearTimer:()=>{}});
test('admitted exact tasks disappear after source revocation; retained task subscriptions see invalidation',async()=>{
 let enabled=true;const port=create({call:async endpoint=>!enabled?{ok:false,error:{code:'DRAFT_UNAVAILABLE'}}:{ok:true,value:endpoint==='catalog/read'?{authority:'draft',tasks:[{context,expiresAt:projection.expiresAt,snapshotRevision:'s1'}]}:projection}});
 const task=port.taskSource('draft-a');await port.refresh();assert.equal(task.getSnapshot().state,'valid');assert.equal(port.getSnapshot().tasks.length,1);
 enabled=false;await port.refresh();assert.equal(task.getSnapshot().state,'invalid');assert.equal(port.getSnapshot().tasks.length,0);port.dispose();
});
test('a mismatched projection never enters the catalog and disabled defaults do not retry',async()=>{
 let timers=0;const port=createDraftTaskAdapter({gateway:{call:async()=>({ok:false,error:{code:'DRAFT_DISABLED'}})},setTimer:()=>{timers++;return 1;},clearTimer:()=>{}});
 await port.refresh();assert.equal(timers,0);assert.equal(port.getSnapshot().tasks.length,0);port.dispose();
 const invalid=create({call:async endpoint=>({ok:true,value:endpoint==='catalog/read'?{authority:'draft',tasks:[{context,expiresAt:projection.expiresAt,snapshotRevision:'s1'}]}:{...projection,binding:{...binding,goalRevision:'other'}}})});
 await invalid.refresh();assert.equal(invalid.getSnapshot().tasks.length,0);invalid.dispose();
});
test('a stalled refresh cannot keep an old projection visible past its bounded read lease',async()=>{
 const scheduled=[];let stalled=false;
 const port=createDraftTaskAdapter({now:()=>Date.parse('2026-09-15T00:00:00Z'),setTimer:(fn,delay)=>{scheduled.push({fn,delay});return scheduled.length;},clearTimer:()=>{},gateway:{call:async endpoint=>stalled?new Promise(()=>{}):({ok:true,value:endpoint==='catalog/read'?{authority:'draft',tasks:[{context,expiresAt:projection.expiresAt,snapshotRevision:'s1'}]}:projection})}});
 await port.refresh();assert.equal(port.taskSource('draft-a').getSnapshot().state,'valid');
 const lease=scheduled.find(item=>item.delay===10000);assert.ok(lease);
 stalled=true;lease.fn();assert.equal(port.taskSource('draft-a').getSnapshot().state,'invalid');port.dispose();
});
