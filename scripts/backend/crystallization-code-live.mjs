// Explicit local experiment: actual model generates Python assets; no prepared candidate implementation.
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter,createUserMessage} from '@deepseek-ai/dsh-llm';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import * as backend from '../../src/backend/index.js';
import * as lifecycle from '../../src/backend/dsh-pi-ai-lifecycle.js';
const root=resolve(import.meta.dirname,'../..'),output=resolve(root,process.env.CRYSTRA_CODE_OUTPUT??'artifacts/backend-rebuild/crystallization-code-live');
await mkdir(output,{recursive:true});
const cases=[[3,1,3],[0,-2,0,8],[5,-1,5,0],[],[9,3],[10,10,-4],[1,7,1]];
const expected=values=>({unique:[...new Set(values)].sort((a,b)=>a-b),sum:values.reduce((a,b)=>a+b,0)});
const contract='Recurring high-volume pure local work. Input: {values: array of integers, each between -1000000 and 1000000 inclusive, length 0 through 100}. Output: {unique: ascending sorted distinct input values, sum: sum of ALL input values including duplicates}. Empty input yields {unique:[],sum:0}. No external state or network. Guard must decline inputs outside the contract. Check must verify the output against the supplied input. Crystallization candidates are Python scripts; validate exits successfully only for valid code, guard/check print JSON booleans, execute writes output.json. Scripts receive input.json, output.json, context.json as three arguments.';
let ctx,serial=0,bodies=0;const results=[];
class Business extends LlmAdapter{
 async *stream(options){const message=JSON.parse(options.messages.find(m=>m.role==='user').content[0].text);const used=options.messages.some(m=>m.source?.kind==='tool'||m.content?.some(b=>b.type==='tool-result'));const block=used?{type:'text',text:'Completed ordinary work.'}:{type:'tool-call',id:randomUUID(),name:'summarize_values',arguments:JSON.stringify({input:message.input})};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:used?'stop':'tool-calls'}};}
}
async function host(){
 const ctx=new Context(),load=async(n,c={})=>{const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,c);};
 for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);
 await load('dsh-credentials-local',{path:process.env.CRYSTRA_CREDENTIALS_PATH,watch:false});
 await load('dsh-llm-pi-ai',{providers:{'openai-codex':{transport:'sse',retryPolicy:{mode:'normal',maxRetries:1}}}});
 await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});await load('dsh-tools',{mode:'native'});
 await load('dsh-session-persistence-jsonl',{root:join(output,'sessions'),compression:'none'});await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});await ctx.plugin(lifecycle);
 ctx.llm.registerAdapter(['crystal-business-fixture'],new Business());
 await ctx.plugin(backend,{resolveConsensus:async()=>{throw Error('Not a Barrier experiment');},crystallization:{namespace:'code-live',context:async()=>({contract,revision:1}),code:{root:join(output,'code'),python:'/usr/bin/python3',timeoutMs:3000},agentOptions:{provider:'openai-codex',model:process.env.CRYSTRA_CODE_MODEL??'gpt-6-astra',reasoningEffort:'high',maxTokens:12000},timeoutMs:300000}});
 return ctx;
}
async function work(values){
 const worker=await ctx.agents.create({sessionId:`code-live-worker-${++serial}-${randomUUID()}`,agentOptions:{provider:'crystal-business-fixture',model:'business'},setup(ac){ac.tools.restrict({allow:[]});ac.tools.register({name:'summarize_values',description:contract,parameters:{type:'object'},output:{schema:{type:'object'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:({input})=>{bodies++;return expected(input.values);}});}});
 try{
  const before=bodies;worker.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:JSON.stringify({input:{values}})}]}));await worker.agent.whenIdle();await ctx.crystraCrystallization.whenIdle();
  const events=worker.agent.session.snapshotEvents(),result=events.find(e=>e.type==='tool/result'),actual=JSON.parse(result.data.message.content[0].content[0].text);assert.deepEqual(actual,expected(values));await ctx.sessions.flush(worker.agent.session);
  const row={sessionId:worker.agent.session.id,values,actual,original:bodies>before};results.push(row);await writeFile(join(output,'progress.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({batch:serial,original:row.original,accepted:true}));
 }finally{await worker.dispose();}
}
try{
 ctx=await host();for(const values of cases.slice(0,5))await work(values);
 let service=await ctx.crystraCrystallization.ready,state=service.snapshot();await writeFile(join(output,'before-change.json'),JSON.stringify(state,null,2));
 const family=Object.values(state.families)[0];assert(family.active,'Real evaluation did not admit a candidate');assert(results.slice(2).some(r=>!r.original),'No actual script takeover observed');
 const entry=await ctx.crystraCodeCapabilities.describe(family.active.reference.id);await writeFile(join(output,'code',entry.snapshot,entry.execute[0]),'raise RuntimeError("deliberately modified after qualification")\n');
 const before=bodies;await work(cases[5]);assert.equal(bodies,before+1,'Changed candidate must return to original work');
 await writeFile(join(output,'after-change.json'),JSON.stringify(service.snapshot(),null,2));
 await ctx.fiber.dispose();ctx=null;ctx=await host();await work(cases[6]);service=await ctx.crystraCrystallization.ready;
 const final=service.snapshot();assert.equal(results[6].original,false,'Restart must restore actual code takeover');assert(Object.values(final.families).some(f=>f.jobs.filter(j=>j.status==='promoted').length>=2),'Changed code must requalify before restored takeover');await writeFile(join(output,'result.json'),JSON.stringify({passed:true,results,state:final,businessModel:'deterministic fixture',evaluationModel:process.env.CRYSTRA_CODE_MODEL??'gpt-6-astra',note:'Actual model-generated Python files execute in subprocesses; no monetary benefit claim.'},null,2));
 console.log(JSON.stringify({passed:true,batches:results.length,originalBodies:bodies,jobs:Object.values(final.families).flatMap(f=>f.jobs.map(j=>({status:j.status,evaluation:j.evaluation})))}));
}catch(error){await writeFile(join(output,'failure.json'),JSON.stringify({error:error.message,stack:error.stack,results},null,2));console.error(error.message);process.exitCode=1;}
finally{await ctx?.fiber.dispose();}
