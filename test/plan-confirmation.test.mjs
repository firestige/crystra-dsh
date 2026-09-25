import test from 'node:test';
import assert from 'node:assert/strict';
import {roleBindingsTable} from '../src/host/plan-confirmation.js';
test('plan binding confirmation renders role/provider/model-id without exposing SDK versions',()=>{
 const bindings={author:{agentProvider:{identity:'provider.codex',version:'secret-version'},model:{provider:'openai',model:'gpt-test'}}};
 assert.equal(roleBindingsTable({bindings}), '| role | provider | model-id |\n| --- | --- | --- |\n| author | provider.codex | gpt-test |');
 assert.equal(roleBindingsTable(undefined,{bindings}),roleBindingsTable({bindings}));
 assert.equal(roleBindingsTable({bindings:{}},{bindings}),'Role 绑定尚不可用');
 const hostile={bindings:{'role|<script>':{agentProvider:{identity:'p'},model:{model:'a\nb'}}}};
 assert.match(roleBindingsTable(hostile), /role&#124;&#60;script&#62;/);
 assert.ok(!roleBindingsTable(hostile).includes('secret-version'));
});
