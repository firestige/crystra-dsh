import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Context} from '@deepseek-ai/cordis';
import {LlmAdapter} from '@deepseek-ai/dsh-llm';
import * as backend from '../../src/backend/index.js';
async function host(root,adapter,timeoutMs=3000) {
  const ctx=new Context();
  const load=async(n,c={})=>{const m=await import('@deepseek-ai/'+n);await ctx.plugin(m.default??m,c);};
  for(const n of ['dsh-session','dsh-session-projection','dsh-agent','dsh-llm'])await load(n);
  await load('dsh-system-prompt',{includeHarnessIdentity:false,includeRuntimeContext:false});
  await load('dsh-tools',{mode:'native'});
  await load('dsh-session-persistence-jsonl',{root,compression:'none'});
  await load('dsh-agent-loop',{agents:[],maxParallelToolCalls:1});
  ctx.llm.registerAdapter(['reflection-fixture'],adapter);
  await ctx.plugin(backend,{resolveConsensus:async()=>{throw Error('Reflection must not load worker consensus');},reflection:{agentOptions:{provider:'reflection-fixture',model:'quality-model'},timeoutMs}});
  return ctx;
}
const report=(evidence=[])=>({summary:'Known boundary defect reproduced; performance remains unverified.',assessments:{correctness:'A failing regression demonstrates the boundary defect.',robustness:'Empty input needs an explicit contract.',performance:'No comparative measurement; unresolved.'},findings:[{axis:'correctness',file:'core.mjs',observation:'The public regression fails.',recommendation:'Include the upper bound and rerun the regression.',evidence}]});
class Fixture extends LlmAdapter {
  calls=0;
  constructor(mode,dir){super();this.mode=mode;this.dir=dir;}
  async *stream(options) {
    this.calls++;
    const toolNames=options.tools.map(t=>t.name);
    assert(!toolNames.includes('crystra_declare_step'));
    assert(!toolNames.includes('global_write'));
    let block;
    if(this.calls===1)block={type:'tool-call',id:'read',name:'crystra_reflection_read',arguments:JSON.stringify({file:'core.mjs'})};
    else if(this.calls===2&&this.mode==='unsupported')block={type:'tool-call',id:'invented',name:'crystra_reflection_report',arguments:JSON.stringify(report(['never-executed']))};
    else if(this.calls===2)block={type:'tool-call',id:'run',name:'crystra_reflection_experiment',arguments:JSON.stringify({id:'regression'})};
    else if(this.calls===3&&this.mode!=='unsupported') {
      if(this.mode==='stale')await writeFile(join(this.dir,'core.mjs'),'export const upper=3;\n');
      block={type:'tool-call',id:'report',name:'crystra_reflection_report',arguments:JSON.stringify(report(['experiment:1']))};
    } else block={type:'text',text:'Done.'};
    yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};
  }
}
for(const mode of ['completed','unsupported','stale'])test(`independent native reflection: ${mode}`,{timeout:10000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-reflect-'));let ctx;
  try {
    await writeFile(join(dir,'core.mjs'),'export const upper=2;\n');
    await writeFile(join(dir,'public.test.mjs'),"import {upper} from './core.mjs';import assert from 'node:assert/strict';assert.equal(upper,3);\n");
    ctx=await host(join(dir,'sessions'),new Fixture(mode,dir));
    ctx.tools.register({name:'global_write',description:'Must be unavailable',parameters:{type:'object'},output:{schema:{type:'object'},render:()=>[]},execute:()=>{throw Error('Unexpected write');}});
    const result=await ctx.crystraReflection.run({root:dir,files:['core.mjs','public.test.mjs'],goal:'Check correctness, robustness and performance without changing source.',experiments:[{id:'regression',command:process.execPath,args:['--test','public.test.mjs']}]});
    assert.equal(result.status,mode==='unsupported'?'incomplete':mode,JSON.stringify(result));
    assert.equal(result.model.model,'quality-model');
    if(mode!=='unsupported') {
      assert.equal(result.experiments[0].exitCode,1,JSON.stringify(result.experiments[0]));
      assert.match(result.experiments[0].stdout,/AssertionError|not ok/);
      assert.equal(result.report.findings[0].evidence[0],'experiment:1');
    } else {assert.equal(result.report,null);assert.match(JSON.stringify(result.events),/Unknown experiment evidence/);}
    assert(!('decision' in result));
    assert.equal(result.events.filter(e=>e.type==='tool/call'&&e.data.name==='crystra_reflection_experiment').length,mode==='unsupported'?0:1);
    await ctx.fiber.dispose();ctx=null;
    // A fresh host can load the final receipt without invoking a model or re-running tests.
    ctx=await host(join(dir,'sessions'),new Fixture('unused',dir));
    const saved=await ctx.crystraReflection.read(result.id);
    assert.equal(saved.status,result.status);assert.deepEqual(saved.report,result.report);
  }finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('reflection ends incomplete when the model stops without a report',{timeout:5000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-reflect-empty-'));let ctx;
  class Empty extends LlmAdapter{async *stream(){yield {type:'block-start',index:0,blockType:'text'};yield {type:'block-end',index:0,block:{type:'text',text:'All good, no tools used.'}};yield {type:'finish',reason:{kind:'stop'}};}}
  try{await writeFile(join(dir,'core.mjs'),'export default 1;');ctx=await host(join(dir,'sessions'),new Empty());const r=await ctx.crystraReflection.run({root:dir,files:['core.mjs'],goal:'Review core',experiments:[]});assert.equal(r.status,'incomplete',JSON.stringify(r));assert.equal(r.report,null);}finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('reflection timeout stops its DSH loop and does not produce a quality decision',{timeout:5000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-reflect-timeout-'));let ctx;
  class Slow extends LlmAdapter{async *stream(options){await new Promise(resolve=>{const t=setTimeout(resolve,2000);options.signal?.addEventListener('abort',()=>{clearTimeout(t);resolve();},{once:true});});yield {type:'finish',reason:{kind:'stop'}};}}
  try{await writeFile(join(dir,'core.mjs'),'export default 1;');ctx=await host(join(dir,'sessions'),new Slow(),30);const r=await ctx.crystraReflection.run({root:dir,files:['core.mjs'],goal:'Review core',experiments:[]});assert.equal(r.status,'timed_out',JSON.stringify(r));assert.equal(r.report,null);assert(!('decision' in r));}finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('reflection rejects a core file outside the selected root before model invocation',{timeout:5000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-reflect-scope-'));let ctx;
  try{ctx=await host(join(dir,'sessions'),new Fixture('unused',dir));await assert.rejects(ctx.crystraReflection.run({root:dir,files:['../not-selected'],goal:'Review core',experiments:[]}),/ENOENT|escapes root/);}finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('performance reflection retains repeated measurements, not a claimed speedup',{timeout:10000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-reflect-perf-'));let ctx;
  class Perf extends LlmAdapter {
    n=0;
    async *stream(){this.n++;const call=(id,name,args)=>({type:'tool-call',id,name,arguments:JSON.stringify(args)});const block=this.n===1?call('r','crystra_reflection_read',{file:'core.mjs'}):this.n===2?call('p','crystra_reflection_experiment',{id:'samples'}):this.n===3?call('f','crystra_reflection_report',{summary:'Only an absolute measurement; no candidate comparison.',assessments:{correctness:'Fixture returns 1.',robustness:'No edge coverage.',performance:'Three raw samples, no speedup inferred.'},findings:[{axis:'performance',file:'core.mjs',observation:'Recorded raw samples.',recommendation:'Compare a candidate with identical input and warmup.',evidence:['experiment:1']}]}):{type:'text',text:'Finished'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};}
  }
  try{await writeFile(join(dir,'core.mjs'),'export default 1;');ctx=await host(join(dir,'sessions'),new Perf());const r=await ctx.crystraReflection.run({root:dir,files:['core.mjs'],goal:'Evaluate measurements without fabricating comparison',experiments:[{id:'samples',command:process.execPath,args:['-e','console.log(JSON.stringify({samples:[1,2,3],unit:"ms",inputSize:100}))']}]});assert.equal(r.status,'completed');assert.deepEqual(JSON.parse(r.experiments[0].stdout).samples,[1,2,3]);assert.equal(r.report.findings[0].axis,'performance');}finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('worker can request independent reflection and receives a compact report, without Barrier attachment',{timeout:10000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-reflect-worker-'));let ctx,worker;
  const reviewer=new Fixture('completed',dir);let calls=0;
  class Worker extends LlmAdapter{async *stream(options){if(options.model==='quality-model'){yield* reviewer.stream(options);return;}calls++;const block=calls===1?{type:'tool-call',id:'reflect',name:'crystra_reflect_core',arguments:JSON.stringify({goal:'Verify the upper boundary and identify concrete fixes.'})}:{type:'text',text:'Use reflection findings to plan subsequent work.'};yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};}}
  try {
    await writeFile(join(dir,'core.mjs'),'export const upper=2;\n');await writeFile(join(dir,'public.test.mjs'),"import {upper} from './core.mjs';import assert from 'node:assert/strict';assert.equal(upper,3);\n");
    ctx=await host(join(dir,'sessions'),new Worker());
    worker=await ctx.agents.create({sessionId:'quality-requester',agentOptions:{provider:'reflection-fixture',model:'worker'},setup:(ac,agent)=>{ctx.crystraReflection.attach(ac,agent,async(actual,goal)=>{assert.equal(actual,agent);return {root:dir,files:['core.mjs'],goal,experiments:[{id:'regression',command:process.execPath,args:['--test','public.test.mjs']}]};});}});
    const {createUserMessage}=await import('@deepseek-ai/dsh-llm');worker.agent.followup(createUserMessage({source:{kind:'human'},content:[{type:'text',text:'Ask for core-code reflection.'}]}));await worker.agent.whenIdle();
    const events=worker.agent.session.snapshotEvents();const result=events.find(e=>e.type==='tool/result');const body=JSON.parse(result.data.message.content[0].content[0].text);
    assert.equal(body.status,'completed');assert.equal(body.report.findings[0].axis,'correctness');assert(!('events' in body));assert(!('decision' in body));assert.equal(events.findLast(e=>e.type==='turn/end').data.reason.kind,'completed');
  } finally {await worker?.dispose();await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
test('caller cancellation is propagated to the reflection agent',{timeout:5000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'crystra-reflect-cancel-'));let ctx;
  class Slow extends LlmAdapter{async *stream(options){await new Promise(resolve=>{const t=setTimeout(resolve,2000);options.signal.addEventListener('abort',()=>{clearTimeout(t);resolve();},{once:true});});yield {type:'finish',reason:{kind:'stop'}};}}
  try{await writeFile(join(dir,'core.mjs'),'export default 1;');ctx=await host(join(dir,'sessions'),new Slow(),4000);const controller=new AbortController();const pending=ctx.crystraReflection.run({root:dir,files:['core.mjs'],goal:'Review core',experiments:[]},{signal:controller.signal});setTimeout(()=>controller.abort(),40);const r=await pending;assert.equal(r.status,'cancelled',JSON.stringify(r));}finally{await ctx?.fiber.dispose();await rm(dir,{recursive:true,force:true});}
});
