import {randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,rmdir,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';

async function readOptional(file) {
 try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return undefined;throw error;}
}
async function writeAtomic(file,value) {
 const temporary=`${file}.${randomUUID()}.new`;
 try {
  await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`,{flag:'wx',mode:0o600});
  await rename(temporary,file);
 }finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
function fail(code) {throw Object.assign(new Error(code),{code});}
export function createServiceLifecycle({stateRoot,descriptor,adapter}) {
 if(!path.isAbsolute(stateRoot)||descriptor?.schemaVersion!=='crystra.services@1.0.0'||!/^[0-9a-f]{64}$/u.test(descriptor.sha256))fail('CRYSTRA_SERVICE_DESCRIPTOR_INVALID');
 for(const action of ['preflight','prepare','start','stop','inspect'])if(typeof adapter?.[action]!=='function')fail('CRYSTRA_SERVICE_ADAPTER_INVALID');
 const identity=descriptor.sha256;
 const appliedFile=path.join(stateRoot,'services-applied.json');
 const statusFile=path.join(stateRoot,'services-status.json');
 const lock=path.join(stateRoot,'.services-operation.lock');
 const active=new Set();
 async function verifyIdentity() {
  const applied=await readOptional(appliedFile);
  if(applied&&(applied.schemaVersion!=='crystra.services-applied@1.0.0'||applied.descriptorSha256!==identity))fail('CRYSTRA_SERVICE_IDENTITY_MISMATCH');
  return applied;
 }
 async function status() {
  if(!await verifyIdentity())return {status:'NEEDS_CONFIGURATION'};
  const report=await adapter.inspect();
  return {status:report.ready===true?'READY':'DEGRADED'};
 }
 async function exclusive(action, externalSignal) {
  await mkdir(stateRoot,{recursive:true,mode:0o700});
  try{await mkdir(lock,{mode:0o700});}catch(error){if(error.code==='EEXIST')return {status:'FAILED',code:'CRYSTRA_SERVICES_BUSY',retry:action};throw error;}
  const controller=new AbortController();active.add(controller);
  const signal=AbortSignal.any([controller.signal,...(externalSignal?[externalSignal]:[])]);
  try {
   const applied=await verifyIdentity();
   if(action!=='setup'&&!applied)fail('CRYSTRA_SERVICES_NOT_PREPARED');
   await writeAtomic(statusFile,{status:'PREPARING',operation:action,descriptorSha256:identity});
   const options={signal};
   signal.throwIfAborted();
   await adapter.preflight(options);
   signal.throwIfAborted();
   if(action==='setup')await adapter.prepare(options);
   signal.throwIfAborted();
   await adapter[action==='stop'?'stop':'start'](options);
   signal.throwIfAborted();
   if(action!=='stop') {
    const report=await adapter.inspect(options);
    if(report.ready!==true)fail('CRYSTRA_SERVICES_NOT_READY');
    signal.throwIfAborted();
    await writeAtomic(appliedFile,{schemaVersion:'crystra.services-applied@1.0.0',descriptorSha256:identity});
   }
   const result={status:action==='stop'?'STOPPED':'READY'};
   await writeAtomic(statusFile,result);
   return result;
  }catch(error){
   const code=typeof error.code==='string'&&/^CRYSTRA_[A-Z_]+$/u.test(error.code)?error.code:'CRYSTRA_SERVICES_FAILED';
   const result={status:'FAILED',code,retry:action};
   await writeAtomic(statusFile,result);
   return result;
  }finally{active.delete(controller);await rmdir(lock);}
 }
 return Object.freeze({
  setup:(options={})=>exclusive('setup',options.signal),start:(options={})=>exclusive('start',options.signal),stop:(options={})=>exclusive('stop',options.signal),
  async doctor() {
   try{return await status();}catch(error){return {status:'FAILED',code:typeof error.code==='string'&&/^CRYSTRA_[A-Z_]+$/u.test(error.code)?error.code:'CRYSTRA_SERVICES_UNAVAILABLE'};}
  },
  // Abort plugin-owned in-flight work only. Do not stop a running stack or
  // remove durable config, volumes or applied identity during host disposal.
  async dispose(){for(const controller of active)controller.abort();},
 });
}
