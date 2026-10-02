import {test} from 'node:test';import assert from 'node:assert/strict';import {createTaskQueryGateway} from '../src/host/task-query.js';
test('Task writes use the owner and return conflicts without hiding the read snapshot',async()=>{
 const input={taskId:'t',expectedRevision:1,pinned:true};let received;
 const gateway=createTaskQueryGateway({snapshot:async()=>({revision:'r',items:[]}),updatePresentation:async payload=>{received=payload;throw new Error('TASK_PRESENTATION_CONFLICT');}});
 const result=await gateway.handle('update',input);assert.deepEqual(received,input);assert.equal(result.error.code,'TASK_PRESENTATION_CONFLICT');assert.equal((await gateway.handle('list',{})).ok,true);await gateway.close();
});
