import test from 'node:test';import assert from 'node:assert/strict';
import {compileCommitment,verifyCommitment} from '../../src/backend/barrier.js';
import {Controller} from '../../src/backend/controller.js';import {digest} from '../../src/backend/value.js';
import {observeNativeOutcomes} from '../fixtures/outcome-spike-worker.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const action={id:'run',kind:'result-equals',tool:'run',match:{case:'public'},path:['exitCode'],equals:0};
const call={seq:1,type:'tool/call',data:{callId:'c',name:'run',arguments:'{"case":"public"}'}};
const block=(id,exitCode)=>({type:'tool-result',toolCallId:id,content:[{type:'text',text:JSON.stringify({exitCode})}]});
const result=blocks=>({seq:2,type:'tool/result',sourceEventSeqs:[1],data:{message:{source:{callId:'c'},content:blocks}}});
const observations=[];
test('artificial duplicate target blocks fail closed, distinct-ID and fragmented text remain unambiguous',()=>{
 const goal=compileCommitment({label:'Run',actions:[action]},{sessionId:'s',seq:0,stepId:'step'},[]);
 const cases=[...[[0,1],[1,0],[0,0]].map(pair=>({name:`duplicate-${pair}`,blocks:pair.map(n=>block('c',n)),want:'NO_GO'})),{name:'target-and-unrelated',blocks:[block('c',0),block('other',1)],want:'GO'},{name:'fragmented-text',blocks:[{...block('c',0),content:[{type:'text',text:'{"exit'},{type:'text',text:'Code":0}'}]}],want:'GO'}];
 for(const c of cases){const evidence={sessionId:'s',seq:2,events:[call,result(c.blocks)]};const verdict=verifyCommitment(goal,evidence,[]);assert.equal(verdict.decision,c.want,c.name);observations.push({kind:'artificial',name:c.name,evidence,verdict});}
});
test('artificial result ambiguity does not erase active or inherited pending responsibility',async()=>{
 for(const pair of [[0,1],[1,0],[0,0],'events']){
 let stored=null,events=[];const data={body:'fixture'},ref={id:'c',published_version:1,publication_event_id:'p',actor:'user:owner',data_hash:digest(data)};
 const options={workerSessionId:'s',journal:{read:async()=>structuredClone(stored),append:async s=>{stored=structuredClone(s);}},resolve:async()=>({reference:ref,data,effective:true}),evidence:async()=>({sessionId:'s',seq:events.at(-1)?.seq??0,events})};
 const c=await Controller.open(options,{scope:'fixture',references:[ref]});
 const keep={id:'keep',kind:'tool-completed',tool:'prepare',match:{case:'public'}};
 await c.declare({label:'prepare and run',actions:[keep,action]});events=[{...call,data:{...call.data,name:'prepare'}},result([block('c',0)])];
 assert.equal(await c.revise({baseVersion:1,reason:'Preparation done; run remains pending',retain:['keep'],defer:['run']}),'GO');
 const pending=c.snapshot().pending;assert.equal(pending.length,1);
 assert.equal(await c.declare({label:'inherited run',actions:[action],inherits:[pending[0].id]}),'GO');const before=c.snapshot();
 const newCall={...call,seq:3};
 const outcomes=pair==='events'?[{...result([block('c',1)]),seq:4,sourceEventSeqs:[3]},{...result([block('c',0)]),seq:5,sourceEventSeqs:[3]}]:[{...result(pair.map(n=>block('c',n))),seq:4,sourceEventSeqs:[3]}];
 events.push(newCall,...outcomes);assert.equal(await c.finish(),'NO_GO');const after=c.snapshot();for(const key of ['active','pending','history','nextStep'])assert.deepEqual(after[key],before[key]);const restored=await Controller.open(options);assert.deepEqual(restored.snapshot(),after);
 }
});
test('native normal/error results persist once and two fresh DSH resumes do not append duplicates',{timeout:15000},async()=>{
 const o=await observeNativeOutcomes();const calls=o.events.filter(e=>e.type==='tool/call'),results=o.events.filter(e=>e.type==='tool/result');assert.equal(calls.length,2);assert.equal(results.length,2);
 for(const c of calls){const linked=results.filter(r=>r.sourceEventSeqs.length===1&&r.sourceEventSeqs[0]===c.seq);assert.equal(linked.length,1);const blocks=linked[0].data.message.content.filter(b=>b.type==='tool-result'&&b.toolCallId===c.data.callId);assert.equal(blocks.length,1);assert.equal(Boolean(blocks[0].isError),c.data.name==='throws');}
 assert.equal(o.decision,'NO_GO');for(const key of ['active','pending','history','nextStep'])assert.deepEqual(o.state[key],o.declared[key]);
 for(const events of o.readOnly)assert.deepEqual(events,o.events);assert.deepEqual(o.filesAfterReadOnly,o.filesBefore);
 for(const restored of o.restores){assert.deepEqual(restored.events.slice(0,o.events.length),o.events);assert(restored.events.slice(o.events.length).every(e=>e.type==='session/end-seed'));assert.deepEqual(restored.events.filter(e=>e.type==='tool/result'),results);assert.deepEqual(restored.state,o.state);}
 for(const [path,bytes] of Object.entries(o.filesBefore)){assert(o.filesAfter[path].startsWith(bytes));if(path.includes('crystra-backend-'))assert.equal(o.filesAfter[path],bytes);}
 if(process.env.OUTCOME_SPIKE_SAVE){const dir='artifacts/backend-rebuild/outcome-resource-spike';await mkdir(dir,{recursive:true});await writeFile(`${dir}/outcomes-evidence.json`,JSON.stringify({observations,native:o},null,2)+'\n');}
});
