import {admitWorkflowDraft} from './workflow-draft-projection.js';
const unavailable=Object.freeze({state:'invalid',authority:'draft',reason:'DRAFT_UNAVAILABLE'});
/** Host-selected, read-only conditional workflows. No fixture imports or business writes. */
export function createDraftWorkflowAdapter({gateway,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 let snapshot=Object.freeze({phase:'idle',workflows:[]}),generation=0,disposed=false,timer,expiryTimer;
 const listeners=new Set(),states=new Map(),sources=new Map();
 const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
 const publish=(workflows,phase)=>{
  states.clear();for(const item of workflows)states.set(item.context.definitionId,Object.freeze({state:'valid',authority:'draft',projection:item.projection}));
  snapshot=Object.freeze({phase,workflows});for(const listener of listeners)listener();
 };
 async function refresh(){
  if(disposed)return;const request=++generation;clearTimer(timer);
  let disabled=false;
  try{
   const result=await gateway.call('catalog/read',{});if(request!==generation||disposed)return;
   if(result?.ok!==true){disabled=result?.error?.code==='DRAFT_DISABLED';throw new Error('CATALOG_UNAVAILABLE');}
   const catalog=result.value;if(catalog?.authority!=='draft'||!Array.isArray(catalog.workflows)||catalog.workflows.length>100)throw new Error('CATALOG_INVALID');
   const workflows=[],ids=new Set();
   for(const row of catalog.workflows){
    const context=row.context;if(!context||ids.has(context.definitionId)||context.adapterId!=='crystra-workflow-file@1')throw new Error('CATALOG_INVALID');
    const read=await gateway.call('projection/read',Object.fromEntries(['definitionId','definitionRevision','workspaceId'].map(key=>[key,context[key]])));
    if(request!==generation||disposed)return;
    if(read?.ok!==true)throw new Error('PROJECTION_UNAVAILABLE');
    const admission=admitWorkflowDraft(read.value,context,now());
    if(admission.state!=='valid'||read.value.snapshotRevision!==row.snapshotRevision||read.value.expiresAt!==row.expiresAt)throw new Error('PROJECTION_INVALID');
    const prior=snapshot.workflows.find(item=>item.context.definitionId===context.definitionId);
    const unchanged=prior&&JSON.stringify(prior.context)===JSON.stringify(context)&&JSON.stringify(prior.projection)===JSON.stringify(read.value);
    ids.add(context.definitionId);workflows.push(unchanged?prior:{context:{...context},projection:structuredClone(read.value)});
   }
   if(workflows.some(item=>admitWorkflowDraft(item.projection,item.context,now()).state!=='valid'))throw new Error('PROJECTION_EXPIRED');
   clearTimer(expiryTimer);publish(workflows,'ready');
   const expiry=Math.min(...workflows.map(item=>Date.parse(item.projection.expiresAt)));
   if(Number.isFinite(expiry)){expiryTimer=setTimer(()=>{if(disposed)return;generation++;publish([],'unavailable');void refresh();},Math.min(10000,Math.max(1,expiry-now())));expiryTimer?.unref?.();}
  }catch{if(request===generation&&!disposed){clearTimer(expiryTimer);publish([],disabled?'disabled':'unavailable');}}
  finally{if(!disabled&&request===generation&&!disposed){timer=setTimer(()=>{void refresh();},5000);timer?.unref?.();}}
 }
 return {getSnapshot:()=>snapshot,subscribe,refresh,
  workflowSource(id){if(!sources.has(id))sources.set(id,{subscribe,getSnapshot:()=>states.get(id)??unavailable});return sources.get(id);},
  dispose(){disposed=true;generation++;clearTimer(timer);clearTimer(expiryTimer);states.clear();listeners.clear();sources.clear();}
 };
}
