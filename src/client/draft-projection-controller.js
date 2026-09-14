import {admitDraftProjection} from './draft-projection.js';

/** Exploration-only lifecycle. No effects or automatic fallback to other tasks. */
export function createDraftProjectionController({read,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}) {
 let state={state:'invalid',authority:'draft',reason:'NO_CONTEXT'},generation=0,timer=null,disposed=false;
 const listeners=new Set();
 const publish=next=>{state=next;for(const listener of listeners)listener();};
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
 function expire(response,context,request){
  if(disposed||request!==generation)return;
  const next=admitDraftProjection(response,context,now());
  publish(next);
  if(next.state==='valid')timer=setTimer(()=>{timer=null;expire(response,context,request);},Math.min(2147483647,Math.max(1,Date.parse(response.expiresAt)-now())));
 }
 return {
  getSnapshot:()=>state,
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  async setContext(context){
   if(disposed)return;
   const request=++generation;cancel();
   const selected=context ? {...context}:context;
   // Context validation runs before invoking the adapter; permissions never come from its response.
   const admission=admitDraftProjection(null,selected,now());
   if(admission.reason!=='INVALID_ENVELOPE'){publish(admission);return;}
   publish({state:'loading',authority:'draft'});
   try {
    const response=await read({...selected});
    if(disposed||request!==generation)return;
    // Own the admitted snapshot so later adapter mutations cannot change rendered content.
    expire(structuredClone(response),selected,request);
   }catch{
    if(!disposed&&request===generation)publish({state:'invalid',authority:'draft',reason:'READ_FAILED'});
   }
  },
  dispose(){disposed=true;++generation;cancel();state={state:'invalid',authority:'draft',reason:'DISPOSED'};listeners.clear();},
 };
}
