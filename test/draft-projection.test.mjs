import test from 'node:test';
import assert from 'node:assert/strict';
import {admitDraftProjection} from '../src/client/draft-projection.js';
const now=Date.parse('2026-09-14T12:00:00.000Z');
function example(){
 const context={draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),environment:'exploration',taskId:'task-a',goalRevision:'goal-1',planRevision:null,accessAllowed:true,adapterId:'isolated-task-adapter',allowFixtures:false};
 const {accessAllowed,allowFixtures,...binding}=context;
 const response={binding,snapshotRevision:'snapshot-1',expiresAt:'2026-09-14T12:01:00.000Z',provenance:'service',surfaces:Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(name=>[name,{state:'unavailable',reason:'OWNER_INTERFACE_MISSING'}]))};
 return {context,response};
}
test('admits only explicitly bound draft read projections; missing owner stays unavailable',()=>{
 const {context,response}=example();const actual=admitDraftProjection(response,context,now);
 assert.equal(actual.state,'valid');assert.equal(actual.projection.surfaces.delivery.state,'unavailable');
 assert.equal(actual.authority,'draft');
});
test('invalidates drift, revision mismatch, permission loss and expired snapshots without old values',()=>{
 const changes=[['revision','draft.2'],['taskId','other'],['goalRevision','goal-2'],['planRevision','plan-1'],['sourceLockDigest','b'.repeat(64)],['adapterId','other'],['environment','production'],['accessAllowed',false]];
 for(const [key,value] of changes){
  const {context,response}=example();context[key]=value;
  const actual=admitDraftProjection(response,context,now);
  assert.equal(actual.state,'invalid',key);assert.equal('projection' in actual,false,key);
 }
 const {context,response}=example();
 assert.equal(admitDraftProjection(response,context,Date.parse(response.expiresAt)).state,'invalid');
});
test('rejects fixture unless the exploration consumer explicitly opts in',()=>{
 const {context,response}=example();response.provenance='fixture';
 assert.equal(admitDraftProjection(response,context,now).state,'invalid');
 context.allowFixtures=true;
 assert.equal(admitDraftProjection(response,context,now).state,'valid');
 context.environment='production';response.binding.environment='production';
 assert.equal(admitDraftProjection(response,context,now).state,'invalid');
});
test('rejects incomplete or malformed bindings, time, and surface states',()=>{
 const mutations=[r=>delete r.surfaces.gate,r=>r.surfaces.gate={state:'available'},r=>r.surfaces.delivery={state:'unavailable'},r=>r.expiresAt='tomorrow',r=>r.expiresAt='2026-02-30T12:00:00.000Z',r=>r.provenance='guessed',r=>r.binding.taskId='',r=>r.snapshotRevision='',r=>r.surfaces.extra={},r=>r.surfaces.gate={state:'available',value:null},r=>r.surfaces.gate={state:'unavailable',reason:'missing',value:{approved:true}}];
 for(const change of mutations){const {context,response}=example();change(response);assert.equal(admitDraftProjection(response,context,now).state,'invalid');}
 const {context,response}=example();context.accessAllowed=undefined;
 assert.equal(admitDraftProjection(response,context,now).state,'invalid');
 assert.equal(admitDraftProjection(null,context,now).state,'invalid');
});
test('a future draft cannot opt itself in by matching an unsupported context',()=>{
 const {context,response}=example();context.revision='draft.2';response.binding.revision='draft.2';
 assert.equal(admitDraftProjection(response,context,now).state,'invalid');
});
test('available draft surfaces require their full consumer shape before admission',()=>{
 const {context,response}=example();response.surfaces.grilling={state:'available',value:{}};
 assert.equal(admitDraftProjection(response,context,now).reason,'INVALID_SURFACE_VALUE');
 response.surfaces.grilling.value={heading:'h',summary:'s',briefSummary:'b',topics:[],fields:[],changes:[]};
 assert.equal(admitDraftProjection(response,context,now).state,'valid');
});
test('native Task Input accepts only a bounded explicit workspace path and session binding',()=>{
 const {context,response}=example();response.inputBinding={workspaceId:'w1',packageRoot:'/private/tmp/task1',sessionId:'s1'};
 assert.equal(admitDraftProjection(response,context,now).state,'valid');
 for(const bad of [{...response.inputBinding,sessionId:''},{...response.inputBinding,packageRoot:'relative'},{...response.inputBinding,packageRoot:'/private/tmp/../other'},{...response.inputBinding,permission:'write'}])assert.equal(admitDraftProjection({...response,inputBinding:bad},context,now).reason,'INVALID_INPUT_BINDING');
});
