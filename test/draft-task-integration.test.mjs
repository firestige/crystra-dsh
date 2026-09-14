import test from 'node:test';import assert from 'node:assert/strict';
import {createDraftTaskIntegration} from '../src/client/draft-task-integration.js';
const context={draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),environment:'exploration',taskId:'draft-a',goalRevision:'goal-a',planRevision:null,adapterId:'crystra-task-file@1',accessAllowed:true,allowFixtures:true};
const {accessAllowed,allowFixtures,...binding}=context;
test('an owner record with the same ID retains its identity and cannot inherit draft workbench content',async()=>{
 const projection={binding,expiresAt:new Date(Date.now()+60000).toISOString(),snapshotRevision:'s1',provenance:'fixture',surfaces:Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(k=>[k,{state:'unavailable',reason:'missing'}]))};
 let state={taskList:{phase:'ready',items:[]}};const source={getSnapshot:()=>state,subscribe:()=>()=>{},loadTasks:async()=>{}};
 const integration=createDraftTaskIntegration({React:{createElement:(type,props)=>({type,props})},Core:{},source,gateway:{call:async endpoint=>({ok:true,value:endpoint==='catalog/read'?{authority:'draft',tasks:[{context,expiresAt:projection.expiresAt,snapshotRevision:'s1'}]}:projection})}});
 try{
 await integration.start();assert.match(integration.controller.getSnapshot().taskList.items[0].display_name,/草案/);assert.equal(Object.keys(integration.renderTaskPanels('draft-a')).length,5);
 state={taskList:{phase:'ready',items:[{task_id:'draft-a',display_name:'Actual owner'}]}};
 assert.deepEqual(integration.controller.getSnapshot().taskList.items,state.taskList.items);assert.deepEqual(integration.renderTaskPanels('draft-a'),{});
 }finally{integration.dispose();}
});
