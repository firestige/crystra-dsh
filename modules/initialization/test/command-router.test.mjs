import assert from 'node:assert/strict';
import test from 'node:test';
import {createCommandRouter} from '../src/command-router.js';
test('one router handles closed administrative commands without invoking Execution',async()=>{
 const calls=[];
 const router=createCommandRouter({operate:async(action)=>{calls.push(action);return {status:'READY'};}});
 const unbind=router.bindExecution({handler:async()=>{throw new Error('not administrative');}});
 for(const rawInput of ['setup','doctor','services start','services stop','services status'])assert.equal((await router.handler({rawInput,attachments:[]})).kind,'success');
 assert.deepEqual(calls,['setup','doctor','start','stop','status']);unbind();
});
test('workflow requests preserve their invocation and delegate only when ready',async()=>{
 const router=createCommandRouter({operate:async()=>{throw new Error('not workflow');}});
 const invocation={rawInput:'create test@1\nTask',attachments:[],signal:new AbortController().signal};
 assert.equal((await router.handler(invocation)).kind,'error');
 const unbind=router.bindExecution({handler:async(value)=>{assert.equal(value,invocation);return {kind:'success',text:'workflow'};}});
 assert.equal((await router.handler(invocation)).text,'workflow');unbind();
 assert.equal((await router.handler(invocation)).kind,'error');
});
test('malformed administrative operations and attachments never fall through to an LLM or Execution',async()=>{
 const router=createCommandRouter({operate:async()=>{throw new Error('unexpected');}});
 router.bindExecution({handler:async()=>{throw new Error('unexpected');}});
 for(const rawInput of ['setup now','services delete','doctor\nanything'])assert.equal((await router.handler({rawInput,attachments:[]})).kind,'error');
 assert.equal((await router.handler({rawInput:'setup',attachments:[{}]})).kind,'error');
});
