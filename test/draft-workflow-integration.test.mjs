import test from 'node:test';import assert from 'node:assert/strict';
import {createDraftWorkflowIntegration} from '../src/client/draft-workflow-integration.js';
test('Workflow rendering selects an exact revision and revocation removes its directory and panels',()=>{
 let rows=[{context:{definitionId:'wf',definitionRevision:'r1'},projection:{entry:{definitionId:'wf',revision:'r1',title:'Name'},provenance:'fixture',studio:{state:'unavailable',reason:'missing'},resources:{state:'unavailable',reason:'missing'},crystallization:{state:'unavailable',reason:'missing'}}}];
 const adapter={getSnapshot:()=>({phase:'ready',workflows:rows}),subscribe(){},refresh(){},dispose(){}};
 const React={createElement:(type,props,...children)=>({type,props,children})};
 const port=createDraftWorkflowIntegration({React,Core:{},adapter});
 assert.equal(port.directory().entries[0].title,'Name');assert.equal(port.select('wf','other'),undefined);
 assert.ok(port.select('wf','r1').panels.studio);rows=[];assert.equal(port.select('wf','r1'),undefined);assert.deepEqual(port.directory().entries,[]);
});
test('native Input receives only an explicitly bound current Workflow projection',()=>{
 let rows=[];const adapter={getSnapshot:()=>({phase:'ready',workflows:rows}),subscribe(){},refresh(){},dispose(){}};
 const port=createDraftWorkflowIntegration({React:{createElement(){}},Core:{},adapter});
 assert.deepEqual(port.bindings.getSnapshot().entries,[]);
 rows=[{context:{definitionId:'wf',definitionRevision:'r1'},projection:{inputBinding:{workspaceId:'native-w',packageRoot:'/package',sessionId:'s'}}}];
 assert.deepEqual(port.bindings.getSnapshot().entries,[{definitionId:'wf',revision:'r1',workspaceId:'native-w',packageRoot:'/package',sessionId:'s'}]);
 rows=[];assert.deepEqual(port.bindings.getSnapshot().entries,[]);
});
