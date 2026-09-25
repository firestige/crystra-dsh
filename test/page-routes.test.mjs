import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRoute } from '../src/client/navigation/routes.js';
test('five route kinds preserve exact identities without a preview fixture', () => {
 assert.deepEqual(resolveRoute('/'), {page:'tasks'});
 assert.equal(resolveRoute('/tasks').page,'tasks');
 assert.deepEqual(resolveRoute('/tasks/a%20b'),{page:'task',taskId:'a b'});
 assert.equal(resolveRoute('/workflows').page,'workflows');
 assert.deepEqual(resolveRoute('/workflows/build?revision=v3&from_task_id=source'),{page:'workflow',definitionId:'build',revision:'v3',fromTaskId:'source'});
 assert.deepEqual(resolveRoute('/analysis?view=traces'),{page:'analysis',view:'traces'});
});
test('missing versions and invalid targets never become another object', () => {
 assert.equal(resolveRoute('/workflows/build').revision,null);
 for (const path of ['/unknown','/tasks/a/extra','/tasks/%E0%A4%A','/analysis?view=bogus']) assert.equal(resolveRoute(path).page,'not-found');
 assert.equal(resolveRoute('/tasks/new').page,'new-task');
});
test('root-hosted routes survive reload while preserving task identity and page query',()=>{
 assert.deepEqual(resolveRoute('/#/tasks/task-one'),{page:'task',taskId:'task-one'});
 assert.deepEqual(resolveRoute('/#/analysis?view=reports'),{page:'analysis',view:'reports'});
});
