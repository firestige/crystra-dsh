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
test('resource discussion quotes its exact revision and refuses a stale projection callback',()=>{
 const quoted=[];let rows=[{context:{definitionId:'wf',definitionRevision:'r1'},projection:{snapshotRevision:'snapshot-a',entry:{title:'W'},inputBinding:{},studio:{state:'unavailable',reason:'missing'},crystallization:{state:'unavailable',reason:'missing'},resources:{state:'available',value:{workspace:{files:[{path:'README.md',revision:'file-r1',content:'body',truncated:false}]},catalog:[{id:'r',files:[{path:'README.md'}]}]}}}}];
 const adapter={getSnapshot:()=>({phase:'ready',workflows:rows}),subscribe(){},refresh(){},dispose(){}};
 const React={createElement:(type,props,...children)=>({type,props,children})};const port=createDraftWorkflowIntegration({React,Core:{},adapter,quote:r=>quoted.push(r),canQuote:()=>true});
 const discuss=port.select('wf','r1').panels.resources.children[1].children[0].props.onDiscuss;
 discuss({resourceId:'r',path:'README.md'});assert.equal(quoted[0].resourceRevision,'file-r1');assert.equal(quoted[0].revision,'r1');
 rows=[];discuss({resourceId:'r',path:'README.md'});assert.equal(quoted.length,1);
});
test('unchanged relation projection keeps component identity across owner refreshes',()=>{
 const p={snapshotRevision:'s1',entry:{title:'W'},studio:{state:'unavailable',reason:'missing'},crystallization:{state:'unavailable',reason:'missing'},resources:{state:'available',value:{workspace:{files:[]},catalog:[]}}};
 const rows=[{context:{definitionId:'wf',definitionRevision:'r1'},projection:p}],adapter={getSnapshot:()=>({phase:'ready',workflows:rows}),subscribe(){},refresh(){},dispose(){}};
 const React={createElement:(type,props,...children)=>({type,props,children})};const port=createDraftWorkflowIntegration({React,Core:{},adapter});
 const component=()=>port.select('wf','r1').panels.resources.children[1].children[0].props.renderRelations;
 assert.equal(component(),component());
});
