import test from 'node:test';import assert from 'node:assert/strict';
import {validResourceNotification,resourceNotificationSummary} from '../src/client/resource-notifications.js';
const file={revision:'draft-sha256:'+'a'.repeat(64),notification:{eventId:'event1',status:'pending',resourceRevision:'draft-sha256:'+'a'.repeat(64)}};
test('notification receipts cannot claim delivery or refer to another resource revision',()=>{
 assert.equal(validResourceNotification(file),true);
 for(const notification of [{...file.notification,status:'delivered'},{...file.notification,resourceRevision:'other'},{...file.notification,eventId:''}])assert.equal(validResourceNotification({...file,notification}),false);
 assert.equal(validResourceNotification({...file,notification:null}),false);
 assert.equal(validResourceNotification({revision:'source',notification:null}),true);
});
test('the current revision summary never claims Agent delivery and preserves unknown status',()=>{
 assert.equal(resourceNotificationSummary([file]),'1 个资源的当前草案已保存，通知待投递；尚未通知 Agent。');
 assert.equal(resourceNotificationSummary([{revision:'source',notification:null}]),null);
 assert.equal(resourceNotificationSummary([{revision:file.revision}]),'草案通知状态不可用；未确认 Agent 接收。');
});
