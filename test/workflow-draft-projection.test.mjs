import test from 'node:test';import assert from 'node:assert/strict';
import {admitWorkflowDraft,workflowDraftLayout} from '../src/client/workflow-draft-projection.js';
const context={draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),environment:'exploration',definitionId:'wf',definitionRevision:'r1',workspaceId:'w',adapterId:'crystra-workflow-file@1',accessAllowed:true,allowFixtures:true};
const {accessAllowed,allowFixtures,...binding}=context;
const ir={version:'0.2',title:'Workflow',nodes:[{id:'s',kind:'start',title:'Start'},{id:'e',kind:'end',title:'End'}],edges:[{id:'edge',from:'s',to:'e'}]};
const layout={width:300,height:100,nodes:[{id:'s',x:0,y:0,width:40,height:40,expanded:false},{id:'e',x:200,y:0,width:40,height:40,expanded:false}],edges:[{originalId:'edge',points:[{x:40,y:20},{x:200,y:20}]}]};
const projection={binding,snapshotRevision:'s1',expiresAt:'2026-09-16T00:00:00.000Z',provenance:'fixture',entry:{definitionId:'wf',revision:'r1',title:'Workflow',status:'DRAFT',isLatest:true},studio:{state:'available',value:{ir,groups:[],layouts:{RIGHT0:layout}}},resources:{state:'unavailable',reason:'not supplied'},crystallization:{state:'unavailable',reason:'not supplied'}};
const now=Date.parse('2026-09-15T00:00:00Z');
test('only exact, current, explicitly enabled Workflow drafts are admitted',()=>{
 assert.equal(admitWorkflowDraft(projection,context,now).state,'valid');
 for(const changed of [{...context,allowFixtures:false},{...context,definitionRevision:'r2'},{...context,accessAllowed:false}])assert.equal(admitWorkflowDraft(projection,changed,now).state,'invalid');
 assert.equal(admitWorkflowDraft(projection,context,Date.parse(projection.expiresAt)).state,'invalid');
});
test('invalid identity, containment cycles, geometry and resource types never reach the viewer',()=>{
 for(const mutate of [p=>p.entry.revision='other',p=>p.studio.value.ir.nodes[0].parent='s',p=>p.studio.value.layouts.RIGHT0.nodes[0].width=Infinity,p=>p.resources={state:'available',value:{workspace:{},catalog:[]}}]){
 const p=structuredClone(projection);mutate(p);assert.equal(admitWorkflowDraft(p,context,now).state,'invalid');
 }
});
test('layout projection retains exact geometry and rejects unmatched definitions or expansion layouts',()=>{
 const value=workflowDraftLayout(projection.studio.value,ir,new Set(),'RIGHT');
 assert.equal(value.edges[0].path,'M40 20 L200 20');assert.equal(value.edges[0].arrow,true);
 assert.throws(()=>workflowDraftLayout(projection.studio.value,{...ir,title:'Changed'},new Set(),'RIGHT'),/DEFINITION_LAYOUT_MISMATCH/);
 assert.throws(()=>workflowDraftLayout(projection.studio.value,ir,new Set(),'DOWN'),/LAYOUT_UNAVAILABLE/);
});
test('malformed display metadata is rejected before React receives it',()=>{
 for(const mutate of [p=>p.entry.purpose={bad:true},p=>p.entry.pinned='yes',p=>p.studio.value.layouts.RIGHT0.nodes[0].caption={x:'bad'},p=>p.studio.value.layouts.RIGHT0.edges[0].label={text:{bad:true}},p=>p.studio.value.layouts.RIGHT0.boundaries=[{id:'bad'}]]){
 const p=structuredClone(projection);mutate(p);assert.equal(admitWorkflowDraft(p,context,now).state,'invalid');
 }
});
test('optional native Input binding requires exact bounded identities and an absolute package root',()=>{
 for(const inputBinding of [{workspaceId:'native',packageRoot:'relative',sessionId:'s'},{workspaceId:'native',packageRoot:'/package',sessionId:{}},null])assert.equal(admitWorkflowDraft({...projection,inputBinding},context,now).state,'invalid');
 assert.equal(admitWorkflowDraft({...projection,inputBinding:{workspaceId:'native',packageRoot:'/package',sessionId:'s'}},context,now).state,'valid');
});
