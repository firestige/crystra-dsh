import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,realpath,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {prepareServiceBundle} from './service-bundle.js';
const execute=promisify(execFile);
function fail(code){throw Object.assign(new Error(code),{code});}
export function serviceNamespace(stateRoot) {
 const suffix=createHash('sha256').update(path.resolve(stateRoot)).digest('hex').slice(0,12);
 return {project:`crystra_services_${suffix}`,volume:`crystra-evidence-${suffix}`};
}
export function composeReadiness(output) {
 let rows;
 try {
  try{const value=JSON.parse(output);rows=Array.isArray(value)?value:[value];}
  catch{rows=output.trim()?output.trim().split('\n').map(line=>JSON.parse(line)):[];}
  if(rows.some(row=>row===null||typeof row!=='object'))throw new Error();
 }catch{fail('CRYSTRA_SERVICES_STATUS_INVALID');}
 const byService=new Map(rows.map(row=>[row.Service,row]));
 return {ready:['database','migrate','evidence','evolution'].every(name=>{
  const row=byService.get(name);
  return row!==undefined&&(name==='migrate'?row.State==='exited'&&Number(row.ExitCode)===0:row.State==='running'&&row.Health==='healthy');
 })};
}
function within(root,candidate) {
 const relative=path.relative(root,candidate);
 return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);
}
export function createComposeAdapter({stateRoot,ports,descriptor,fetchImpl=fetch,prepareBundle=prepareServiceBundle,run=async(command,args,options={})=>execute(command,args,{...options,env:{...process.env,...options.env},timeout:180000,maxBuffer:1024*1024})}) {
 let namespace=serviceNamespace(stateRoot);
 const preparedFile=path.join(stateRoot,'services-prepared.json');
 const managed=path.join(stateRoot,'managed');
 const env={COMPOSE_PROJECT_NAME:namespace.project,CRYSTRA_EVIDENCE_VOLUME:namespace.volume,CRYSTRA_EVIDENCE_PORT:String(ports.evidence),CRYSTRA_EVOLUTION_PORT:String(ports.evolution),CRYSTRA_LOCAL_STATE_DIR:path.join(stateRoot,'durable','services')};
 async function checked(command,args,options) {
  try{return await run(command,args,options);}
  catch(error){
   const message=String(error.stderr??error.message??'command failed').replace(/((?:password|token|secret|api[_-]?key)\s*[=:]\s*)\S+/giu,'$1[REDACTED]').slice(-8192);
   await writeFile(path.join(stateRoot,'services-last-error.log'),`${path.basename(command)} ${args.join(' ')}\n${message}\n`,{mode:0o600});
   fail('CRYSTRA_SERVICES_COMMAND_FAILED');
  }
 }
 async function canonicalize() {
  const physical=await realpath(stateRoot);
  namespace=serviceNamespace(physical);
  env.COMPOSE_PROJECT_NAME=namespace.project;
  env.CRYSTRA_EVIDENCE_VOLUME=namespace.volume;
  env.CRYSTRA_LOCAL_STATE_DIR=path.join(physical,'durable','services');
 }
 async function bundle() {
  let record;try{record=JSON.parse(await readFile(preparedFile,'utf8'));}catch{fail('CRYSTRA_SERVICES_NOT_PREPARED');}
  if(record.descriptorSha256!==descriptor.sha256||typeof record.directory!=='string')fail('CRYSTRA_SERVICE_IDENTITY_MISMATCH');
  const directory=await realpath(record.directory);
  if(!within(await realpath(managed),directory))fail('CRYSTRA_SERVICE_BUNDLE_PATH_INVALID');
  return directory;
 }
 async function invoke(action,options={}) {
  await canonicalize();
  const directory=await bundle();
  return checked(path.join(directory,'crystra-compose'),[action],{cwd:directory,env,signal:options.signal});
 }
 return Object.freeze({
  async preflight(options={}) {
   await canonicalize();
   await checked('docker',['info'],options);await checked('docker',['compose','version'],options);
   const inventory=await checked('docker',['ps','-aq','--filter',`label=com.docker.compose.project=${namespace.project}`],options);
   for(const id of inventory.stdout.trim().split(/\s+/u).filter(Boolean)) {
    const result=await checked('docker',['inspect',id,'--format','{{json .Config.Labels}}'],options);
    let labels;try{labels=JSON.parse(result.stdout);}catch{fail('CRYSTRA_SERVICES_OWNERSHIP_UNAVAILABLE');}
    const owner=labels?.['com.docker.compose.project.working_dir'];
    if(typeof owner!=='string'||!within(await realpath(managed),await realpath(owner)))fail('CRYSTRA_SERVICES_OWNERSHIP_MISMATCH');
   }
  },
  async prepare(options={}) {
   const directory=await prepareBundle({stateRoot,descriptor,fetchImpl,signal:options.signal});
   if(!within(await realpath(managed),await realpath(directory)))fail('CRYSTRA_SERVICE_BUNDLE_PATH_INVALID');
   await mkdir(stateRoot,{recursive:true,mode:0o700});
   const temporary=`${preparedFile}.${randomUUID()}.new`;
   await writeFile(temporary,JSON.stringify({descriptorSha256:descriptor.sha256,directory}),{flag:'wx',mode:0o600});
   await rename(temporary,preparedFile);
  },
  start:options=>invoke('start',options),stop:options=>invoke('stop',options),
  async inspect(options={}) {
   const result=await invoke('status',options);
   if(!composeReadiness(result.stdout).ready)return {ready:false};
   try {
    const signals=[AbortSignal.timeout(3000),...(options.signal?[options.signal]:[])];
    const [evidence,evolution]=await Promise.all([ports.evidence,ports.evolution].map(port=>fetchImpl(`http://127.0.0.1:${port}/healthz`,{signal:AbortSignal.any(signals)})));
    return {ready:evidence.ok&&evolution.ok&&(await evidence.json()).status==='ok'&&(await evolution.text()).trim()==='ok'};
   }catch{return {ready:false};}
  },
 });
}
