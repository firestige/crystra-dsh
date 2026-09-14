import {validResourceNotification} from './resource-notifications.js';
/** Conditional persisted files; receipts never grant source-package or execution authority. */
export function createWorkflowResourceAdapter({gateway,selection,workspace,catalog,snapshotRevision,expiresAt,writeAllowed=false,isCurrent,proposalId=()=>crypto.randomUUID()}){
 let state={phase:'loading',workspace},disposed=false,generation=0,saving=false,attempt;const listeners=new Set();
 const publish=next=>{state=next;for(const fn of listeners)fn();};
 const current=()=>{if(disposed||!isCurrent())throw new Error('DRAFT_BINDING_CHANGED');};
 const declared=new Map(catalog.flatMap(r=>r.files.map(f=>[JSON.stringify([r.id,f.path]),f.path])));
 const validFile=f=>f&&declared.has(JSON.stringify([f.resourceId,f.path]))&&typeof f.content==='string'&&f.content.length<=500000&&typeof f.revision==='string'&&f.revision.length>0&&f.revision.length<=4096&&validResourceNotification(f);
 const envelope=r=>{if(r?.ok!==true)throw new Error(r?.error?.message??'RESOURCE_UNAVAILABLE');const v=r.value;if(v?.authority!=='draft'||v.snapshotRevision!==snapshotRevision||v.expiresAt!==expiresAt)throw new Error('DRAFT_RECEIPT_MISMATCH');return v;};
 return {getSnapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
  async load(){const request=++generation;try{current();const value=envelope(await gateway.call('resources/read',selection));current();if(request!==generation)return;
   if(!Array.isArray(value.files)||value.files.length>1000||!value.files.every(validFile)||new Set(value.files.map(f=>f.path)).size!==value.files.length)throw new Error('DRAFT_RECEIPT_MISMATCH');
   const changed=new Map(value.files.map(f=>[f.path,f]));for(const file of workspace.files)if(!file.truncated&&[...declared.values()].includes(file.path)&&!changed.has(file.path))throw new Error('RESOURCE_UNAVAILABLE');
   publish({phase:'ready',workspace:{...workspace,files:workspace.files.map(file=>changed.has(file.path)?{...file,content:changed.get(file.path).content,revision:changed.get(file.path).revision,notification:changed.get(file.path).notification}:file)}});
  }catch(error){if(!disposed&&request===generation)publish({phase:'unavailable',workspace,error:error.message});}},
  async save(proposal){current();if(!writeAllowed||state.phase!=='ready'||saving)throw new Error('RESOURCE_UNAVAILABLE');
   const file=state.workspace.files.find(f=>f.path===proposal.path);if(!file||file.truncated||!declared.has(JSON.stringify([proposal.resourceId,proposal.path]))||file.revision!==proposal.baseRevision||file.content!==proposal.baseContent)throw new Error('REVISION_CONFLICT');
   const fingerprint=JSON.stringify(['resourceId','path','baseRevision','baseContent','content'].map(k=>proposal[k]));if(attempt?.fingerprint!==fingerprint)attempt={fingerprint,id:proposalId()};
   saving=true;try{const value=envelope(await gateway.call('resources/save',{...selection,proposal:{...proposal,proposalId:attempt.id}}));current();
    if(!validFile(value)||value.resourceId!==proposal.resourceId||value.path!==proposal.path||value.content!==proposal.content||!/^draft-sha256:[a-f0-9]{64}$/.test(value.revision))throw new Error('DRAFT_RECEIPT_MISMATCH');
    publish({phase:'ready',workspace:{...state.workspace,files:state.workspace.files.map(f=>f.path===value.path?{...f,content:value.content,revision:value.revision,notification:value.notification}:f)}});
   }finally{saving=false;}
  },
  async retryNotifications(){current();if(!writeAllowed||state.phase!=='ready'||saving||state.notifying)throw Error('RESOURCE_UNAVAILABLE');publish({...state,notifying:true,notificationError:undefined});try{envelope(await gateway.call('resources/notify',selection));current();await this.load();if(state.phase!=='ready')throw Error('RESOURCE_UNAVAILABLE');}catch(error){if(!disposed)publish({...state,notificationError:error.message});throw error;}finally{if(!disposed)publish({...state,notifying:false});}},
  dispose(){disposed=true;generation++;listeners.clear();},
 };
}
