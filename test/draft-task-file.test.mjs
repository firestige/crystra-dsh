import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createDraftTaskFileGateway} from '../src/host/draft-task-file.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'crystra-draft-file-'));const source=join(root,'design.md');await writeFile(source,'accepted design');
 const lock=JSON.stringify({sourceRoot:root,sources:[{path:'design.md',sha256:sha('accepted design')}]});await writeFile(join(root,'lock.json'),lock);
 const selection={taskId:'draft-task',goalRevision:'goal-1',planRevision:null};
 const binding={...selection,draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:sha(lock),environment:'exploration',adapterId:'crystra-task-file@1'};
 const projection={binding,snapshotRevision:'snapshot-1',expiresAt:'2026-09-16T00:00:00.000Z',provenance:'fixture',surfaces:Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(k=>[k,{state:'unavailable',reason:'not provided'}]))};
 const document={format:'crystra-task-file@1',tasks:[{selection,projection}]};const file=join(root,'tasks.json');await writeFile(file,JSON.stringify(document));
 const options={file,sourceLockFile:join(root,'lock.json'),sourceLockDigest:sha(lock),allowFixtures:true,now:()=>Date.parse('2026-09-15T00:00:00.000Z')};
 return {root,source,file,document,options,selection};
}
test('configured file gateway exposes exact admitted draft selections and rejects mismatched requests',async()=>{
 const f=await setup();try{const port=createDraftTaskFileGateway(f.options);
 const catalog=await port.handle('catalog/read',{});assert.equal(catalog.ok,true);assert.equal(catalog.value.tasks[0].context.taskId,'draft-task');
 const read=await port.handle('projection/read',f.selection);assert.equal(read.ok,true);assert.equal(read.value.provenance,'fixture');
 assert.equal((await port.handle('projection/read',{...f.selection,goalRevision:'other'})).ok,false);
 assert.equal((await port.handle('projection/read',{...f.selection,path:'/etc/passwd'})).ok,false);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
test('source drift, expiry and unapproved fixtures revoke reads without cached fallback',async()=>{
 const f=await setup();try{assert.equal((await createDraftTaskFileGateway({...f.options,allowFixtures:false}).handle('catalog/read',{})).ok,false);
 assert.equal((await createDraftTaskFileGateway({...f.options,now:()=>Date.parse('2026-09-17T00:00:00Z')}).handle('catalog/read',{})).ok,false);
 const port=createDraftTaskFileGateway(f.options);assert.equal((await port.handle('catalog/read',{})).ok,true);
 await writeFile(f.source,'changed');assert.equal((await port.handle('catalog/read',{})).ok,false);
 }finally{await rm(f.root,{recursive:true,force:true});}
});
