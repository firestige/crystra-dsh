import {projectDeliveryInventory} from '../../modules/execution/src/client/delivery-inventory/model.js';
const text=value=>typeof value==='string'&&value.length>0&&value.length<=512;
const empty=(phase,error)=>({phase,records:[],unavailable:[],...(error?{error}:{})});
/** Join formal owner coordinates; recorded_at is never substituted for execution start. */
export function projectTraceDirectory(inventory,facts,now=Date.now()){
 if(inventory?.kind!=='ready'||!['ready','empty'].includes(projectDeliveryInventory(inventory).kind))return empty(inventory?.kind==='loading'?'loading':'unavailable');
 const records=[],unavailable=[];
 for(const delivery of inventory.snapshot.deliveries){
  const roots=new Set();
  for(const fact of facts){
   if(fact.kind!=='DELIVERY_ROOT_BINDING'||fact.truth?.availability!=='AVAILABLE'||fact.truth.expiry!=='ACTIVE'||![null,'FINAL','LOWER_BOUND','NOT_APPLICABLE'].includes(fact.truth.completeness))continue;
   if(fact.truth.expires_at!==null&&(!Number.isFinite(Date.parse(fact.truth.expires_at))||Date.parse(fact.truth.expires_at)<=now))continue;
   for(const relation of fact.relationships??[]){
    if(relation.kind!=='DELIVERY_ROOT'||relation.to?.kind!=='DELIVERY'||relation.to.key?.length!==1||relation.to.key[0]!==delivery.deliveryId||relation.from?.kind!=='SPAN'||relation.from.key?.length!==2)continue;
    const [trace,span]=relation.from.key;if(/^[a-f0-9]{32}$/.test(trace)&&/^[a-f0-9]{16}$/.test(span))roots.add(JSON.stringify([trace,span]));
   }
  }
  let reason=roots.size===0?'ROOT_UNAVAILABLE':roots.size!==1?'ROOT_AMBIGUOUS':undefined;
  if(![delivery.workflow?.identity,delivery.workflow?.packageName,delivery.workflow?.exactPackageVersion].every(text)||!Number.isSafeInteger(delivery.timing?.startedAt)||delivery.timing.startedAt<0||!Number.isFinite(new Date(delivery.timing.startedAt).getTime()))reason='OWNER_FIELDS_UNAVAILABLE';
  if(reason){unavailable.push({deliveryId:delivery.deliveryId,reason});continue;}
  records.push({deliveryId:delivery.deliveryId,taskId:delivery.task.identity,taskName:delivery.task.displayName??delivery.task.identity,workflowId:delivery.workflow.identity,workflowName:delivery.workflow.packageName,workflowVersion:delivery.workflow.exactPackageVersion,startedAt:new Date(delivery.timing.startedAt).toISOString(),traceId:JSON.parse([...roots][0])[0]});
 }
 return {phase:records.length?'ready':'empty',records,unavailable};
}
/** Bounded, snapshot-consistent root reads for this instance's owner inventory. */
export function createTraceDirectoryController({inventory,gateway,decode,now=Date.now}){
 let snapshot=Object.freeze(empty('idle')),generation=0,disposed=false,expiryTimer,abort;
 const listeners=new Set();
 const publish=next=>{snapshot=Object.freeze(next);for(const listener of listeners)listener();};
 async function refresh(){
  if(disposed)return;const request=++generation;clearTimeout(expiryTimer);abort?.abort();abort=new AbortController();
  const owner=inventory.getSnapshot();
  if(owner?.kind!=='ready'||!['ready','empty'].includes(projectDeliveryInventory(owner).kind)){publish(empty(owner?.kind==='loading'?'loading':'unavailable'));return;}
  if(owner.snapshot.deliveries.length===0){publish(empty('empty'));return;}
  publish(empty('loading'));const facts=[],seen=new Set();let cursor,identity;
  try{
   for(let page=0;page<20;page++){
    const answer=await gateway.call('facts/read',{kind:'DELIVERY_ROOT_BINDING',limit:200,...cursor?{cursor}:{}},abort.signal);
    if(request!==generation||disposed)return;if(answer?.ok!==true)throw new Error(answer?.error?.code??'FACTS_UNAVAILABLE');
    const result=decode('facts',answer.value,200);if(!result.ok)throw new Error('FACTS_INVALID');
    const value=result.value;if(identity!==undefined&&value.snapshot!==identity)throw new Error('FACT_SNAPSHOT_CHANGED');identity=value.snapshot;
    facts.push(...value.items);
    if(value.next_cursor===null){
     publish(projectTraceDirectory(owner,facts,now()));
     const expiry=Math.min(...facts.map(f=>Date.parse(f.truth?.expires_at)).filter(time=>Number.isFinite(time)&&time>now()));
     if(Number.isFinite(expiry)){expiryTimer=setTimeout(()=>{void refresh();},Math.min(2147483647,Math.max(1,expiry-now())));expiryTimer.unref?.();}
     return;
    }
    if(typeof value.next_cursor!=='string'||seen.has(value.next_cursor))throw new Error('FACT_CURSOR_INVALID');seen.add(value.next_cursor);cursor=value.next_cursor;
   }
   throw new Error('FACT_PAGE_LIMIT');
  }catch(error){if(request===generation&&!disposed)publish(empty('error',error.message??'FACTS_UNAVAILABLE'));}
 }
 let ownerKey;
 const stop=inventory.subscribe(()=>{const value=inventory.getSnapshot();const key=JSON.stringify([value.kind,value.snapshot?.generation]);if(key!==ownerKey){ownerKey=key;void refresh();}});
 return {getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},refresh,dispose(){disposed=true;generation++;abort?.abort();clearTimeout(expiryTimer);stop();listeners.clear();}};
}
