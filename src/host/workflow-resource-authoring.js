import {createHash} from 'node:crypto';import {join,isAbsolute} from 'node:path';
import {createDraftResourceAuthoring} from './draft-resource-authoring.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)??'undefined').digest('hex');
/** Each exact source snapshot owns an isolated candidate namespace. Source packages are never written. */
export function createWorkflowResourceAuthoring({root,workflow,writeAllowed=false,loadCurrent,inspectNotification}){
 if(!isAbsolute(root)||typeof writeAllowed!=='boolean'||workflow.projection.resources.state!=='available')throw new Error('RESOURCE_STORE_UNAVAILABLE');
 const p=workflow.projection,files=new Map(p.resources.value.workspace.files.map(f=>[f.path,f])),paths=new Set(),resources=[];
 for(const resource of p.resources.value.catalog)for(const declared of resource.files){
  const file=files.get(declared.path);if(!file||file.truncated)continue;
  if(paths.has(file.path))throw new Error('RESOURCE_OWNER_AMBIGUOUS');paths.add(file.path);
  resources.push({resourceId:resource.id,path:file.path,revision:file.revision??p.snapshotRevision,content:file.content});
 }
 const identity=hash(workflow),namespace=hash([workflow.context,p.snapshotRevision,resources]);
 const context={...workflow.context,workspaceId:namespace,accessAllowed:true,writeAllowed};
 async function validate(){if(hash(await loadCurrent())!==identity)throw new Error('DRAFT_SOURCE_CHANGED');return context;}
 const notificationInput=event=>({event,receipt:event.receipt,binding:p.inputBinding,selection:workflow.context,isCurrent:async()=>{try{await validate();return true;}catch{return false;}}});
 const options={root:join(root,namespace),resources,...typeof inspectNotification==='function'?{inspectNotification:event=>inspectNotification(notificationInput(event))}:{}};
 // Reads validate the whole batch at both ends; writes recheck asynchronously at every store gate.
 return {
  async list(){await validate();const port=createDraftResourceAuthoring({...options,getContext:()=>context});const result=await Promise.all(resources.map(r=>port.read(r.resourceId,r.path)));await validate();return result;},
  async save(proposal){await validate();return createDraftResourceAuthoring({...options,getContext:validate}).save(proposal);},
  async notifyPending(deliver){await validate();const port=createDraftResourceAuthoring({...options,getContext:validate});for(const resource of resources)await port.notify(resource.resourceId,resource.path,async event=>{await validate();return deliver(notificationInput(event));});},
  async readRevision(resourceId,path,revision){await validate();const result=await createDraftResourceAuthoring({...options,getContext:validate}).readRevision(resourceId,path,revision);await validate();return result;},
 };
}
