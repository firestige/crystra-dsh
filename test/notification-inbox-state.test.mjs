import test from 'node:test';import assert from 'node:assert/strict';
import {notificationInboxState} from '../src/host/notification-inbox-state.js';
const m={id:'m',role:'user',source:{kind:'plugin',plugin:'crystra'},content:[{type:'text',text:'notice'}]};
const inserted={type:'agent/inbox/spliced',data:{target:'next-step',start:0,inserted:[m]}};
const removed=outcome=>({type:'agent/inbox/spliced',data:{target:'next-step',start:0,removedCount:1,inserted:[],...(outcome?{outcome}:{})}});
test('cancellation and step claims are distinct from a still queued notification',()=>{
 assert.equal(notificationInboxState([inserted],m),'queued');assert.equal(notificationInboxState([inserted,removed('canceled')],m),'canceled');assert.equal(notificationInboxState([inserted,removed()],m),'claimed');
 assert.equal(notificationInboxState([inserted,removed('canceled'),inserted],m),'queued');
});
test('conflicting identities and malformed replay cannot be treated as successful delivery',()=>{
 assert.throws(()=>notificationInboxState([{...inserted,data:{...inserted.data,inserted:[{...m,content:[]}]}}],m),/IDENTITY_CONFLICT/);
 assert.throws(()=>notificationInboxState([inserted,inserted],m),/HISTORY_UNAVAILABLE/);
 assert.throws(()=>notificationInboxState([removed('canceled')],m),/HISTORY_UNAVAILABLE/);
});
