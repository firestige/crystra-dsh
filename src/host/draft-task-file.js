import {open,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute,resolve,relative,sep} from 'node:path';
import {admitDraftProjection} from '../client/draft-projection.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw new Error(code);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&Object.keys(value).every(k=>names.includes(k));
async function bounded(file,max){const handle=await open(file,'r');try{const stat=await handle.stat();if(!stat.isFile()||stat.size>max)fail('DRAFT_FILE_INVALID');const bytes=await handle.readFile();if(bytes.length>max)fail('DRAFT_FILE_INVALID');return bytes;}finally{await handle.close();}}
/** Explicit local configuration only. No arbitrary paths or authority supplied by RPC callers. */
export function createDraftTaskFileGateway({file,sourceLockFile,sourceLockDigest,allowFixtures=false,now=Date.now}){
 if(!isAbsolute(file)||!isAbsolute(sourceLockFile)||!/^[a-f0-9]{64}$/.test(sourceLockDigest)||typeof allowFixtures!=='boolean')fail('DRAFT_CONFIGURATION_INVALID');
 async function load(){
  const bytes=await bounded(sourceLockFile,1000000);if(hash(bytes)!==sourceLockDigest)fail('DRAFT_SOURCE_CHANGED');
  const lock=JSON.parse(bytes);if(!isAbsolute(lock.sourceRoot)||!Array.isArray(lock.sources)||!lock.sources.length||lock.sources.length>100)fail('DRAFT_SOURCE_INVALID');
  const root=await realpath(lock.sourceRoot);
  for(const item of lock.sources){
   if(typeof item.path!=='string'||isAbsolute(item.path)||!/^[a-f0-9]{64}$/.test(item.sha256))fail('DRAFT_SOURCE_INVALID');
   const path=await realpath(resolve(root,item.path)),rel=relative(root,path);
   if(rel.split(sep)[0]==='..'||isAbsolute(rel))fail('DRAFT_SOURCE_INVALID');
   if(hash(await bounded(path,2000000))!==item.sha256)fail('DRAFT_SOURCE_CHANGED');
  }
  const document=JSON.parse(await bounded(file,4000000));
  if(!keys(document,['format','tasks'])||document.format!=='crystra-task-file@1'||!Array.isArray(document.tasks)||document.tasks.length>100)fail('DRAFT_FILE_INVALID');
  const ids=new Set(),tasks=[];
  for(const item of document.tasks){
   if(!keys(item,['selection','projection'])||!keys(item.selection,['taskId','goalRevision','planRevision'])||ids.has(item.selection.taskId))fail('DRAFT_FILE_INVALID');
   const context={...item.selection,draftId:'crystra-ui-exploration',revision:'draft.1',environment:'exploration',sourceLockDigest,adapterId:'crystra-task-file@1',accessAllowed:true,allowFixtures};
   const admitted=admitDraftProjection(item.projection,context,now());if(admitted.state!=='valid')fail(admitted.reason);
   ids.add(context.taskId);tasks.push({context,projection:admitted.projection});
  }
  if(hash(await bounded(sourceLockFile,1000000))!==sourceLockDigest)fail('DRAFT_SOURCE_CHANGED');
  return tasks;
 }
 return {async handle(endpoint,payload){
  try{
   if(endpoint==='catalog/read'&&!keys(payload,[]))fail('INVALID_REQUEST');
   else if(endpoint==='projection/read'&&!keys(payload,['taskId','goalRevision','planRevision']))fail('INVALID_REQUEST');
   else if(!['catalog/read','projection/read'].includes(endpoint))fail('INVALID_REQUEST');
   const tasks=await load();
   if(endpoint==='catalog/read')return {ok:true,value:{authority:'draft',tasks:tasks.map(({context,projection})=>({context,expiresAt:projection.expiresAt,snapshotRevision:projection.snapshotRevision}))}};
   const task=tasks.find(({context})=>['taskId','goalRevision','planRevision'].every(key=>context[key]===payload[key]));
   if(!task)fail('DRAFT_BINDING_UNAVAILABLE');return {ok:true,value:task.projection};
  }catch(error){return {ok:false,error:{code:'DRAFT_UNAVAILABLE',message:error.code==='ENOENT'?'DRAFT_FILE_MISSING':error.message}};}
 }};
}
