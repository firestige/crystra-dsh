import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {initializeHost} from '../src/host.js';
import {normalizePluginConfiguration} from '../src/configuration.js';
test('first Host initialization is light; setup creates execution configuration and reports unavailable service assets',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'crystra-host-init-'));
 try {
  let activations=0;
  const host=await initializeHost(normalizePluginConfiguration({stateRoot:root}),{activateExecution:async()=>{activations++;},loadDescriptor:async()=>{throw Object.assign(new Error("fixture descriptor absent"),{code:"ENOENT"});}});
  assert.equal(activations,0);
  assert.equal((await host.operate('doctor')).status,'NEEDS_CONFIGURATION');
  const result=await host.operate('setup');
  assert.equal(activations,1);
  assert.equal(result.status,'DEGRADED');
  assert.equal(result.code,'CRYSTRA_SERVICE_DESCRIPTOR_UNAVAILABLE');
  assert.ok(result.diagnostics.some(item=>item.code==='CRYSTRA_ROLE_BINDINGS_REQUIRED'));
  const execution=JSON.parse(await readFile(path.join(root,'execution.json'),'utf8'));
  assert.equal(execution.schemaVersion,'execution.config@2.0.0');
  assert.equal(execution.observation.serviceName,'crystra-dsh');
  await host.operate('setup');assert.equal(activations,1);
  await host.dispose();
 }finally{await rm(root,{recursive:true,force:true});}
});
