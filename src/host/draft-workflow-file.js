import {createPinnedDraftReader} from './pinned-draft-reader.js';
import {admitWorkflowDraft} from '../client/workflow-draft-projection.js';
const fail=code=>{throw new Error(code);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&Object.keys(value).every(k=>names.includes(k));
/** Explicit local configuration only. No arbitrary paths or authority supplied by RPC callers. */
export function createDraftWorkflowFileGateway({file,sourceLockFile,sourceLockDigest,allowFixtures=false,now=Date.now}){
 if(typeof allowFixtures!=='boolean')fail('DRAFT_CONFIGURATION_INVALID');
 const read=createPinnedDraftReader({file,sourceLockFile,sourceLockDigest});
 async function load(){
  const document=await read();
  if(!keys(document,['format','workflows'])||document.format!=='crystra-workflow-file@1'||!Array.isArray(document.workflows)||document.workflows.length>100)fail('DRAFT_FILE_INVALID');
  const ids=new Set(),workflows=[];
  for(const item of document.workflows){
   if(!keys(item,['selection','projection'])||!keys(item.selection,['definitionId','definitionRevision','workspaceId'])||ids.has(item.selection.definitionId))fail('DRAFT_FILE_INVALID');
   const context={...item.selection,draftId:'crystra-ui-exploration',revision:'draft.1',environment:'exploration',sourceLockDigest,adapterId:'crystra-workflow-file@1',accessAllowed:true,allowFixtures};
   const admitted=admitWorkflowDraft(item.projection,context,now());if(admitted.state!=='valid')fail(admitted.reason);
   ids.add(context.definitionId);workflows.push({context,projection:admitted.projection});
  }
  return workflows;
 }
 function resourceRead(workflow,payload){
    const p=workflow.projection;if(p.resources.state!=='available')fail('RESOURCE_UNAVAILABLE');
    const resource=p.resources.value.catalog.find(r=>r.id===payload.resourceId);
    if(!resource?.files.some(f=>f.path===payload.path))fail('RESOURCE_UNAVAILABLE');
    const file=p.resources.value.workspace.files.find(f=>f.path===payload.path);
    const revision=file?.revision??p.snapshotRevision;
    if(!file||file.truncated||revision!==payload.resourceRevision)fail('REVISION_UNAVAILABLE');
    return {ok:true,value:{authority:'draft',provenance:p.provenance,definitionId:workflow.context.definitionId,definitionRevision:workflow.context.definitionRevision,workspaceId:workflow.context.workspaceId,snapshotRevision:p.snapshotRevision,expiresAt:p.expiresAt,resourceId:payload.resourceId,path:file.path,revision,content:file.content}};
 }
 return {async readForSession(payload,authority){
  try{
   if(!keys(payload,['definitionId','definitionRevision','resourceId','path','resourceRevision']))fail('INVALID_REQUEST');
   const workflows=await load(),matches=workflows.filter(row=>row.context.definitionId===payload.definitionId&&row.context.definitionRevision===payload.definitionRevision);
   if(matches.length!==1)fail('DRAFT_BINDING_UNAVAILABLE');
   const workflow=matches[0],b=workflow.projection.inputBinding;
   if(!b||!authority||b.sessionId!==authority.sessionKey||b.workspaceId!==authority.workspaceId||b.packageRoot!==authority.path)fail('DRAFT_SESSION_UNAVAILABLE');
   return resourceRead(workflow,payload);
  }catch(error){return {ok:false,error:{code:'DRAFT_UNAVAILABLE',message:error.code==='ENOENT'?'DRAFT_FILE_MISSING':error.message}};}
 },async handle(endpoint,payload){
  try{
   if(endpoint==='catalog/read'&&!keys(payload,[]))fail('INVALID_REQUEST');
   else if(endpoint==='projection/read'&&!keys(payload,['definitionId','definitionRevision','workspaceId']))fail('INVALID_REQUEST');
   else if(endpoint==='resource/read'&&!keys(payload,['definitionId','definitionRevision','workspaceId','resourceId','path','resourceRevision']))fail('INVALID_REQUEST');
   else if(!['catalog/read','projection/read','resource/read'].includes(endpoint))fail('INVALID_REQUEST');
   const workflows=await load();
   if(endpoint==='catalog/read')return {ok:true,value:{authority:'draft',workflows:workflows.map(({context,projection})=>({context,entry:projection.entry,expiresAt:projection.expiresAt,snapshotRevision:projection.snapshotRevision}))}};
   const workflow=workflows.find(({context})=>['definitionId','definitionRevision','workspaceId'].every(key=>context[key]===payload[key]));
   if(!workflow)fail('DRAFT_BINDING_UNAVAILABLE');
   if(endpoint==='resource/read')return resourceRead(workflow,payload);
   return {ok:true,value:workflow.projection};
  }catch(error){return {ok:false,error:{code:'DRAFT_UNAVAILABLE',message:error.code==='ENOENT'?'DRAFT_FILE_MISSING':error.message}};}
 }};
}
