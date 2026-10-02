#!/usr/bin/env node
// Development-only real Compose qualification. Not a published artifact gate.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import {validateDevelopmentImage} from './lib/development-services.mjs';
import {createComposeAdapter,serviceNamespace} from '../modules/initialization/src/compose-adapter.js';
import {initializeHost} from '../modules/initialization/src/host.js';
import {normalizePluginConfiguration} from '../modules/initialization/src/configuration.js';
import {realpath} from 'node:fs/promises';
const inputs=JSON.parse(await readFile(new URL('../config/development-services.json',import.meta.url),'utf8'));
const images={postgres:inputs.postgres,evidence:inputs.evidence.image,evolution:inputs.evolution.image};
const ids=Object.fromEntries(Object.entries(images).map(([name,image])=>{
 const inspected=JSON.parse(execFileSync('docker',['image','inspect',image],{encoding:'utf8'}))[0];
 return [name,name==='postgres'?inspected.Id:validateDevelopmentImage(inspected,inputs[name])];
}));
const root=await realpath(await mkdtemp(path.join(tmpdir(),'crystra-service-qualification-')));
const stateRoot=path.join(root,'state');await mkdir(stateRoot);
const namespace=serviceNamespace(stateRoot);
const ports={evidence:Number(process.env.CRYSTRA_TEST_EVIDENCE_PORT??25318),evolution:Number(process.env.CRYSTRA_TEST_EVOLUTION_PORT??29000)};
let lifecycle;
try {
 const directory='crystra-services-0.1.0';const bundle=path.join(root,directory);await mkdir(bundle);
 for(const name of ['compose.template.yaml','crystra-compose.template','init-roles.sh','crystra-host-preflight.mjs','run-with-timeout.mjs','host-endpoints.template.json','evolution.config.json']) {
  let content=await readFile(new URL(`../services/${name}`,import.meta.url),'utf8');
  for(const [marker,value] of Object.entries({'@POSTGRES_IMAGE@':ids.postgres,'@EVIDENCE_IMAGE@':ids.evidence,'@EVOLUTION_IMAGE@':ids.evolution,'@BUNDLE_VERSION@':'0.1.0-dev'}))content=content.replaceAll(marker,value);
  // This fixture uses local immutable image IDs; it does not claim registry or
  // multi-platform qualification. Production templates always pull exact digests.
  content=content.replace('compose pull || return $?','true # development fixture: local immutable image IDs');
  const filename=name==='compose.template.yaml'?'compose.yaml':(name==='crystra-compose.template'?'crystra-compose':name);
  await writeFile(path.join(bundle,filename),content,{mode:0o700});
 }
 await writeFile(path.join(bundle,'release.json'),JSON.stringify({schemaVersion:'crystra.services-development@1.0.0',images:ids}));
 const archive=path.join(root,'services.tgz');await tar.c({file:archive,cwd:root,gzip:true},[directory]);
 const bytes=await readFile(archive);
 const descriptor={schemaVersion:'crystra.services@1.0.0',directory,sha256:createHash('sha256').update(bytes).digest('hex'),url:'https://github.com/firestige/crystra/releases/download/crystra-services-v0.1.0-rc.1/crystra-services-0.1.0.tar.gz'};
 const adapter=createComposeAdapter({stateRoot,ports,descriptor,fetchImpl:async(url,options)=>url===descriptor.url?new Response(bytes):fetch(url,options)});
 lifecycle=await initializeHost(normalizePluginConfiguration({stateRoot,services:{ports}}),{loadDescriptor:async()=>descriptor,makeAdapter:()=>adapter,activateExecution:async(profile)=>{const configuration=JSON.parse(await readFile(profile.configFile,'utf8'));if(configuration.schemaVersion!=='execution.config@2.0.0')throw new Error('EXECUTION_CONFIG_INVALID');const bindingDirectory=path.join(configuration.paths.repositoryRoot,'.crystra');await mkdir(bindingDirectory,{recursive:true});await writeFile(path.join(bindingDirectory,'role-provider-bindings.json'),JSON.stringify({schemaVersion:'execution.repository-role-provider-bindings@1.0.0',bindings:{'role.greeter':{agentProvider:{identity:'provider.codex',version:'0.144.5'},model:{provider:'openai',model:'gpt-5.6-sol'}}}}));}});
 const setup=await lifecycle.operate('setup');if(setup.status!=='READY')throw new Error(`SETUP_FAILED: ${JSON.stringify(setup)}`);
 if((await lifecycle.operate('doctor')).status!=='READY')throw new Error('DOCTOR_FAILED');
 // The old service bundle starts successfully but lacks recorded-time queries.
 // Probe the current UI query contract against the real empty database.
 const recordedTo=new Date().toISOString();
 const recordedFrom=new Date(Date.now()-60_000).toISOString();
 const bounds=new URLSearchParams({recorded_from:recordedFrom,recorded_to:recordedTo,limit:'10'});
 for(const route of ['traces','deliveries']) {
  const response=await fetch(`http://127.0.0.1:${ports.evidence}/v1/evidence/${route}?${bounds}`,{signal:AbortSignal.timeout(10_000)});
  const result=await response.json();
  if(!response.ok || !Array.isArray(result.items) || result.items.length!==0)throw new Error(`RECORDED_QUERY_FAILED: ${route} ${response.status}`);
  if(route==='deliveries' && result.contract?.name!=='evidence.delivery-directory')throw new Error('DELIVERY_DIRECTORY_CONTRACT_MISMATCH');
 }
 const evaluation=await fetch(`http://127.0.0.1:${ports.evolution}/api/evolution/v1/evaluations:compute`,{
  method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(20_000),
  body:JSON.stringify({api_version:1,mode:'SINGLE',selection:{selection_version:2,recorded_from:recordedFrom,recorded_to:recordedTo}}),
 });
 const computed=await evaluation.json();
 if(!evaluation.ok || computed.result?.receipt?.context_version!==2 || !Array.isArray(computed.result?.metric_results) || computed.result.metric_results.length===0)throw new Error(`RECORDED_EVALUATION_FAILED: ${evaluation.status}`);
 if((await lifecycle.operate('stop')).status!=='STOPPED')throw new Error('STOP_FAILED');
 if((await lifecycle.operate('doctor')).status!=='DEGRADED')throw new Error('STOPPED_READINESS_FAILED');
 execFileSync('docker',['volume','inspect',namespace.volume],{stdio:'ignore'});
 if((await lifecycle.operate('start')).status!=='READY')throw new Error('RESTART_FAILED');
 await lifecycle.dispose();
 if((await adapter.inspect()).ready!==true)throw new Error('DISPOSE_STOPPED_SERVICES');
 console.log(JSON.stringify({qualification:'development-only',status:'PASS',images:ids,sources:{evidence:inputs.evidence.revision,evolution:inputs.evolution.revision},ports,checks:['setup','doctor','recorded-time-traces','recorded-time-deliveries','recorded-time-evaluation','stop','preserve-volume','restart','dispose-preserve-running']},null,2));
}catch(error){
 try{console.error(await readFile(path.join(stateRoot,'services-last-error.log'),'utf8'));}catch{}
 throw error;
}finally {
 await lifecycle?.dispose();
 // Delete only this script's random state-root namespace and its test volume.
 const containers=execFileSync('docker',['ps','-aq','--filter',`label=com.docker.compose.project=${namespace.project}`],{encoding:'utf8'}).trim().split(/\s+/u).filter(Boolean);
 if(containers.length)execFileSync('docker',['rm','-f',...containers],{stdio:'ignore'});
 const networks=execFileSync('docker',['network','ls','-q','--filter',`label=com.docker.compose.project=${namespace.project}`],{encoding:'utf8'}).trim().split(/\s+/u).filter(Boolean);
 if(networks.length)execFileSync('docker',['network','rm',...networks],{stdio:'ignore'});
 try{execFileSync('docker',['volume','rm',namespace.volume],{stdio:'ignore'});}catch{}
 await rm(root,{recursive:true,force:true});
}
