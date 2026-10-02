import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('DSH 0.1.5 closure uses split Session and UI packages instead of removed client-runtime', async()=>{
 const manifest=JSON.parse(await readFile('package.json','utf8'));
 const lock=JSON.parse(await readFile('package-lock.json','utf8'));
 const policy=JSON.parse(await readFile('config/dsh-compatibility.json','utf8'));
 assert.equal(policy.dsh,'0.1.5-rc.2');
 assert.equal(manifest.peerDependencies['@deepseek-ai/dsh'],policy.dsh);
 assert.equal(manifest.dsh.compatibility.dsh,policy.dsh);
 assert.equal(manifest.dependencies['@deepseek-ai/dsh-client-runtime'],undefined);
 assert.ok(!manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-runtime'));
 for(const name of ['@deepseek-ai/dsh-api-session-controller','@deepseek-ai/dsh-client-ui-session','@deepseek-ai/dsh-client-ui-slots']) assert.ok(manifest.dsh.client.inject.includes(name));
 for(const [name,version] of Object.entries(manifest.dependencies).filter(([name])=>name.startsWith('@deepseek-ai/dsh'))){
  assert.equal(version,policy.dsh,name);
  assert.equal(lock.packages[`node_modules/${name}`]?.version,version,name);
 }
});

test('qualification CLI and profile pin every DSH component to the compatibility policy', async()=>{
 const policy=JSON.parse(await readFile('config/dsh-compatibility.json','utf8'));
 const runtime=JSON.parse(await readFile('config/dsh-qualification-runtime.json','utf8'));
 const lock=JSON.parse(await readFile('package-lock.json','utf8'));
 assert.equal(runtime.dependencies['@deepseek-ai/dsh'],policy.dsh);
 for(const [name,version] of Object.entries(runtime.overrides)) {
  assert.ok(name.startsWith('@deepseek-ai/'),name);
  if(name.startsWith('@deepseek-ai/dsh-')) assert.equal(version,policy.dsh,name);
 }
 for(const [path,entry] of Object.entries(lock.packages)) {
  const name=path.match(/(?:^|\/)node_modules\/(@deepseek-ai\/dsh-[^/]+)$/u)?.[1];
  if(!name)continue;
  assert.equal(runtime.overrides[name],policy.dsh,name);
  assert.equal(entry.version,policy.dsh,path);
 }
});

test('installing the public host requires the runtime used by its Execution provider',async()=>{
 const manifest=JSON.parse(await readFile('package.json','utf8'));
 for(const name of ['dsh','dsh-anonymous-user-id','dsh-attachment','dsh-session-persistence'])assert.equal(manifest.dependencies[`@deepseek-ai/${name}`],'0.1.5-rc.2');
 assert.notEqual(manifest.peerDependenciesMeta?.['@deepseek-ai/dsh']?.optional,true);
 const runtime=JSON.parse(await readFile('config/dsh-qualification-runtime.json','utf8'));
 assert.deepEqual(manifest.overrides,runtime.overrides);
});
