import {projectDeliveryInventory} from '../../modules/execution/src/client/delivery-inventory/model.js';

/** Read-only binding decision; never creates, selects, or imports a Session.
 * The formal control-plane supplies correlation; the dedicated runtime's
 * current list supplies membership. Neither the newest Session nor Task ID
 * itself is a substitute for either source.
 */
export function resolveTaskSessionBinding(taskId,controlPlane,sessionList,selectedSessionId){
 if(typeof taskId!=='string'||!taskId.trim()||taskId.length>512
   ||controlPlane?.kind!=='ready'||sessionList?.phase!=='ready'
   ||!Array.isArray(sessionList.ids)||!sessionList.byId)return {kind:'unavailable'};
 const projected=projectDeliveryInventory(controlPlane);
 if(!['ready','empty'].includes(projected.kind))return {kind:'unavailable'};
 const candidates=new Map();
 for(const delivery of controlPlane.snapshot.deliveries){
  if(delivery.task.identity!==taskId)continue;
  const id=delivery.navigation?.sessionCorrelation;
  if(id==null)continue;
  const deliveries=candidates.get(id)??[];deliveries.push(delivery.deliveryId);candidates.set(id,deliveries);
 }
 if(candidates.size===0)return {kind:'unbound'};
 if(selectedSessionId!==undefined&&!candidates.has(selectedSessionId))return {kind:'unavailable'};
 if(candidates.size>1&&selectedSessionId===undefined)return {kind:'ambiguous',sessionIds:[...candidates.keys()].sort()};
 const [sessionId,deliveryIds]=selectedSessionId===undefined?[...candidates][0]:[selectedSessionId,candidates.get(selectedSessionId)];
 if(!sessionList.ids.includes(sessionId)||!Object.hasOwn(sessionList.byId,sessionId)
   ||sessionList.byId[sessionId]?.id!==sessionId)return {kind:'unavailable'};
 return {kind:'bound',sessionId,deliveryIds:deliveryIds.sort()};
}
