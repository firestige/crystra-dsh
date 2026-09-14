import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {createDraftWorkflowFileGateway} from '../src/host/draft-workflow-file.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('Workflow file gateway binds exact definitions and revokes stale source reads',async()=>{
 const root=await mkdtemp(join(tmpdir(),'crystra-workflow-file-'));try{
 await writeFile(join(root,'design.md'),'source');const lock=JSON.stringify({sourceRoot:root,sources:[{path:'design.md',sha256:sha('source')}]});await writeFile(join(root,'lock.json'),lock);
 const selection={definitionId:'wf',definitionRevision:'r1',workspaceId:'w'};
 const binding={...selection,draftId:'crystra-ui-exploration',revision:'draft.1',environment:'exploration',adapterId:'crystra-workflow-file@1',sourceLockDigest:sha(lock)};
 const projection={binding,provenance:'fixture',expiresAt:'2026-09-16T00:00:00.000Z',snapshotRevision:'s1',entry:{definitionId:'wf',revision:'r1',title:'Workflow',status:'DRAFT',isLatest:true},...Object.fromEntries(['studio','resources','crystallization'].map(k=>[k,{state:'unavailable',reason:'missing'}]))};
 projection.resources={state:'available',value:{workspace:{title:'W',root:'w',version:'r1',files:[{path:'README.md',revision:'resource-r1',content:'Exact content',internal:false,truncated:false}],nodes:[],edges:[]},catalog:[{id:'readme',name:'Readme',path:'README.md',purpose:'',group:'参考资料',aliases:[],files:[{path:'README.md',content:'Exact content',internal:false}]}]}};
 const file=join(root,'workflows.json');await writeFile(file,JSON.stringify({format:'crystra-workflow-file@1',workflows:[{selection,projection}]}));
 const port=createDraftWorkflowFileGateway({file,sourceLockFile:join(root,'lock.json'),sourceLockDigest:sha(lock),allowFixtures:true,now:()=>Date.parse('2026-09-15T00:00:00Z')});
 assert.equal((await port.handle('catalog/read',{})).value.workflows[0].entry.title,'Workflow');
 assert.equal((await port.handle('projection/read',selection)).value.snapshotRevision,'s1');
 assert.equal((await port.handle('projection/read',{...selection,definitionRevision:'latest'})).ok,false);
 projection.inputBinding={workspaceId:'native-w',packageRoot:'/package',sessionId:'native-s'};await writeFile(file,JSON.stringify({format:'crystra-workflow-file@1',workflows:[{selection,projection}]}));
 const request={...selection,resourceId:'readme',path:'README.md',resourceRevision:'resource-r1'};
 assert.equal((await port.handle('resource/read',request)).value.content,'Exact content');
 const {workspaceId,...agentRequest}=request;const authority={sessionKey:'native-s',workspaceId:'native-w',path:'/package'};
 assert.equal((await port.readForSession(agentRequest,authority)).value.content,'Exact content');
 assert.equal((await port.readForSession(agentRequest,{...authority,sessionKey:'foreign'})).ok,false);
 assert.equal((await port.readForSession(agentRequest,{...authority,path:'/other'})).ok,false);
 assert.equal((await port.handle('resource/read',{...request,resourceRevision:'latest'})).ok,false);
 assert.equal((await port.handle('resource/read',{...request,path:'../README.md'})).ok,false);
 await writeFile(join(root,'design.md'),'changed');assert.equal((await port.handle('catalog/read',{})).ok,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
