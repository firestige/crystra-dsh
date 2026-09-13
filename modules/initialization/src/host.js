import {link,mkdir,readFile,realpath,unlink,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {initializeConfiguration} from './configuration.js';
import {createComposeAdapter} from './compose-adapter.js';
import {createServiceLifecycle} from './service-lifecycle.js';

async function writeOnce(file,value) {
 const temporary=`${file}.${randomUUID()}.new`;
 try {
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
  try{await link(temporary,file);}catch(error){if(error.code!=='EEXIST')throw error;}
 }finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
export async function prepareExecutionConfiguration(configuration) {
 if(configuration.execution)return configuration.execution;
 const root=configuration.paths.stateRoot;
 const workspace=path.join(root,'managed','workspace-root');
 const stateRoot=path.join(root,'durable','execution');
 await mkdir(workspace,{recursive:true,mode:0o700});await mkdir(stateRoot,{recursive:true,mode:0o700});
 const repository=await realpath(workspace);
 const configFile=path.join(root,'execution.json');
 await writeOnce(configFile,{
  schemaVersion:'execution.config@2.0.0',
  paths:{repositoryRoot:repository,workspaceRoot:repository,allowedWorktreeRoots:[repository],stateRoot:await realpath(stateRoot)},
  workflowSource:{kind:'github',repository:'firestige/crystra-workflow-package',releasesBaseUrl:'https://api.github.com/repos/firestige/crystra-workflow-package/releases',assetPattern:'workflow-package-{name}-{version}.tar.gz'},
  runner:{implementationKey:'runner.v2',host:{engine:'langgraph'},maxParallelToolCalls:2},
  observation:{enabled:true,endpoint:`http://127.0.0.1:${configuration.services.ports.evidence}`,timeoutMs:1000,maxBatchRecords:64,maxBatchBytes:262144,flushIntervalMs:1000,shutdownFlushMs:5000,serviceName:'crystra-dsh'},
  controls:{startupTimeoutMs:30000,executionTimeoutMs:7200000,shutdownTimeoutMs:10000,maxConcurrentDeliveries:1,allowExplicitRefresh:false,diagnosticMaxBytes:4096},
  intake:{maxCorrelationBytes:256,maxOutputBytes:8192},
 });
 return {configFile,bindingFile:path.join(root,'intake-bindings.json')};
}
export async function initializeHost(configuration,{activateExecution,loadDescriptor=async()=>JSON.parse(await readFile(new URL('./service-descriptor.json',import.meta.url),'utf8')),makeAdapter=createComposeAdapter}={}) {
 await initializeConfiguration(configuration);
 let executionReady=false,services,setupPending,activeProfile;
 const disposal=new AbortController();
 async function activate(profile) {
  if(executionReady)return;
  await activateExecution(profile);activeProfile=profile;executionReady=true;
 }
 // Previously generated configuration is a new-brand input only. No .wsr fallback.
 if(configuration.execution)await activate(configuration.execution);
 else {
  try {
   await readFile(path.join(configuration.paths.stateRoot,'execution.json'),'utf8');
   await activate({configFile:path.join(configuration.paths.stateRoot,'execution.json'),bindingFile:path.join(configuration.paths.stateRoot,'intake-bindings.json')});
  }catch(error){if(error.code!=='ENOENT')throw error;}
 }
 async function lifecycle() {
  if(services)return services;
  let descriptor;
  try{descriptor=await loadDescriptor();}catch(error){if(error.code!=='ENOENT')throw error;return undefined;}
  services=createServiceLifecycle({stateRoot:configuration.paths.stateRoot,descriptor,adapter:makeAdapter({stateRoot:configuration.paths.stateRoot,ports:configuration.services.ports,descriptor})});
  return services;
 }
 function unavailable() {return {status:executionReady?'DEGRADED':'NEEDS_CONFIGURATION',code:'CRYSTRA_SERVICE_DESCRIPTOR_UNAVAILABLE'};}
 async function diagnose(result,workspace) {
  if(!activeProfile)return result;
  let diagnostic;
  try {
   const execution=JSON.parse(await readFile(activeProfile.configFile,'utf8'));
   const {loadRepositoryModelBindings}=await import('crystra-execution');
   const worktree=workspace??execution.paths.repositoryRoot;
   const bindings=await loadRepositoryModelBindings(worktree);
   if(bindings.documentState==='ABSENT')diagnostic={code:'CRYSTRA_ROLE_BINDINGS_REQUIRED',path:path.join(worktree,'.crystra','role-provider-bindings.json')};
  }catch(error){diagnostic={code:/^[A-Z_]+$/u.test(error.code??'')?error.code:'CRYSTRA_EXECUTION_CONFIGURATION_INVALID'};}
  if(!diagnostic)return result;
  return {...result,status:result.status==='READY'?'NEEDS_CONFIGURATION':result.status,diagnostics:[diagnostic]};
 }
 async function setup(signal,workspace) {
  signal.throwIfAborted();
  await activate(await prepareExecutionConfiguration(configuration));
  signal.throwIfAborted();
  const manager=await lifecycle();return diagnose(manager?await manager.setup({signal}):unavailable(),workspace);
 }
 return Object.freeze({
  async operate(action,externalSignal,workspace) {
   const signal=AbortSignal.any([disposal.signal,...(externalSignal?[externalSignal]:[])]);
   signal.throwIfAborted();
   if(action==='setup') {
    if(setupPending)return {status:'FAILED',code:'CRYSTRA_SERVICES_BUSY',retry:'setup'};
    setupPending=setup(signal,workspace);try{return await setupPending;}finally{setupPending=undefined;}
   }
   const manager=await lifecycle();
   if(!manager)return diagnose(unavailable(),workspace);
   if(action==='doctor'||action==='status')return diagnose(await manager.doctor(),workspace);
   if(action==='start'||action==='stop')return manager[action]({signal});
   throw new Error('CRYSTRA_ADMIN_COMMAND_INVALID');
  },
  async dispose(){disposal.abort();await services?.dispose();await setupPending?.catch(()=>{});},
 });
}
