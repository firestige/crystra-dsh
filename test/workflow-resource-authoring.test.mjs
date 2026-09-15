import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createWorkflowResourceAuthoring} from '../src/host/workflow-resource-authoring.js';
test('configured Workflow candidates survive reopening, remain separate from source, and revoke on source changes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-wf-authoring-'));try{
 const workflow={context:{environment:'exploration',draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),workspaceId:'w',definitionId:'wf',definitionRevision:'r1'},projection:{snapshotRevision:'s1',resources:{state:'available',value:{workspace:{files:[{path:'a.md',content:'source',truncated:false}]},catalog:[{id:'r',files:[{path:'a.md'}]}]}}}};
 let current=workflow;const options={root,workflow,writeAllowed:true,loadCurrent:async()=>current};const port=createWorkflowResourceAuthoring(options);
 assert.equal((await port.list())[0].content,'source');const proposal={proposalId:'p1',resourceId:'r',path:'a.md',baseRevision:'s1',baseContent:'source',content:'draft'};
 const saved=await port.save(proposal);assert.equal(saved.content,'draft');assert.equal(workflow.projection.resources.value.workspace.files[0].content,'source');
 const reopened=createWorkflowResourceAuthoring(options);assert.equal((await reopened.list())[0].revision,saved.revision);assert.equal((await reopened.readRevision('r','a.md','s1')).content,'source');assert.equal((await reopened.readRevision('r','a.md',saved.revision)).content,'draft');
 current={...workflow,projection:{...workflow.projection,snapshotRevision:'s2'}};await assert.rejects(port.save({...proposal,proposalId:'p2'}),/DRAFT_SOURCE_CHANGED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
