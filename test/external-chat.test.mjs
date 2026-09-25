import test from 'node:test';
import assert from 'node:assert/strict';
import {createExternalChatAdapter} from '../src/host/external-chat.js';
class Base {async prepareCall(provider,model){return {model:{provider,id:model},stream:o=>this.stream(o)}}}
function fixture(){
 const calls=[],events=[];
 const session={id:'own-session',header:{cwd:'/workspace'},ownEvents:()=>[],append(type,data){events.push({type,data});return {seq:events.length}}};
 const ctx={workspaceRegistry:{list:()=>[{path:'/workspace',sessionIds:['own-session']}]},sessions:{get:id=>id===session.id?session:undefined},agents:{roots:()=>[]}};
 const providers=[{id:'crystra-codex',name:'Codex',models:async()=>[{id:'model-a',name:'Model A'}],async *run(input){calls.push(input);yield {type:'text',text:'Native reply'};}}];
 return {calls,events,ctx,session,providers,adapter:createExternalChatAdapter({Base,ctx,providers})};
}
test('external Chat lists native models without Role or Delivery bindings',async()=>{
 const {adapter}=fixture();assert.deepEqual(await adapter.listModels('crystra-codex'),[{id:'model-a',name:'Model A',provider:'crystra-codex'}]);
});
test('selected Provider owns the turn and gets only this conversation and workspace',async()=>{
 const {adapter,calls}=fixture();const messages=[{role:'user',content:[{type:'text',text:'hello'}]}];
 const chunks=[];for await(const c of adapter.stream({provider:'crystra-codex',model:'model-a',sessionId:'own-session',messages,tools:[{name:'host-shell'}],system:'host instructions'}))chunks.push(c);
 assert.equal(calls.length,1);assert.equal(calls[0].model,'model-a');assert.equal(calls[0].cwd,'/workspace');assert.deepEqual(calls[0].messages,messages);
 assert.equal(calls[0].tools,undefined);assert.equal(calls[0].role,undefined);assert.equal(calls[0].system,undefined);
 assert.equal(chunks.find(c=>c.type==='text-delta').text,'Native reply');
});
test('unknown sessions and provider selections never fall back to the host model',async()=>{
 const {adapter,calls}=fixture();
 for(const options of [{provider:'host',sessionId:'own-session'},{provider:'crystra-codex',sessionId:'foreign'}])await assert.rejects(async()=>{for await(const c of adapter.stream({...options,model:'model-a',messages:[]})){}},/EXTERNAL_CHAT/);
 assert.equal(calls.length,0);
});
test('provider switch sends the same isolated history to the newly selected agent',async()=>{
 const {ctx,providers,calls}=fixture();providers.push({id:'crystra-copilot',name:'Copilot',models:async()=>[],async *run(x){calls.push({...x,chosen:'copilot'});yield {type:'text',text:'continued'};}});
 const adapter=createExternalChatAdapter({Base,ctx,providers});const messages=[{role:'user',content:[{type:'text',text:'earlier'}]},{role:'assistant',content:[{type:'text',text:'reply'}]},{role:'user',content:[{type:'text',text:'continue'}]}];
 for await(const c of adapter.stream({provider:'crystra-copilot',model:'b',sessionId:'own-session',messages})){}
 assert.equal(calls[0].chosen,'copilot');assert.deepEqual(calls[0].messages,messages);
});
test('provider failures propagate instead of inventing a successful response',async()=>{
 const {ctx}=fixture();const adapter=createExternalChatAdapter({Base,ctx,providers:[{id:'broken',name:'Broken',async *run(){throw Error('native failure')}}]});
 await assert.rejects(async()=>{for await(const c of adapter.stream({provider:'broken',model:'x',sessionId:'own-session',messages:[]})){}},/native failure/);
});

test('native tool results use durable DSH user/tool-result envelopes and exact call references',async()=>{
 const {ctx,events}=fixture();
 const adapter=createExternalChatAdapter({Base,ctx,providers:[{id:'native',async *run(){yield {type:'tool-start',id:'one',name:'read',arguments:{path:'README.md'}};yield {type:'tool-end',id:'one',text:'contents'};yield {type:'text',text:'done'};}}]});
 for await(const c of adapter.stream({provider:'native',model:'m',sessionId:'own-session',messages:[]})){}
 events.splice(0,events.length,...events.filter(e=>e.type.startsWith('tool/')));
 assert.equal(events[0].data.arguments,JSON.stringify({path:'README.md'}));assert.equal(events[0].type,'tool/call');assert.equal(events[1].type,'tool/result');
 assert.equal(events[1].data.message.role,'user');assert.deepEqual(events[1].data.message.source,{kind:'tool',callId:events[0].data.callId});
 assert.equal(events[1].data.message.content[0].toolCallId,events[0].data.callId);
});
test('a cancelled external turn cannot start the Provider',async()=>{
 const {adapter,calls}=fixture();const controller=new AbortController();controller.abort();
 await assert.rejects(async()=>{for await(const c of adapter.stream({provider:'crystra-codex',model:'model-a',sessionId:'own-session',messages:[],signal:controller.signal})){}},/abort/i);
 assert.equal(calls.length,0);
});

test('control Chat receives refreshed resolved Execution model IDs on every turn',async()=>{
 const {ctx,providers,calls}=fixture();let revision=0;
 ctx.crystraTaskControl={tasks:{admit:async()=>({id:'task',workspacePath:'/workspace'})},flow:{prepare:async()=>({stage:'requirements'}),read:async()=>({stage:'requirements'})},execution:()=>({control:{planningCapabilities:async()=>({providers:[{identity:'provider.codex',version:'0.144.5',modelCatalog:{state:'available',models:[{provider:'openai',model:`exact-${++revision}`}]}}]})}})};
 const adapter=createExternalChatAdapter({Base,ctx,providers});
 for(let i=0;i<2;i++)for await(const chunk of adapter.stream({provider:'crystra-codex',model:'chat-model',sessionId:'own-session',messages:[]})){}
 assert.equal(calls[0].taskContext.planningCapabilities.providers[0].modelCatalog.models[0].model,'exact-1');
 assert.equal(calls[1].taskContext.planningCapabilities.providers[0].modelCatalog.models[0].model,'exact-2');
 assert.equal(calls[1].model,'chat-model');
});
test('native reasoning and visible text use distinct ordered DSH block types',async()=>{
 const {ctx}=fixture();const adapter=createExternalChatAdapter({Base,ctx,providers:[{id:'p',async *run(){yield {type:'reasoning',text:'Evaluate options'};yield {type:'text',text:'I will inspect.'};yield {type:'reasoning',text:'Check result'};yield {type:'text',text:'Done'};}}]});
 const chunks=[];for await(const c of adapter.stream({sessionId:'own-session',provider:'p',model:'m',messages:[]}))chunks.push(c);
 assert.deepEqual(chunks.filter(c=>c.type==='block-end').map(c=>c.block),[{type:'reasoning',text:'Evaluate options'},{type:'text',text:'I will inspect.'},{type:'reasoning',text:'Check result'},{type:'text',text:'Done'}]);
});

test('grilling only exposes one valid choice question while native answer is pending',async()=>{
 const {ctx}=fixture();let resolveAnswer,shown=[];
 ctx.crystraTaskControl={tasks:{admit:async()=>({taskId:'t'})},flow:{prepare:async()=>({stage:'requirements'}),read:async()=>({stage:'requirements'})}};
 ctx.userQuestions={ask:request=>{shown.push(request);return new Promise(resolve=>{resolveAnswer=()=>resolve({answers:[{id:request.questions[0].id,selected:['团队（建议）']}]});});}};
 const adapter=createExternalChatAdapter({Base,ctx,providers:[{id:'p',async *run({ask}){
  await assert.rejects(ask({question:'请给出所有需求'}),/GRILLING_OPTIONS/);
  assert.equal(shown.length,0);
  const pending=ask({question:'首版面向谁？',choices:['团队（建议）','客户']});
  await assert.rejects(ask({question:'何时交付？',choices:['本周（建议）','下周']}),/GRILLING_ONE_QUESTION/);
  assert.equal(shown.length,1);assert.equal(shown[0].questions.length,1);
  resolveAnswer();assert.equal(await pending,'团队（建议）');
  yield {type:'text',text:'已记录'};
 }}]});
 for await(const c of adapter.stream({provider:'p',model:'m',sessionId:'own-session',messages:[]})){}
});
