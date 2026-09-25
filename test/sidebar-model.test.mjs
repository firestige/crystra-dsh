import assert from 'node:assert/strict';
import test from 'node:test';
import { projectSidebar } from '../src/client/navigation/sidebar-model.js';
import { resolveRoute } from '../src/client/navigation/routes.js';
test('sidebar maps supplied objects without fixtures and preserves exact workflow identity',()=>{
 const data={tasks:[{id:'task / ?a',title:'User title'}],workflows:[{definitionId:'build / x',revision:'v2 & 3',fromTaskId:'source ?x',title:'Same name'},{definitionId:'build / x',revision:'v4',title:'Same name'}],analysis:[]};
 const result=projectSidebar(data,{page:'workflow',definitionId:'build / x',revision:'v2 & 3',fromTaskId:'source ?x'});
 assert.equal(result.workflows[0].selected,true);
 assert.equal(result.workflows[1].selected,false);
 assert.deepEqual(resolveRoute(result.workflows[0].href),{page:'workflow',definitionId:'build / x',revision:'v2 & 3',fromTaskId:'source ?x'});
 assert.equal(resolveRoute(result.tasks[0].href).taskId,'task / ?a');
 assert.equal(result.tasks[0].title,'User title');
 assert.deepEqual(projectSidebar({tasks:[],workflows:[],analysis:[]},{page:'tasks'}).tasks,[]);
 assert.equal(data.workflows[0].selected,undefined);
});
