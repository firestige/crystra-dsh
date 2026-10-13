import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
test('default package entry is the backend and obsolete suite exports are absent',async()=>{
 const manifest=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
 assert.equal(manifest.main,'./src/backend/index.js');
 assert.equal(manifest.bin.crystra,'./src/backend/install/cli.js');
 assert.equal(manifest.exports['.'],manifest.main);
 assert.equal(manifest.exports['./client'],'./src/backend/consensus-approval-client.js');
 assert.equal(manifest.dsh.client.platform,'web');
 const plugin=await import('dsh-crystra');
 const backend=await import('../../src/backend/index.js');
 assert.equal(plugin.apply,backend.apply);
 for(const path of ['backend','backend/pi-ai-lifecycle'])await assert.rejects(import('dsh-crystra/'+path),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
});
test('archive contains backend and execution bridge, without bundled legacy suites',()=>{
 const manifest=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
 for(const [name,spec] of Object.entries(manifest.dependencies)){
  assert(!spec.startsWith('file:'),'Published dependency must resolve outside the checkout');
  assert(!/crystra-execution|crystra-ui-core|copilot|codex|langchain|client-ui/.test(name));
 }
 assert.deepEqual(manifest.bundleDependencies??[],[]);
 const pack=JSON.parse(execFileSync('npm',['pack','--dry-run','--json'],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024}))[0];
 const files=pack.files.map(f=>f.path);
 assert(files.includes('src/backend/index.js'));
 assert(files.includes('src/backend/python/capability_bridge.py'));
 assert(files.includes('src/backend/install/cli.js'));
 assert(files.includes('src/backend/install/operations.js'));
 assert(!files.some(f=>/^(node_modules|modules|lib|skills|services)\//.test(f)));
 assert(!files.some(f=>f.startsWith('src/')&&!f.startsWith('src/backend/')));
});
