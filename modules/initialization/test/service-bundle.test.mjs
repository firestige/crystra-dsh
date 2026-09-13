import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as tar from 'tar';
import {prepareServiceBundle} from '../src/service-bundle.js';
async function fixture(run,{unsafe=false}={}) {
 const root=await mkdtemp(path.join(os.tmpdir(),'crystra-bundle-'));
 try {
  const source=path.join(root,'source');await mkdir(path.join(source,'crystra-services-0.1.0'),{recursive:true});
  for(const file of ['crystra-compose','compose.yaml','release.json'])await writeFile(path.join(source,'crystra-services-0.1.0',file),'fixture');
  if(unsafe)await symlink('/tmp',path.join(source,'crystra-services-0.1.0','escape'));
  const archive=path.join(root,'bundle.tgz');await tar.c({cwd:source,file:archive,gzip:true},['crystra-services-0.1.0']);
  const bytes=await readFile(archive);
  const descriptor={schemaVersion:'crystra.services@1.0.0',sha256:createHash('sha256').update(bytes).digest('hex'),directory:'crystra-services-0.1.0',url:'https://github.com/firestige/crystra/releases/download/crystra-services-v0.1.0-rc.1/crystra-services-0.1.0.tar.gz'};
  await run({root,bytes,descriptor});
 }finally{await rm(root,{recursive:true,force:true});}
}
test('downloads exact bytes and stages service files under the descriptor identity',async()=>fixture(async({root,bytes,descriptor})=>{
 const result=await prepareServiceBundle({stateRoot:root,descriptor,fetchImpl:async()=>new Response(bytes)});
 assert.equal(await readFile(path.join(result,'compose.yaml'),'utf8'),'fixture');
 assert.ok(result.startsWith(path.join(root,'managed',descriptor.sha256)));
}));
test('a digest mismatch never activates a downloaded service bundle',async()=>fixture(async({root,bytes,descriptor})=>{
 await assert.rejects(prepareServiceBundle({stateRoot:root,descriptor:{...descriptor,sha256:'0'.repeat(64)},fetchImpl:async()=>new Response(bytes)}),/CRYSTRA_SERVICE_DIGEST_MISMATCH/);
}));
test('rejects links inside a correctly hashed service archive',async()=>fixture(async({root,bytes,descriptor})=>{
 await assert.rejects(prepareServiceBundle({stateRoot:root,descriptor,fetchImpl:async()=>new Response(bytes)}),/CRYSTRA_SERVICE_ARCHIVE_INVALID/);
},{unsafe:true}));
test('does not accept mutable or non-GitHub service coordinates',async()=>fixture(async({root,descriptor})=>{
 await assert.rejects(prepareServiceBundle({stateRoot:root,descriptor:{...descriptor,url:'http://localhost/latest'}}),/CRYSTRA_SERVICE_DESCRIPTOR_INVALID/);
}));
