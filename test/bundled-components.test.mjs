import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {packWorkspaces} from '../scripts/lib/package-artifacts.mjs';
const root=resolve(import.meta.dirname,'..');
test('installable plugin bundles only the exact first-party packages, leaving platform dependencies to the host',async()=>{
 const output=await mkdtemp(join(tmpdir(),'crystra-bundle-test-'));
 try{
  const [archive]=await packWorkspaces({root,output});
  const files=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n');
  const bundled=files.filter(file=>file.startsWith('package/node_modules/'));
  assert.ok(bundled.length>0);
  assert.ok(bundled.every(file=>/^package\/node_modules\/crystra-(execution|ui-core)\//.test(file)&&!file.includes('/node_modules/',21)));
  const manifest=JSON.parse(execFileSync('tar',['-xOf',archive,'package/package.json'],{encoding:'utf8'}));
  for(const name of ['crystra-execution','crystra-ui-core']){
   const owner=JSON.parse(execFileSync('tar',['-xOf',archive,`package/node_modules/${name}/package.json`],{encoding:'utf8'}));
   assert.deepEqual(owner,JSON.parse(await readFile(join(root,'node_modules',name,'package.json'),'utf8')));
   for(const [dependency,version] of Object.entries(owner.dependencies??{}))assert.equal(manifest.dependencies[dependency],version);
  }
 }finally{await rm(output,{recursive:true,force:true});}
});
