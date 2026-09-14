import test from 'node:test';import assert from 'node:assert/strict';
import {projectEvidenceTasks} from '../src/client/task-browser-projection.js';
test('Evidence task identity and display name do not invent runtime browser facts',()=>{
 const result=projectEvidenceTasks([{task_id:'task-a',display_name:'Alpha',cost:15,active:true},{task_id:'task-b',display_name:null}]);
 assert.deepEqual(result,[{id:'task-a',title:'Alpha'},{id:'task-b',title:'task-b'}]);
});
