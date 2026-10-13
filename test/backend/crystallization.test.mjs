import {nativeCrystallizationConfig} from '../../src/backend/dsh-evidence.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {Crystallization} from '../../src/backend/crystallization.js';
import {digest} from '../../src/backend/value.js';
function fixture(extra={}){
 let stored=null,failWrite=false,basis=1,version=1,mode='ok',decision='candidate',originals=0,evaluations=0,runs=[];
 const sessions=new Map();
 const material=()=>({id:'double',version,source:'x => x * 2',basis});
 const ref=()=>({id:'double',version,hash:digest(material())});
 const config={namespace:'test',context:async()=>({basis}),original:async request=>{
  originals++;const id='s'+originals,output=request.input.x*2;
  sessions.set(id,[{seq:1,type:'tool/call',data:{callId:'c',name:'double',arguments:JSON.stringify({input:request.input})}},{seq:2,type:'tool/result',sourceEventSeqs:[1],data:{message:{source:{callId:'c'},content:[{type:'tool-result',toolCallId:'c',content:[{type:'text',text:JSON.stringify(output)}]}]}}}]);
  return {sessionId:id,callSeq:1,resultSeq:2};
 },readEvents:async id=>sessions.get(id),evaluate:async()=>{evaluations++;return decision==='candidate'?{decision,reference:ref(),reason:'Repeated independent work'}:{decision,reason:'Not worthwhile yet'};},resolve:async()=>({reference:ref(),material:material(),guard:input=>input.x>=0,run:async(input,info)=>{runs.push(info.mode);if(mode==='throw')throw Error('parser changed');return mode==='wrong'?999:input.x*2;},check:output=>typeof output==='number'&&output!==999}),...extra};
 const journal={read:async()=>structuredClone(stored),append:async state=>{if(failWrite)throw Error('disk failed');stored=structuredClone(state);}};
 return {config,journal,get state(){return stored;},get originals(){return originals;},get evaluations(){return evaluations;},get runs(){return runs;},basis:n=>basis=n,version:n=>version=n,mode:n=>mode=n,decision:n=>decision=n,fail:()=>failWrite=true};
}
const request=x=>({scope:'college',boundary:'double',input:{x}});
test('two different native originals trigger independent evaluation and reverse shadow; later work takes over',async()=>{
 const f=fixture(),c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);
 assert.equal((await c.run(request(1))).path,'original');assert.equal(f.evaluations,0);
 assert.equal((await c.run(request(1))).path,'original');assert.equal(f.evaluations,0,'Repeated input is not a second independent qualification');
 assert.equal((await c.run(request(2))).path,'original');assert.equal(f.evaluations,1);
 assert.deepEqual(f.runs,['shadow','shadow']);
 const s=c.snapshot(),family=Object.values(s.families)[0];assert.equal(family.jobs[0].status,'promoted');assert.deepEqual(family.jobs[0].shadows.map(s=>s.inputHash),[digest({x:2}),digest({x:1})]);
 assert.equal((await c.run(request(3))).path,'crystallized');assert.equal(f.originals,3);assert.equal(f.evaluations,1);
 const restored=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);assert.equal((await restored.run(request(4))).output,8);assert.equal(f.originals,3);
});
test('defer and decline persist without triggering an evaluation loop on duplicate input',async()=>{
 for(const choice of ['defer','decline']){const f=fixture();f.decision(choice);const c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await c.run(request(1));await c.run(request(2));await c.run(request(2));assert.equal(f.evaluations,1);assert.equal(Object.values(c.snapshot().families)[0].jobs[0].status,choice);assert.equal((await c.run(request(3))).path,'original');}
});
test('failed shadow never admits and changed version must requalify',async()=>{
 const f=fixture();f.mode('wrong');const c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await c.run(request(1));await c.run(request(2));assert.equal(Object.values(c.snapshot().families)[0].active,null);
 f.mode('ok');await c.run(request(3));await c.run(request(4));assert.equal((await c.run(request(5))).path,'crystallized');
 f.version(2);assert.equal((await c.run(request(6))).path,'original');assert.equal(Object.values(c.snapshot().families)[0].active.reference.version,2);assert.equal((await c.run(request(7))).path,'crystallized');
});
test('guard, execution failure and changed consensus return to original and permit new evaluation',async()=>{
 const f=fixture(),c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await c.run(request(1));await c.run(request(2));
 assert.equal((await c.run(request(-1))).path,'original');
 f.mode('throw');assert.equal((await c.run(request(3))).path,'original');
 f.mode('ok');await c.run(request(4));assert.equal((await c.run(request(5))).path,'crystallized');
 f.basis(2);assert.equal((await c.run(request(6))).path,'original');assert.equal((await c.run(request(7))).path,'original');assert.equal((await c.run(request(8))).path,'crystallized');
});
test('fake receipts and changed frozen material cannot provide admission evidence',async()=>{
 const f=fixture(),original=f.config.original;f.config.original=async r=>({...await original(r),callSeq:999});const c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await assert.rejects(c.run(request(1)),/native/);assert.equal(f.evaluations,0);
 const g=fixture(),resolve=g.config.resolve;g.config.resolve=async()=>({...await resolve(),material:{changed:true}});const d=await Crystallization.open(nativeCrystallizationConfig(g.config),g.journal);await d.run(request(1));await d.run(request(2));assert.equal(Object.values(d.snapshot().families)[0].active,null);
});
test('journal failure poisons mutation; reopened reads do not repeat original work or evaluation',async()=>{
 const f=fixture(),c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await c.run(request(1));f.fail();await assert.rejects(c.run(request(2)),/disk failed/);await assert.rejects(c.run(request(3)),/unavailable/);
 const n=f.originals,e=f.evaluations;await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);assert.equal(f.originals,n);assert.equal(f.evaluations,e);
});
test('native receipts cannot be reused under a different consensus identity',async()=>{
 const f=fixture(),original=f.config.original;let receipt;
 f.config.original=async r=>receipt??(receipt=await original(r));const c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);
 await c.run(request(1));f.basis(2);await assert.rejects(c.run(request(1)),/reused/);
});
test('version drift during shadow or live execution cannot return a crystallized result',async()=>{
 for(const phase of ['shadow','live']){
  const f=fixture(),resolve=f.config.resolve;let changed=false;
  f.config.resolve=async ref=>{const cap=await resolve(ref);return {...cap,run:async(input,info)=>{const output=await cap.run(input,info);if(info.mode===phase&&!changed){changed=true;f.version(2);}return output;}};};
  const c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await c.run(request(1));await c.run(request(2));
  if(phase==='shadow'){const family=Object.values(c.snapshot().families)[0];assert.equal(family.active,null);assert.equal(family.jobs[0].status,'failed');}
  else{assert.equal((await c.run(request(3))).path,'original');assert.equal(Object.values(c.snapshot().families)[0].active.reference.version,2);}
 }
});
test('context lookup failure stops execution rather than bypassing unknown consensus',async()=>{
 const f=fixture(),context=f.config.context;let broken=false;f.config.context=async r=>{if(broken)throw Error('consensus unavailable');return context(r);};
 const c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await c.run(request(1));await c.run(request(2));const n=f.originals;broken=true;
 await assert.rejects(c.run(request(3)),/consensus unavailable/);assert.equal(f.originals,n);
});
test('concurrent boundaries serialize evaluation and recovery marks an unfinished job interrupted',async()=>{
 const f=fixture(),c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await Promise.all([c.run(request(1)),c.run(request(2)),c.run(request(3))]);assert.equal(f.evaluations,1);assert.equal(f.originals,2);
 const state=c.snapshot(),family=Object.values(state.families)[0];family.active=null;family.jobs[0].status='running';await f.journal.append(state);
 const n=f.originals,e=f.evaluations,restored=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);assert.equal(Object.values(restored.snapshot().families)[0].jobs[0].status,'interrupted');assert.equal(f.originals,n);assert.equal(f.evaluations,e);
});
test('duplicate native result links and error results are not historical originals',async()=>{
 for(const mode of ['duplicate','error']){
  const f=fixture(),read=f.config.readEvents;f.config.readEvents=async id=>{const events=structuredClone(await read(id));if(mode==='duplicate')events.push({...events[1],seq:3});else events[1].data.message.content[0].isError=true;return events;};
  const c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await assert.rejects(c.run(request(1)),/native/i);assert.equal(f.evaluations,0);
 }
});
test('out-of-domain inputs fall back without rebuilding an otherwise valid capability',async()=>{
 const f=fixture(),c=await Crystallization.open(nativeCrystallizationConfig(f.config),f.journal);await c.run(request(1));await c.run(request(2));const n=f.evaluations;
 for(const x of [-1,-2,-3])assert.equal((await c.run(request(x))).path,'original');
 assert.equal(f.evaluations,n);assert.equal((await c.run(request(3))).path,'crystallized');
});
