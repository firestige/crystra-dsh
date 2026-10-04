import test from 'node:test';
import assert from 'node:assert/strict';
import {taskListMetadata,withTaskListMetadata} from '../src/host/task-list-metadata.js';
test('Task list shows authoritative discussion stages and failure without inventing Task completion',()=>{
 const view={stage:'requirements',brief:{state:'missing'},run:{current:null}};
 assert.equal(taskListMetadata({view}).status,'需求澄清');
 assert.equal(taskListMetadata({view:{...view,brief:{state:'available',confirmed:false,value:{requestConfirmation:true,questions:[]}}}}).status,'待需求确认');
 const events=[{type:'turn/end',data:{reason:{kind:'error'}}}];
 assert.deepEqual(taskListMetadata({view,events}),{status:'对话失败',attention:1});
 assert.equal(taskListMetadata({view,events:[...events,{type:'turn/start'}]}).status,'需求澄清');
 assert.equal(taskListMetadata({view:{stage:'planning',plan:{state:'missing'}}}).status,'计划编写');
 assert.equal(taskListMetadata({view:{stage:'ready',run:{current:{nodes:{wave:{state:'completed'}}}}}}).status,'执行阶段');
 assert.equal(taskListMetadata({view}).active,undefined);
});
test('metadata changes invalidate Task list while presentation commands remain owned by Execution',async()=>{
 let status='需求澄清',received;
 const base={revision:'owner',items:[{id:'one',title:'任务'},{id:'unbound',title:'导入任务'}]};
 const query=withTaskListMetadata({snapshot:async()=>base,updatePresentation:async v=>{received=v;}},()=>({listMetadata:async()=>({one:{status,attention:0,workspacePath:'/workspace',workspace:'workspace'}})}));
 const first=await query.snapshot();assert.equal(first.items[0].status,'需求澄清');assert.equal(first.items[1].status,undefined);assert.equal(base.items[0].status,undefined);
 status='对话失败';assert.notEqual((await query.snapshot()).revision,first.revision);
 await query.updatePresentation({taskId:'one',archived:true});assert.deepEqual(received,{taskId:'one',archived:true});
});
test('the browser API retains host status, attention and workspace without inventing lifecycle activity',async()=>{
 const {build}=await import('esbuild');
 const built=await build({entryPoints:['src/client/tasks/execution-tasks-api.ts'],bundle:true,write:false,platform:'node',format:'esm'});
 const {createExecutionTasksApi}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const api=createExecutionTasksApi({call:async()=>({ok:true,value:{schemaVersion:'execution.tasks@1.0.0',revision:'r',items:[{id:'t',title:'任务',lastActivityAt:1,deliveryIds:[],status:'对话失败',attention:1,workspace:'workspace',workspacePath:'/workspace'}]}})});
 const [task]=await api.read(new AbortController().signal);
 assert.equal(task.status,'对话失败');assert.equal(task.attention,1);assert.equal(task.workspacePath,'/workspace');assert.equal(task.active,undefined);
});
