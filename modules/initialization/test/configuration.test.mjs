import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {resolveCrystraPaths, normalizePluginConfiguration, initializeConfiguration} from '../src/configuration.js';

test('platform paths keep Crystra config and state out of WSR directories', () => {
  assert.deepEqual(resolveCrystraPaths({platform:'darwin',home:'/home/user',env:{}}), {
    configFile:'/home/user/Library/Application Support/Crystra/config.json',
    stateRoot:'/home/user/Library/Application Support/Crystra/state',
  });
  assert.deepEqual(resolveCrystraPaths({platform:'linux',home:'/home/user',env:{XDG_CONFIG_HOME:'/config',XDG_STATE_HOME:'/state'}}), {
    configFile:'/config/crystra/config.json',stateRoot:'/state/crystra',
  });
  assert.deepEqual(resolveCrystraPaths({platform:'win32',home:'C:\\Users\\u',env:{APPDATA:'C:\\Roaming',LOCALAPPDATA:'C:\\Local'},pathApi:path.win32}), {
    configFile:'C:\\Roaming\\Crystra\\config.json',stateRoot:'C:\\Local\\Crystra\\state',
  });
});

test('relative XDG variables fall back to home instead of the current directory', () => {
  assert.equal(resolveCrystraPaths({platform:'linux',home:'/home/u',env:{XDG_STATE_HOME:'relative'}}).stateRoot,'/home/u/.local/state/crystra');
});

test('default config is light and explicit roots isolate all generated files', () => {
  const value=normalizePluginConfiguration({stateRoot:'/tmp/crystra-isolated'});
  assert.equal(value.paths.configFile,'/tmp/crystra-isolated/config.json');
  assert.deepEqual(value.services.ports,{evidence:4318,evolution:8000});
  assert.equal(value.execution,undefined);
});

test('config rejects unknown fields, relative roots, unsafe ports and image overrides', () => {
  for(const input of [null,[],{stateRoot:'relative'},{other:true},{services:{image:'mutable:latest'}},{services:{ports:{evidence:0}}},{services:{ports:{evidence:8000}}},{execution:{configFile:'/tmp/a',bindingFile:'relative'}},{execution:{configFile:'/tmp/a',bindingFile:'/tmp/b',extra:true}}]) {
    assert.throws(()=>normalizePluginConfiguration(input),/CRYSTRA_CONFIG_INVALID/);
  }
});

test('first load creates private configuration without declaring services ready or overwriting edits', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'crystra-init-'));
  try {
    const config=normalizePluginConfiguration({stateRoot:root});
    const initial=await initializeConfiguration(config);
    assert.equal(initial.status,'NEEDS_CONFIGURATION');
    assert.equal(initial.schemaVersion,'crystra.plugin-config@1.0.0');
    if(process.platform!=='win32')assert.equal((await stat(config.paths.configFile)).mode&0o777,0o600);
    const edited={...initial,note:'user edit'};
    await writeFile(config.paths.configFile,JSON.stringify(edited));
    await Promise.all([initializeConfiguration(config),initializeConfiguration(config)]);
    assert.deepEqual(JSON.parse(await readFile(config.paths.configFile,'utf8')),edited);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('task exploration is disabled by default and requires explicit absolute sources and a digest',()=>{
 assert.equal(normalizePluginConfiguration({}).exploration,undefined);
 const value={taskFile:'/tmp/tasks.json',sourceLockFile:'/tmp/lock.json',sourceLockDigest:'a'.repeat(64),allowFixtures:true};
 assert.deepEqual(normalizePluginConfiguration({exploration:value}).exploration,value);
 for(const invalid of [{...value,taskFile:'relative'},{...value,sourceLockDigest:'latest'},{...value,allowFixtures:'true'},{...value,extra:true}])assert.throws(()=>normalizePluginConfiguration({exploration:invalid}),/CRYSTRA_CONFIG_INVALID/);
});

test('Workflow-only exploration requires pinned sources and at least one configured projection',()=>{
 const value={workflowFile:'/tmp/workflows.json',sourceLockFile:'/tmp/lock.json',sourceLockDigest:'a'.repeat(64),allowFixtures:false};
 assert.deepEqual(normalizePluginConfiguration({exploration:value}).exploration,value);
 const {workflowFile,...empty}=value;assert.throws(()=>normalizePluginConfiguration({exploration:empty}),/CRYSTRA_CONFIG_INVALID/);
 assert.throws(()=>normalizePluginConfiguration({exploration:{...value,workflowFile:'relative'}}),/CRYSTRA_CONFIG_INVALID/);
});
test('resource authoring needs an explicit isolated root and boolean write opt-in',()=>{
 const value={workflowFile:'/tmp/w.json',sourceLockFile:'/tmp/lock.json',sourceLockDigest:'a'.repeat(64),allowFixtures:true,resourceDraftRoot:'/tmp/candidates',allowResourceWrites:true};
 assert.deepEqual(normalizePluginConfiguration({exploration:value}).exploration,value);
 for(const changed of [{...value,resourceDraftRoot:'relative'},{...value,resourceDraftRoot:undefined},{...value,allowResourceWrites:'true'}])assert.throws(()=>normalizePluginConfiguration({exploration:changed}),/CRYSTRA_CONFIG_INVALID/);
});
test('native resource notifications require explicit authoring and notification opt-in',()=>{
 const value={workflowFile:'/tmp/w.json',sourceLockFile:'/tmp/lock.json',sourceLockDigest:'a'.repeat(64),allowFixtures:true,resourceDraftRoot:'/tmp/candidates',allowResourceWrites:true,allowResourceNotifications:true};
 assert.equal(normalizePluginConfiguration({exploration:value}).exploration.allowResourceNotifications,true);
 for(const changed of [{...value,allowResourceWrites:false},{...value,allowResourceNotifications:'true'}])assert.throws(()=>normalizePluginConfiguration({exploration:changed}),/CRYSTRA_CONFIG_INVALID/);
});
