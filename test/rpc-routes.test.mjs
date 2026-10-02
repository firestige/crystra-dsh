import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerCrystraRpc} from '../src/host/rpc-routes.js';
test('0.1.5 channels use exact authenticated Fetch routes and validate envelopes before dispatch',async()=>{
 const routes=new Map();let calls=0,signal;
 const ctx={connection:{fetch:{register(route){routes.set(route.path,route);return async()=>routes.delete(route.path);}}},effect(){}};
 const stop=registerCrystraRpc(ctx,'/crystra-tasks',async(endpoint,payload,received)=>{calls++;signal=received;return {ok:true,value:{endpoint,payload}};});
 assert.deepEqual([...routes.keys()],['/api/crystra-tasks/list','/api/crystra-tasks/changes','/api/crystra-tasks/update']);
 const route=routes.get('/api/crystra-tasks/list');
 const send=body=>route.fetch(new Request('http://localhost/api/crystra-tasks/list',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await send({type:'client-request',rpcId:'one',method:'crystra-tasks/changes',payload:{}})).status,400);
 assert.equal(calls,0);
 const response=await send({type:'client-request',rpcId:'one',method:'crystra-tasks/list',payload:{}});
 assert.deepEqual(await response.json(),{type:'server-response',rpcId:'one',result:{ok:true,value:{endpoint:'list',payload:{}}}});
 assert.ok(signal instanceof AbortSignal);await stop();assert.equal(routes.size,0);
});
test('analysis metadata directory is exposed through the authenticated host route',async()=>{
 const routes=new Map();const ctx={connection:{fetch:{register(route){routes.set(route.path,route);return async()=>{};}}},effect(){}};
 registerCrystraRpc(ctx,'/crystra-studio',async(endpoint,payload)=>({ok:true,value:{endpoint,payload}}));
 const route=routes.get('/api/crystra-studio/deliveries/list');assert.ok(route);
 const response=await route.fetch(new Request('http://localhost/api/crystra-studio/deliveries/list',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'directory',method:'crystra-studio/deliveries/list',payload:{limit:100}})}));
 assert.equal((await response.json()).result.value.endpoint,'deliveries/list');
});
