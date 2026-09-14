import {createPinnedDraftReader} from './pinned-draft-reader.js';
import {admitDraftProjection} from '../client/draft-projection.js';
const fail=code=>{throw new Error(code);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&Object.keys(value).every(k=>names.includes(k));
/** Explicit local configuration only. No arbitrary paths or authority supplied by RPC callers. */
export function createDraftTaskFileGateway({file,sourceLockFile,sourceLockDigest,allowFixtures=false,now=Date.now}){
 if(typeof allowFixtures!=='boolean')fail('DRAFT_CONFIGURATION_INVALID');
 const read=createPinnedDraftReader({file,sourceLockFile,sourceLockDigest});
 async function load(){
  const document=await read();
  if(!keys(document,['format','tasks'])||document.format!=='crystra-task-file@1'||!Array.isArray(document.tasks)||document.tasks.length>100)fail('DRAFT_FILE_INVALID');
  const ids=new Set(),tasks=[];
  for(const item of document.tasks){
   if(!keys(item,['selection','projection'])||!keys(item.selection,['taskId','goalRevision','planRevision'])||ids.has(item.selection.taskId))fail('DRAFT_FILE_INVALID');
   const context={...item.selection,draftId:'crystra-ui-exploration',revision:'draft.1',environment:'exploration',sourceLockDigest,adapterId:'crystra-task-file@1',accessAllowed:true,allowFixtures};
   const admitted=admitDraftProjection(item.projection,context,now());if(admitted.state!=='valid')fail(admitted.reason);
   ids.add(context.taskId);tasks.push({context,projection:admitted.projection});
  }
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
