import {createWorkflowResourceAuthoring} from './workflow-resource-authoring.js';
import {isAbsolute} from 'node:path';
import {createPinnedDraftReader} from './pinned-draft-reader.js';
import {admitWorkflowDraft} from '../client/workflow-draft-projection.js';
const fail=code=>{throw new Error(code);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,names)=>plain(value)&&Object.keys(value).length===names.length&&Object.keys(value).every(k=>names.includes(k));
/** Explicit local configuration only. No arbitrary paths or authority supplied by RPC callers. */
export function createDraftWorkflowFileGateway({file,sourceLockFile,sourceLockDigest,allowFixtures=false,now=Date.now,resourceDraftRoot,allowResourceWrites=false}){
 if((resourceDraftRoot!==undefined&&!isAbsolute(resourceDraftRoot))||typeof allowResourceWrites!=='boolean'||(allowResourceWrites&&!resourceDraftRoot))fail('DRAFT_CONFIGURATION_INVALID');
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
 function authoring(workflow){if(!resourceDraftRoot)fail('RESOURCE_STORE_UNAVAILABLE');return createWorkflowResourceAuthoring({root:resourceDraftRoot,writeAllowed:allowResourceWrites,workflow,loadCurrent:async()=>{const rows=await load();return rows.find(row=>row.context.definitionId===workflow.context.definitionId&&row.context.definitionRevision===workflow.context.definitionRevision&&row.context.workspaceId===workflow.context.workspaceId);}});}
 async function resourceRead(workflow,payload){
    const p=workflow.projection;if(p.resources.state!=='available')fail('RESOURCE_UNAVAILABLE');
    const resource=p.resources.value.catalog.find(r=>r.id===payload.resourceId);
    if(!resource?.files.some(f=>f.path===payload.path))fail('RESOURCE_UNAVAILABLE');
    const file=p.resources.value.workspace.files.find(f=>f.path===payload.path);
    const revision=file?.revision??p.snapshotRevision;
    if(!file||file.truncated)fail('REVISION_UNAVAILABLE');
    let content=file.content,selectedRevision=revision;
    if(revision!==payload.resourceRevision){if(!resourceDraftRoot)fail('REVISION_UNAVAILABLE');const exact=await authoring(workflow).readRevision(payload.resourceId,payload.path,payload.resourceRevision);content=exact.content;selectedRevision=exact.revision;}
    return {ok:true,value:{authority:'draft',provenance:p.provenance,definitionId:workflow.context.definitionId,definitionRevision:workflow.context.definitionRevision,workspaceId:workflow.context.workspaceId,snapshotRevision:p.snapshotRevision,expiresAt:p.expiresAt,resourceId:payload.resourceId,path:file.path,revision:selectedRevision,content}};
 }
 return {async readForSession(payload,authority){
  try{
   if(!keys(payload,['definitionId','definitionRevision','resourceId','path','resourceRevision']))fail('INVALID_REQUEST');
   const workflows=await load(),matches=workflows.filter(row=>row.context.definitionId===payload.definitionId&&row.context.definitionRevision===payload.definitionRevision);
   if(matches.length!==1)fail('DRAFT_BINDING_UNAVAILABLE');
   const workflow=matches[0],b=workflow.projection.inputBinding;
   if(!b||!authority||b.sessionId!==authority.sessionKey||b.workspaceId!==authority.workspaceId||b.packageRoot!==authority.path)fail('DRAFT_SESSION_UNAVAILABLE');
   return await resourceRead(workflow,payload);
  }catch(error){return {ok:false,error:{code:'DRAFT_UNAVAILABLE',message:error.code==='ENOENT'?'DRAFT_FILE_MISSING':error.message}};}
 },async handle(endpoint,payload){
  try{
   if(endpoint==='catalog/read'&&!keys(payload,[]))fail('INVALID_REQUEST');
   else if(endpoint==='projection/read'&&!keys(payload,['definitionId','definitionRevision','workspaceId']))fail('INVALID_REQUEST');
   else if(endpoint==='resource/read'&&!keys(payload,['definitionId','definitionRevision','workspaceId','resourceId','path','resourceRevision']))fail('INVALID_REQUEST');
   else if(endpoint==='resources/read'&&!keys(payload,['definitionId','definitionRevision','workspaceId']))fail('INVALID_REQUEST');
   else if(endpoint==='resources/save'&&!keys(payload,['definitionId','definitionRevision','workspaceId','proposal']))fail('INVALID_REQUEST');
   else if(!['catalog/read','projection/read','resource/read','resources/read','resources/save'].includes(endpoint))fail('INVALID_REQUEST');
   const workflows=await load();
   if(endpoint==='catalog/read')return {ok:true,value:{authority:'draft',workflows:workflows.map(({context,projection})=>({context,entry:projection.entry,expiresAt:projection.expiresAt,snapshotRevision:projection.snapshotRevision}))}};
   const workflow=workflows.find(({context})=>['definitionId','definitionRevision','workspaceId'].every(key=>context[key]===payload[key]));
   if(!workflow)fail('DRAFT_BINDING_UNAVAILABLE');
   if(endpoint==='resource/read')return await resourceRead(workflow,payload);
   if(endpoint==='resources/read')return {ok:true,value:{authority:'draft',snapshotRevision:workflow.projection.snapshotRevision,expiresAt:workflow.projection.expiresAt,files:await authoring(workflow).list()}};
   if(endpoint==='resources/save'){if(!allowResourceWrites)fail('WRITE_NOT_ALLOWED');return {ok:true,value:{...await authoring(workflow).save(payload.proposal),snapshotRevision:workflow.projection.snapshotRevision,expiresAt:workflow.projection.expiresAt}};}
   return {ok:true,value:{...workflow.projection,resourceStoreAvailable:!!resourceDraftRoot,resourceWriteAllowed:!!resourceDraftRoot&&allowResourceWrites}};
  }catch(error){return {ok:false,error:{code:'DRAFT_UNAVAILABLE',message:error.code==='ENOENT'?'DRAFT_FILE_MISSING':error.message}};}
 }};
}
