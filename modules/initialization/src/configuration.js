import {randomUUID} from 'node:crypto';
import {link, mkdir, readFile, unlink, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function resolveCrystraPaths({platform=process.platform,home=os.homedir(),env=process.env,pathApi=path}={}) {
  const absoluteOr=(candidate,fallback)=>typeof candidate==='string'&&pathApi.isAbsolute(candidate)?candidate:fallback;
  if(platform==='darwin') {
    const root=pathApi.join(home,'Library','Application Support','Crystra');
    return {configFile:pathApi.join(root,'config.json'),stateRoot:pathApi.join(root,'state')};
  }
  if(platform==='win32')return {
    configFile:pathApi.join(absoluteOr(env.APPDATA,pathApi.join(home,'AppData','Roaming')),'Crystra','config.json'),
    stateRoot:pathApi.join(absoluteOr(env.LOCALAPPDATA,pathApi.join(home,'AppData','Local')),'Crystra','state'),
  };
  return {
    configFile:pathApi.join(absoluteOr(env.XDG_CONFIG_HOME,pathApi.join(home,'.config')),'crystra','config.json'),
    stateRoot:pathApi.join(absoluteOr(env.XDG_STATE_HOME,pathApi.join(home,'.local','state')),'crystra'),
  };
}
function invalid(field) {throw new TypeError(`CRYSTRA_CONFIG_INVALID: ${field}`);}
function object(value,allowed,field) {
  if(value===null||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))invalid(field);
}
function absolute(value,field) {if(typeof value!=='string'||!path.isAbsolute(value))invalid(field);return path.resolve(value);}
export function normalizePluginConfiguration(input={}) {
  object(input,['stateRoot','execution','services','studio','exploration'],'root');
  const paths=input.stateRoot===undefined?resolveCrystraPaths():{
    stateRoot:absolute(input.stateRoot,'stateRoot'),configFile:path.join(absolute(input.stateRoot,'stateRoot'),'config.json'),
  };
  const services=input.services??{};
  object(services,['ports'],'services');
  object(services.ports??{},['evidence','evolution'],'services.ports');
  const ports={evidence:4318,evolution:8000,...services.ports};
  for(const [id,port] of Object.entries(ports))if(!Number.isInteger(port)||port<1024||port>65535)invalid(`services.ports.${id}`);
  if(ports.evidence===ports.evolution)invalid('services.ports.duplicate');
  let exploration;
  if(input.exploration!==undefined){
    const value=input.exploration;object(value,['taskFile','workflowFile','resourceDraftRoot','allowResourceWrites','sourceLockFile','sourceLockDigest','allowFixtures'],'exploration');
    if(!/^[a-f0-9]{64}$/.test(value.sourceLockDigest??'')||typeof value.allowFixtures!=='boolean')invalid('exploration');
    if(value.taskFile===undefined&&value.workflowFile===undefined)invalid('exploration');
    if(value.allowResourceWrites!==undefined&&typeof value.allowResourceWrites!=='boolean')invalid('exploration.allowResourceWrites');
    if((value.resourceDraftRoot!==undefined||value.allowResourceWrites===true)&&value.workflowFile===undefined)invalid('exploration.workflowFile');
    if(value.allowResourceWrites===true&&value.resourceDraftRoot===undefined)invalid('exploration.resourceDraftRoot');
    exploration=Object.freeze({...value.resourceDraftRoot!==undefined?{resourceDraftRoot:absolute(value.resourceDraftRoot,'exploration.resourceDraftRoot')}:{},...value.allowResourceWrites!==undefined?{allowResourceWrites:value.allowResourceWrites}:{},...value.taskFile!==undefined?{taskFile:absolute(value.taskFile,'exploration.taskFile')}:{},...value.workflowFile!==undefined?{workflowFile:absolute(value.workflowFile,'exploration.workflowFile')}:{},sourceLockFile:absolute(value.sourceLockFile,'exploration.sourceLockFile'),sourceLockDigest:value.sourceLockDigest,allowFixtures:value.allowFixtures});
  }
  let execution;
  if(input.execution!==undefined) {
    object(input.execution,['configFile','bindingFile'],'execution');
    execution={configFile:absolute(input.execution.configFile,'execution.configFile'),bindingFile:absolute(input.execution.bindingFile,'execution.bindingFile')};
  }
  // Retained adapter configuration for explicit development/qualification profiles.
  // Normal setup derives Studio endpoints from the unified service description.
  if(input.studio!==undefined)object(input.studio,['hostConfigFile','hostConfig','evidenceBaseUrl','evolutionBaseUrl'],'studio');
  return Object.freeze({paths:Object.freeze(paths),services:Object.freeze({ports:Object.freeze(ports)}),execution,studio:input.studio,exploration});
}

export async function initializeConfiguration(configuration) {
  const {configFile,stateRoot}=configuration.paths;
  await mkdir(path.dirname(configFile),{recursive:true,mode:0o700});
  await mkdir(stateRoot,{recursive:true,mode:0o700});
  const temporary=`${configFile}.${randomUUID()}.new`;
  const value={schemaVersion:'crystra.plugin-config@1.0.0',status:'NEEDS_CONFIGURATION',services:configuration.services};
  // Publish complete bytes exclusively: concurrent first loads cannot overwrite
  // a user file, and readers cannot observe partially written JSON.
  try {
    await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`,{flag:'wx',mode:0o600});
    try {await link(temporary,configFile);}catch(error){if(error.code!=='EEXIST')throw error;}
  }finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  return JSON.parse(await readFile(configFile,'utf8'));
}
