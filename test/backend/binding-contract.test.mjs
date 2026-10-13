import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {Controller} from '../../src/backend/controller.js';import {digest} from '../../src/backend/value.js';
async function fixture(){let stored=null,fail=null;const data={body:{iv:'rule'}},reference=id=>({id,published_version:1,publication_event_id:'p',actor:'user',data_hash:digest(data)}),seed={scope:'P',references:[reference('old')]},target={scope:'P',references:[reference('new')]};
 const journal={read:async()=>structuredClone(stored),append:async s=>{if(fail==='before')throw Error('disk');stored=structuredClone(s);if(fail==='after')throw Error('flush');}};
 const options={workerSessionId:'worker',journal,resolve:async reference=>({reference,data,effective:true}),evidence:async()=>({sessionId:'worker',seq:0,executions:[]})};
 let controller=await Controller.open(options,seed);return {seed,target,journal,get controller(){return controller;},get stored(){return stored;},fail:v=>{fail=v;},reopen:async()=>{fail=null;controller=await Controller.open(options);return controller;}};
}
test('binding port returns only stable summary and persists an operation receipt independently of display reason',async()=>{
 const f=await fixture(),c=f.controller,id=randomUUID(),options={operationId:id,expectedRevision:0,reason:'Human-readable reason'};
 assert.deepEqual(c.bindingStatus(),{manifest:f.seed,revision:0,blocked:false});
 const receipt=await c.applyBinding(f.target,options);assert.equal(receipt.operationId,id);assert.equal(receipt.fromRevision,0);assert.equal(receipt.toRevision,1);
 const history=c.snapshot().bindingHistory;assert.equal(history[0].reason,options.reason);assert.equal(history[0].operationId,id);assert.equal(c.snapshot().schemaVersion,1);
 const restored=await f.reopen();assert.deepEqual(await restored.applyBinding(f.target,{...options,reason:'Changed wording'}),receipt);assert.equal(restored.snapshot().bindingHistory.length,1);
 await assert.rejects(restored.applyBinding(f.seed,options),/intent conflict/);await assert.rejects(restored.applyBinding(f.target,{...options,operationId:randomUUID()}),/does not match/);
});
test('legacy exact switch marker can recover and acquire a receipt; same target alone is insufficient',async()=>{
 const f=await fixture(),id=randomUUID(),reason='Old approval';await f.controller.setManifest(f.target,{expectedRevision:0,reason:`approval:${id}: ${reason}`});
 const c=await f.reopen();assert.equal(c.snapshot().bindingReceipts,undefined);
 for(const o of [{operationId:randomUUID(),reason},{operationId:id,reason:'wrong'}])await assert.rejects(c.applyBinding(f.target,{...o,expectedRevision:0}),/does not match/);
 const receipt=await c.applyBinding(f.target,{operationId:id,reason,expectedRevision:0});assert.equal(receipt.legacy,true);assert.equal(c.snapshot().bindingHistory.length,1);
 const again=await f.reopen();assert.deepEqual(await again.applyBinding(f.target,{operationId:id,reason:'New wording',expectedRevision:0}),receipt);
});
test('active or pending responsibility blocks binding even through direct port calls',async()=>{
 for(const type of ['active','pending']){const f=await fixture();await f.journal.append({...f.stored,...type==='active'?{active:{id:'unfinished'}}:{pending:[{id:'unfinished'}]}});const c=await f.reopen();
 assert.equal(c.bindingStatus().blocked,true);assert.throws(()=>c.assertBindingAvailable(),/responsibility/);
 const before=c.snapshot();await assert.rejects(c.applyBinding(f.target,{operationId:randomUUID(),expectedRevision:0,reason:'Must refuse'}),/responsibility/);assert.deepEqual(c.snapshot(),before);}
});
test('failed binding writes poison the instance; cold recovery distinguishes uncommitted and persisted receipts',async()=>{
 for(const phase of ['before','after']){const f=await fixture(),id=randomUUID(),o={operationId:id,expectedRevision:0,reason:'Durable receipt'};f.fail(phase);
 await assert.rejects(f.controller.applyBinding(f.target,o),/disk|flush/);assert.throws(()=>f.controller.bindingStatus(),/unavailable/);await assert.rejects(f.controller.applyBinding(f.target,o),/unavailable/);
 const c=await f.reopen();const receipt=await c.applyBinding(f.target,o);assert.equal(receipt.toRevision,1);assert.equal(c.snapshot().bindingHistory.length,1);assert.equal(c.snapshot().manifestRevision,1);}
});
test('a later independent switch cannot be hidden by replaying an earlier operation receipt',async()=>{
 const f=await fixture(),id=randomUUID(),o={operationId:id,expectedRevision:0,reason:'First'};await f.controller.applyBinding(f.target,o);await f.controller.setManifest(f.seed,{expectedRevision:1,reason:'Later change'});
 const c=await f.reopen();await assert.rejects(c.applyBinding(f.target,o),/does not match/);assert.deepEqual(c.bindingStatus().manifest,f.seed);assert.equal(c.bindingStatus().revision,2);
});
test('confirming an already applied operation does not switch again or erase later responsibility',async()=>{
 const f=await fixture(),id=randomUUID(),o={operationId:id,expectedRevision:0,reason:'Applied'};const receipt=await f.controller.applyBinding(f.target,o);
 await f.journal.append({...f.stored,active:{id:'later-step'},pending:[{id:'later-pending'}]});const c=await f.reopen(),before=c.snapshot();
 assert.deepEqual(await c.applyBinding(f.target,o),receipt);assert.deepEqual(c.snapshot(),before);
 assert.throws(()=>c.assertBindingAvailable(),/responsibility/);
});
test('invalid binding operation metadata does not persist or mutate the binding',async()=>{
 const f=await fixture(),before=f.controller.snapshot();for(const change of [{operationId:''},{expectedRevision:-1},{expectedRevision:1.5},{reason:''}])await assert.rejects(f.controller.applyBinding(f.target,{operationId:randomUUID(),expectedRevision:0,reason:'Valid',...change}));assert.deepEqual(f.controller.snapshot(),before);
});
test('legacy binding proof and new receipt survive separate native JSONL hosts',async()=>{
 const {Context}=await import('@deepseek-ai/cordis'),{openJournal}=await import('../../src/backend/dsh-journal.js'),{mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const root=await mkdtemp(join(tmpdir(),'binding-native-recovery-')),f=await fixture(),operationId=randomUUID(),reason='Historical activation';let ctx,journal;
 const open=async()=>{ctx=new Context();for(const name of ['dsh-session','dsh-session-persistence-jsonl']){const m=await import('@deepseek-ai/'+name);await ctx.plugin(m.default??m,name.endsWith('jsonl')?{root,compression:'none'}:{});}journal=await openJournal(ctx.sessionPersistence,'native-binding');return Controller.open({workerSessionId:'native-binding',journal,resolve:async reference=>({reference,data:{body:{iv:'rule'}},effective:true}),evidence:async()=>({sessionId:'native-binding',seq:0,executions:[]})},(await journal.read())?undefined:f.seed);};
 const stop=async()=>{await journal?.close();await ctx?.fiber.dispose();};
 try{
  let c=await open();await c.setManifest(f.target,{expectedRevision:0,reason:`approval:${operationId}: ${reason}`});await stop();
  c=await open();const receipt=await c.applyBinding(f.target,{operationId,expectedRevision:0,reason});assert.equal(receipt.legacy,true);await stop();
  c=await open();assert.deepEqual(await c.applyBinding(f.target,{operationId,expectedRevision:0,reason:'Wording changed'}),receipt);assert.equal(c.snapshot().manifestRevision,1);assert.equal(c.snapshot().bindingHistory.length,1);assert.equal(c.snapshot().schemaVersion,1);
 }finally{await stop();await rm(root,{recursive:true,force:true});}
});
