import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Session,SESSION_FORMAT_VERSION} from '@deepseek-ai/dsh-session';
import {createTaskAdmission} from '../src/host/task-admission.js';
import {createTaskControl} from '../src/host/task-control.js';
import {registerNativeTaskControl} from '../src/host/native-task-control.js';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'native-task-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const session=Session.create('native-task',[],{id:'native-task',version:SESSION_FORMAT_VERSION,cwd:root,createdAt:100,isSeeded:false});
 const listeners=new Map(),tools=new Map(),questions=[],messages=[],guards=[];
 const agent={session,inject:m=>messages.push(m)};
 const ctx={on:(n,f)=>{listeners.set(n,f);return()=>listeners.delete(n);},tools:{register:d=>{tools.set(d.name,d);return()=>tools.delete(d.name);},guard:f=>{guards.push(f);return()=>{};}},agents:{roots:()=>[agent]},sessions:{get:()=>session,flush:async()=>true},workspaceRegistry:{list:()=>[{id:'workspace',path:root,sessionIds:[session.id]}]},userQuestions:{ask:async r=>{questions.push(r);return{answers:r.questions.map(q=>({id:q.id,selected:['确认此版本']}))};}}};
 const runtime={control:{admitTask:async h=>h,planningCapabilities:async()=>({providers:[]})}};
 const admission=await createTaskAdmission({ctx,stateRoot:root,owner:()=>runtime.control});
 const control=createTaskControl({ctx,stateRoot:root,admission,runtime:()=>runtime});ctx.crystraTaskControl=control;
 registerNativeTaskControl(ctx);
 const assemble=async(provider='deepseek-official',target=agent)=>{const a={sections:[],contexts:[],tools:[],variables:{provider}};return listeners.get('system-prompt/assemble')(a,{agent:target,signal:new AbortController().signal},async()=>a);};
 await control.handle('tasks/admit',{sessionId:session.id});
 session.append('user/message',{id:'user-1',role:'user',source:{kind:'user'},content:[{type:'text',text:'中文文档，禁止发布'}]},{surfaceOp:'append'});
 const write=async(file,value)=>tools.get('crystra_write_task_document').execute({file,content:JSON.stringify(value)},{agent,signal:new AbortController().signal});
 const stop=()=>listeners.get('agent/turn-stopping')({agent,signal:new AbortController().signal});
 return {root,ctx,agent,control,admission,assemble,write,stop,questions,messages,guards};
}
function brief(taskId){return{schema:'crystra.brief@1',taskId,goal:'中文文档',scope:['文档'],nonGoals:['发布'],assumptions:[],questions:[],acceptance:['内容完整'],requestConfirmation:true,grilling:{round:1,budget:{initial:0,remaining:0},topics:[],questions:[]}};}
test('DeepSeek root Task receives current state, persists Brief and confirms through the native human question',async t=>{
 const f=await fixture(t),assembly=await f.assemble();
 assert.match(JSON.stringify(assembly),/crystra_write_task_document/);
 const task=(await f.admission.bindings())[0];await f.write('brief.json',brief(task.taskId));
 assert.equal((await f.control.flow.read(task)).brief.confirmed,false);
 await f.stop();const view=await f.control.flow.read(task);
 assert.equal(view.stage,'planning');assert.equal(view.brief.confirmed,true);assert.equal(f.questions.length,1);assert.equal(f.messages.length,1);
 assert.equal(f.messages[0].source.kind,'plugin');
 const second=await f.assemble();assert.match(JSON.stringify(second),/planning/);
 await f.stop();assert.equal(f.questions.length,1,'a confirmed digest must not be asked twice');
});
test('native Task denies implementation tools and only owns the three control documents',async t=>{
 const f=await fixture(t);await f.assemble();
 for(const name of ['bash','write','edit','str_replace_editor','spawn_agent','unknown'])assert.match(f.guards[0]({agent:f.agent,name,arguments:{}}),/CRYSTRA_TASK/);
 assert.equal(f.guards[0]({agent:f.agent,name:'read',arguments:{}}),undefined);
 await assert.rejects(f.write('../product.js',{}),/DOCUMENT/);
 await assert.rejects(f.write('confirmations.json',{}),/DOCUMENT/);
 const task=(await f.admission.bindings())[0],context=await f.control.flow.prepare(task);
 const outside=join(f.root,'outside.json');await writeFile(outside,'unchanged');await symlink(outside,join(context.artifactRoot,'brief.json'));
 await f.write('brief.json',brief(task.taskId));assert.equal(await readFile(outside,'utf8'),'unchanged');
});
test('external adapters, child agents and ordinary sessions are not captured by native Task orchestration',async t=>{
 const f=await fixture(t);
 assert.deepEqual((await f.assemble('crystra-codex')).contexts,[]);await f.stop();assert.equal(f.questions.length,0);
 assert.deepEqual((await f.assemble('deepseek-official',{session:f.agent.session})).contexts,[]);
 f.ctx.crystraTaskControl={forSession:async()=>undefined};assert.deepEqual((await f.assemble()).contexts,[]);
 assert.equal(f.guards[0]({agent:f.agent,name:'bash'}),undefined);
 await assert.rejects(f.write('brief.json',{}),/TASK_UNAVAILABLE/);
});
test('cancelled native confirmation cannot commit approval',async t=>{
 const f=await fixture(t);await f.assemble();const task=(await f.admission.bindings())[0];await f.write('brief.json',brief(task.taskId));
 f.ctx.userQuestions.ask=async()=>{throw new Error('question cancelled');};await assert.rejects(f.stop(),/question cancelled/);
 assert.equal((await f.control.flow.read(task)).brief.confirmed,false);assert.equal(f.messages.length,0);
});
function plan(view){return{...view.brief.value,schema:'crystra.plan@1',briefDigest:view.brief.digest,steps:['核对需求'],bindings:['无需 Workflow 的管控里程碑'],revision:'v1',documentMarkdown:'# 计划\n核对已确认需求，禁止发布。',graph:{nodes:[{id:'ready',kind:'milestone',title:'需求核对',goal:'内容完整',entryConditions:[],exitConditions:['内容完整'],risks:[],evidence:[]}],edges:[]},readiness:Object.fromEntries(['control','proof','context'].map(k=>[k,{status:'已检查',items:[]}]))};}
test('native Plan confirmation and control request use durable owner receipts exactly once',async t=>{
 const f=await fixture(t);await f.assemble();const task=(await f.admission.bindings())[0];await f.write('brief.json',brief(task.taskId));await f.stop();
 await f.assemble();await f.write('plan.json',plan(await f.control.flow.read(task)));await f.stop();
 let view=await f.control.flow.read(task);assert.equal(view.stage,'ready');assert.equal(f.questions.length,2);
 await f.assemble();await f.write('control.json',{schema:'crystra.control-request@1',id:'assess-ready',operation:'assess-node',planDigest:view.plan.digest,nodeId:'ready',reason:'需求已经确认',sourceIdentities:[view.brief.digest,view.plan.digest],conclusion:'satisfied'});
 assert.equal((await f.control.requests.receipts(task)).length,0,'saving a proposal is not execution');
 await f.stop();assert.equal((await f.control.runs.read(task)).current.nodes.ready.state,'completed');
 await f.assemble();await f.stop();assert.equal((await f.control.requests.receipts(task)).length,1);
});
test('task data containing prompt-template braces is literal and rejected requests are fed back once',async t=>{
 const f=await fixture(t);await f.assemble();const task=(await f.admission.bindings())[0];await f.write('brief.json',{...brief(task.taskId),goal:'Show {{unknown_variable}} literally'});
 const {renderContextSections}=await import('@deepseek-ai/dsh-system-prompt');
 assert.match(renderContextSections(await f.assemble()).map(x=>x.text).join(''),/\{\{unknown_variable\}\}/);
 await f.stop();await f.assemble();await f.write('plan.json',plan(await f.control.flow.read(task)));await f.stop();await f.assemble();
 await f.write('control.json',{schema:'crystra.control-request@1',id:'bad',operation:'start-wave',planDigest:'stale',waveId:'missing'});
 const count=f.messages.length;await f.stop();assert.equal(f.messages.length,count+1);assert.match(f.messages.at(-1).content[0].text,/管控请求未生效/);
 await f.assemble();await f.stop();assert.equal(f.messages.length,count+1,'do not spin on the same rejected request');
});
test('a draft first step is constrained before user/message is persisted, then admits through the context tool',async t=>{
 const f=await fixture(t),events=[...f.agent.session.ownEvents()];
 const original=f.agent.session.ownEvents.bind(f.agent.session);
 f.agent.session.ownEvents=()=>[];
 const assembly=await f.assemble();assert.match(assembly.variables.crystra_task_context,/首条消息尚在/);
 assert.match(f.guards[0]({agent:f.agent,name:'bash',arguments:{}}),/CRYSTRA_TASK/);
 assert.equal((await f.admission.bindings()).length,0);
 f.agent.session.ownEvents=original;assert.ok(events.length);
 await f.write('brief.json',brief((await f.control.tasks.admit(f.agent.session.id)).taskId));
 await f.stop();assert.equal(f.questions.length,1);
});
