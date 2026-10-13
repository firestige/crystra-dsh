import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { SquidexClient } from '../../src/backend/squidex-client.js';
import { digest } from '../../src/backend/value.js';
const id='12345678-1234-1234-1234-123456789012',data={body:{iv:'published'}};
const reference={id,published_version:2,publication_event_id:'p2',actor:'client:owner',data_hash:digest(data)};
async function fixture(action){
 const requests=[];let withdrawn=false;
 const server=createServer(async(req,res)=>{
  const buffers=[];for await(const b of req)buffers.push(b);
  requests.push({method:req.method,url:req.url,base:req.headers['if-match'],body:Buffer.concat(buffers).toString()});
  const url=new URL(req.url,'http://localhost');let body;
  if(url.pathname.endsWith('/history'))body=[{eventType:'ContentStatusChangedEventV2',version:2,eventId:'p2',actor:'client:owner'}];
  else if(url.searchParams.get('version')==='2')body={id,version:2,status:'Published',schemaId:'schema',data};
  else body={id,version:5,status:'Published',schemaId:'schema',data};
  if(withdrawn&&!url.search){res.writeHead(404);res.end('{}');return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const client=new SquidexClient({baseUrl:`http://127.0.0.1:${server.address().port}`,app:'test',schema:'agreements',managementToken:async()=>'test-management',consumerToken:async()=>'test-read'});
 try{await action(client,requests,()=>withdrawn=true);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('resolves exact publication event, not aggregate version; wrong actor/event/hash and withdrawal fail',()=>fixture(async(client,_reqs,withdraw)=>{
 assert.deepEqual((await client.resolve(reference)).reference,reference);
 for(const wrong of [{...reference,actor:'someone'},{...reference,publication_event_id:'wrong'},{...reference,data_hash:'a'.repeat(64)}])await assert.rejects(client.resolve(wrong));
 withdraw();await assert.rejects(client.resolve(reference));
}));
test('client constructs quoted CAS headers and exposes no generic/bulk write path',()=>fixture(async(client,requests)=>{
 await client.mutate({type:'modify',id,base:'"2"',data});
 assert.equal(requests[0].base,'"2"');assert.equal(requests[0].url,`/api/content/test/agreements/${id}`);
 await assert.rejects(client.mutate({type:'modify',id,base:'hash',data}));
 await assert.rejects(client.mutate({type:'bulk',id,data}));assert.equal(requests.length,1);
}));
