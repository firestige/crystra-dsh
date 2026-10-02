import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGrillingQuestion, validateGrillingBatch } from '../src/host/grilling-policy.js';
import { taskInstructions } from '../src/host/task-flow.js';
import {readFileSync} from 'node:fs';

test('requirements explicitly load the shipped grilling Skill, independent of provider discovery', () => {
  const skill=readFileSync(new URL('../skills/grilling/SKILL.md',import.meta.url),'utf8');
  assert.ok(skill.includes('Ask the questions one at a time, waiting for feedback on each question before continuing.'));
  assert.ok(taskInstructions({stage:'requirements'}).includes(skill));
  assert.ok(!taskInstructions({stage:'planning'}).includes('<skill name="grilling">'));
});

test('grilling rejects batches before showing any question', () => {
  assert.throws(() => validateGrillingBatch([{}, {}]), /GRILLING_ONE_QUESTION/);
  assert.throws(() => validateGrillingBatch([]), /GRILLING_ONE_QUESTION/);
});
test('grilling requires two or three distinct options and exactly one recommendation', () => {
  const valid = {question:'首版面向谁？', choices:['内部团队（建议）','外部客户']};
  assert.doesNotThrow(() => validateGrillingQuestion(valid));
  for (const choices of [undefined, [], ['A'], ['A','B'], ['A（建议）','B（建议）'], ['A（建议）','A（建议）'], ['A（建议）','B','C','D']])
    assert.throws(() => validateGrillingQuestion({...valid, choices}), /GRILLING_OPTIONS/);
  assert.doesNotThrow(() => validateGrillingQuestion({question:'Audience?',choices:['Team (Recommended)','Customers','Both']}));
});
test('task instructions replace open question lists with research-first single decisions', () => {
  const instructions = taskInstructions({stage:'requirements',workspace:'/project',artifactRoot:'/project/.crystra/tasks/t'});
  assert.match(instructions, /每次只问一个/);
  assert.match(instructions, /2–3/);
  assert.match(instructions, /（建议）/);
  assert.match(instructions, /先查本地/);
  assert.match(instructions, /联机/);
  assert.doesNotMatch(instructions, /普通问题直接在 Chat 提出/);
});

test('Codex rejects a batch before asking the user and enables hosted documentation search', async () => {
  const {createCodexChatProvider} = await import('../src/host/external-chat-codex.js');
  let listener, handler, asked=0;
  const rpc={init:async()=>{},close:async()=>{},on(fn){listener=fn;return()=>{};},requests(fn){handler=fn;},async call(method,params){
    if(method==='thread/start'){assert.equal(params.config.web_search,'live');return {thread:{id:'t'}};}
    if(method==='turn/start'){
      assert.equal(params.sandboxPolicy.networkAccess,false);
      const q={id:'q',question:'面向谁？',options:[{label:'团队（建议）'},{label:'客户'}]};
      await assert.rejects(handler({method:'item/tool/requestUserInput',params:{threadId:'t',questions:[q,{...q,id:'q2'}]}}),/GRILLING_ONE_QUESTION/);
      assert.equal(asked,0);
      assert.deepEqual(await handler({method:'item/tool/requestUserInput',params:{threadId:'t',questions:[q]}}),{answers:{q:{answers:['团队（建议）']}}});
      listener({method:'turn/completed',params:{threadId:'t',turn:{status:'completed'}}});return {turn:{id:'turn'}};
    }
  }};
  const p=createCodexChatProvider({rpcFactory:()=>rpc});
  for await(const event of p.run({model:'test',cwd:'/tmp',messages:[],taskContext:{stage:'requirements',artifactRoot:'/tmp/t'},ask:async()=>{asked++;return '团队（建议）';}})){}
  assert.equal(asked,1);
});

test('Copilot exposes read-only research tools and rejects open grilling requests', async () => {
  const {createCopilotChatProvider}=await import('../src/host/external-chat-copilot.js');
  let asked=0;
  const client={start:async()=>{},stop:async()=>[],deleteSession:async()=>{},async createSession(options){
    for(const tool of ['web_search','web_fetch']){
      assert.ok(options.availableTools.includes(tool));
      assert.deepEqual(await options.hooks.onPreToolUse({toolName:tool}),{});
    }
    assert.equal((await options.onPermissionRequest({kind:'url'})).kind,'approve-once');
    assert.equal((await options.onPermissionRequest({kind:'url',managedApprovalRequired:true})).kind,'reject');
    await assert.rejects(options.onUserInputRequest({question:'请列出所有需求'}),/GRILLING_OPTIONS/);
    assert.equal(asked,0);
    await options.onUserInputRequest({question:'面向谁？',choices:['团队（建议）','客户']});
    return {sendAndWait:async()=>{},disconnect:async()=>{}};
  }};
  const p=createCopilotChatProvider({createClient:async()=>client});
  for await(const event of p.run({model:'test',cwd:'/tmp',messages:[],taskContext:{stage:'requirements',artifactRoot:'/tmp/t'},ask:async()=>{asked++;return '团队（建议）';}})){}
  assert.equal(asked,1);
});
