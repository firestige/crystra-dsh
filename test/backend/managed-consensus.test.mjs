import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ManagedConsensus } from '../../src/backend/managed-consensus.js';
import { digest } from '../../src/backend/value.js';
const data={body:{iv:'local only'},scope:{iv:'project:P'}};
function fixture(){
 let stored=null,offline=false,fail=false,writes=0;
 let content={id:randomUUID(),version:2,status:'Ready',data:structuredClone(data)};
 const journal={read:async()=>structuredClone(stored),append:async state=>{if(fail)throw Error('disk');stored=structuredClone(state);}};
 const client={inspect:async()=>structuredClone(content), mutate:async command=>{writes++;if(offline)throw Error('response lost');if(command.base&&command.base!==`"${content.version}"`)return {status:412,body:{}};content={...content,version:content.version+1,status:command.type==='publish'?'Published':content.status};return {status:200,body:structuredClone(content)};}, referenceAt:async(id,version)=>({id,published_version:version,publication_event_id:'publication',actor:'client:owner',data_hash:digest(content.data)}),historical:async()=>({data:structuredClone(data)})};
 const options={namespace:'test-consensus',journal,client,principals:{A1:'Proposer',U1:'Publisher',U2:'Publisher',R1:'Reader'}};
 return {options,journal,client,get content(){return content;},set content(v){content=v;},get writes(){return writes;},offline:()=>offline=true,fail:()=>fail=true};
}
const grantFor=(manager,f)=>manager.authorize('U1',{id:f.content.id,base:`"${f.content.version}"`,dataHash:digest(f.content.data),reason:'Approved this exact candidate.'});
test('rejects invalid baselines, roles, unknown commands and caller-controlled bypass flags before writing',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options);
 for(const base of [undefined,2,'2','*','W/"hash"','"-1"'])await assert.rejects(m.execute('A1',{operationId:randomUUID(),type:'modify',id:f.content.id,base,data}));
 for(const type of ['publish','withdraw','restore','bulk'])await assert.rejects(m.execute('R1',{operationId:randomUUID(),type,id:f.content.id,base:'"2"',data}));
 await assert.rejects(m.execute('A1',{operationId:randomUUID(),type:'modify',id:f.content.id,base:'"2"',data,doNotValidateWorkflow:true}));
 assert.equal(f.writes,0);
});
test('authorization survives reopening and binds candidate, subject and single operation',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options),grantId=await grantFor(m,f);
 const reopened=await ManagedConsensus.open(f.options);
 await assert.rejects(reopened.execute('U2',{operationId:randomUUID(),type:'publish',grantId}));
 const command={operationId:randomUUID(),type:'publish',grantId};
 const result=await reopened.execute('U1',command);
 assert.equal(result.state,'confirmed_success');assert.equal(result.reference.published_version,3);
 assert.deepEqual(await reopened.execute('U1',command),result);assert.equal(f.writes,1);
 await assert.rejects(reopened.execute('U1',{...command,operationId:randomUUID()}));
});
test('changed candidate and revoked authorization cannot publish',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options),grantId=await grantFor(m,f);
 f.content={...f.content,version:3,data:{body:{iv:'changed'}}};
 await assert.rejects(m.execute('U1',{operationId:randomUUID(),type:'publish',grantId}));assert.equal(f.writes,0);
 const fresh=await grantFor(m,f);await m.revoke('U1',fresh,'No longer approved');
 await assert.rejects(m.execute('U1',{operationId:randomUUID(),type:'publish',grantId:fresh}));assert.equal(f.writes,0);
});
test('concurrent same operation replays once; different intent conflicts; CAS rejection stays rejected',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options),command={operationId:randomUUID(),type:'modify',id:f.content.id,base:'"0"',data};
 const [a,b]=await Promise.all([m.execute('A1',command),m.execute('A1',command)]);
 assert.deepEqual(a,b);assert.equal(a.state,'confirmed_rejected');assert.equal(a.status,412);assert.equal(f.writes,1);
 await assert.rejects(m.execute('A1',{...command,data:{body:{iv:'other'}}}));assert.equal(f.writes,1);
});
test('lost response remains Pending after reopening; no blind retry or inference from equal content',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options),grantId=await grantFor(m,f);f.offline();
 const command={operationId:randomUUID(),type:'publish',grantId};
 assert.equal((await m.execute('U1',command)).state,'pending');
 const reopened=await ManagedConsensus.open(f.options);
 assert.equal((await reopened.execute('U1',command)).state,'pending');assert.equal(f.writes,1);
});
test('persistence failure before transmission sends no mutation and poisons the manager',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options);f.fail();
 await assert.rejects(m.execute('A1',{operationId:randomUUID(),type:'modify',id:f.content.id,base:'"2"',data}),/disk/);
 assert.equal(f.writes,0);
 await assert.rejects(m.execute('A1',{operationId:randomUUID(),type:'modify',id:f.content.id,base:'"2"',data}),/unavailable/);
});
test('loss after successful CMS response before durable receipt remains Pending on cold read',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options),grantId=await grantFor(m,f);
 const original=f.client.mutate;f.client.mutate=async command=>{const response=await original(command);f.fail();return response;};
 const command={operationId:randomUUID(),type:'publish',grantId};
 await assert.rejects(m.execute('U1',command),/disk/);
 const reopened=await ManagedConsensus.open(f.options);
 assert.equal((await reopened.execute('U1',command)).state,'pending');assert.equal(f.writes,1);
});
test('missing publication history keeps known response Pending until exact reference is resolved',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options),grantId=await grantFor(m,f),referenceAt=f.client.referenceAt;
 f.client.referenceAt=async()=>{throw Error('projection lag');};
 const command={operationId:randomUUID(),type:'publish',grantId};
 assert.equal((await m.execute('U1',command)).state,'pending');
 f.client.referenceAt=referenceAt;
 assert.equal((await m.reconcile('U1',command.operationId)).state,'confirmed_success');assert.equal(f.writes,1);
});
test('an explicitly dependent pending operation blocks resolution without invalidating unrelated bindings',async()=>{
 const f=fixture();let reads=0;f.client.resolve=async ref=>{reads++;return {reference:ref,data,effective:true};};
 const m=await ManagedConsensus.open(f.options),grantId=await grantFor(m,f);f.offline();
 const cmd={operationId:randomUUID(),type:'publish',grantId};await m.execute('U1',cmd);
 const ref={id:f.content.id,published_version:2,publication_event_id:'p2',actor:'client:owner',data_hash:digest(data)};
 await assert.rejects(m.resolve(ref,{requiredOperations:[cmd.operationId]}),/operation/);assert.equal(reads,0);
 await m.resolve(ref);assert.equal(reads,1);
 await assert.rejects(m.resolve(ref,{requiredOperations:[randomUUID()]}),/operation/);
});
test('HTTP success without a matching operation result stays Pending',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options);
 f.client.mutate=async()=>({status:201,body:{id:randomUUID(),version:0,status:'Draft',data}});
 assert.equal((await m.execute('A1',{operationId:randomUUID(),type:'propose',id:randomUUID(),data})).state,'pending');
});
test('locally known withdrawal blocks an old binding even while CMS projection is stale',async()=>{
 const f=fixture();f.client.resolve=async reference=>({reference,data,effective:true});
 const original=f.client.mutate;f.client.mutate=async command=>{const response=await original(command);response.body.status='Archived';return response;};
 const m=await ManagedConsensus.open(f.options);
 const ref={id:f.content.id,published_version:2,publication_event_id:'p2',actor:'client:owner',data_hash:digest(data)};
 await m.execute('U1',{operationId:randomUUID(),type:'withdraw',id:f.content.id,base:'"2"'});
 await assert.rejects(m.resolve(ref),/withdrawn/);
});
test('malformed successful result cannot turn remote uncertainty into a thrown validation failure',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options),id=randomUUID();
 f.client.mutate=async()=>({status:201,body:{id,version:0,status:'Draft'}});
 assert.equal((await m.execute('A1',{operationId:randomUUID(),type:'propose',id,data})).state,'pending');
});
test('proposer cannot use host owner credentials to return an archived object to draft',async()=>{
 const f=fixture(),m=await ManagedConsensus.open(f.options);f.content={...f.content,status:'Archived'};
 for(const type of ['returnDraft','draft'])await assert.rejects(m.execute('A1',{operationId:randomUUID(),type,id:f.content.id,base:'"2"'}));
 assert.equal(f.writes,0);
});
