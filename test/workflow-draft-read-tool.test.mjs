import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkflowDraftReadTool} from '../src/host/workflow-draft-read-tool.js';
test('Agent reads are bounded, preserve exact revision and require live workspace authority',async()=>{
 const agent={id:'s'},authority={sessionKey:'s',workspaceId:'w',path:'/p'};let reads=0;
 const tool=createWorkflowDraftReadTool({resolveWorkspace:async current=>{assert.equal(current,agent);return authority;},gateway:{readForSession:async(request,scope)=>{reads++;assert.equal(scope,authority);assert.equal(request.resourceRevision,'r1');return {ok:true,value:{revision:'r1',content:'a'.repeat(12000),authority:'draft',provenance:'fixture'}};}}});
 const request={definitionId:'wf',definitionRevision:'r1',resourceId:'r',path:'file.md',resourceRevision:'r1'};
 const result=await tool.execute(request,{agent,signal:new AbortController().signal});assert.equal(result.content.length,10000);assert.equal(result.nextOffset,10000);assert.equal(result.revision,'r1');
 const last=await tool.execute({...request,offset:10000},{agent});assert.equal(last.content.length,2000);assert.equal(last.nextOffset,null);
 await assert.rejects(()=>tool.execute(request,{}),/DRAFT_SESSION_UNAVAILABLE/);assert.equal(reads,2);
});
