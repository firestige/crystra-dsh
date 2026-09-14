const candidate=revision=>typeof revision==='string'&&/^draft-sha256:[a-f0-9]{64}$/.test(revision);
export function validResourceNotification(file){
 const n=file.notification;
 if(n===undefined)return true; // Older ports provide no delivery evidence.
 if(n===null)return !candidate(file.revision);
 return n&&typeof n==='object'&&!Array.isArray(n)&&typeof n.eventId==='string'&&n.eventId.length>0&&n.eventId.length<=4096&&((n.status==='pending'&&Object.keys(n).length===3)||(n.status==='queued'&&((n.deliveryState===undefined&&Object.keys(n).length===5)||(['queued','claimed','canceled','unavailable'].includes(n.deliveryState)&&Object.keys(n).length===6))&&['sessionId','messageId'].every(k=>typeof n[k]==='string'&&n[k].length>0&&n[k].length<=4096)))&&candidate(file.revision)&&n.resourceRevision===file.revision;
}
export function resourceNotificationSummary(files){
 const drafts=files.filter(f=>candidate(f.revision));
 if(drafts.some(f=>!validResourceNotification(f)||f.notification===undefined||(f.notification?.status==='queued'&&[undefined,'unavailable'].includes(f.notification.deliveryState))))return '草案通知状态不可用；未确认 Agent 接收。';
 const count=drafts.filter(f=>f.notification?.status==='pending').length;
 const queued=drafts.filter(f=>f.notification?.status==='queued'&&['queued','claimed'].includes(f.notification.deliveryState)).length;
 const canceled=drafts.filter(f=>f.notification?.deliveryState==='canceled').length;
 return [canceled?`${canceled} 个资源的通知已被会话取消；可重试，未确认模型读取。`:null,count?`${count} 个资源的当前草案已保存，通知待投递；尚未通知 Agent。`:null,queued?`${queued} 个资源的当前草案通知已写入会话；未确认模型读取。`:null].filter(Boolean).join(' ')||null;
}
