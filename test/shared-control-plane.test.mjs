import test from 'node:test';import assert from 'node:assert/strict';
import {getSharedDeliveryControlPlaneClient} from '../modules/execution/src/client/delivery/control-plane-port.js';
test('product and Execution share one inventory for the same connection but never across connections',()=>{const rpc={call(){}};assert.equal(getSharedDeliveryControlPlaneClient(rpc),getSharedDeliveryControlPlaneClient(rpc));assert.notEqual(getSharedDeliveryControlPlaneClient(rpc),getSharedDeliveryControlPlaneClient({call(){}}));});
test('a late inventory reply cannot restore an older Task binding after a newer read fails',async()=>{
 const pending=[];const client=getSharedDeliveryControlPlaneClient({call(){return new Promise(resolve=>pending.push(resolve));}});
 const older=client.refresh(),newer=client.refresh();
 pending[1]({ok:false,error:{message:'current binding unavailable'}});await newer;
 pending[0]({ok:true,value:{generation:1}});await older;
 assert.equal(client.inventory.getSnapshot().kind,'error');
});
test('late session replies cannot replace a newer exact-session projection',async()=>{
 const pending=[];const client=getSharedDeliveryControlPlaneClient({call(){return new Promise(resolve=>pending.push(resolve));}});
 const session=client.bindSession('session-a');const older=session.refresh(),newer=session.refresh();
 pending[1]({ok:true,value:{revision:2}});await newer;
 pending[0]({ok:true,value:{revision:1}});await older;
 assert.equal(session.getSnapshot().view.revision,2);
});
