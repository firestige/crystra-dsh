const candidate=revision=>typeof revision==='string'&&/^draft-sha256:[a-f0-9]{64}$/.test(revision);
export function validResourceNotification(file){
 const n=file.notification;
 if(n===undefined)return true; // Older ports provide no delivery evidence.
 if(n===null)return !candidate(file.revision);
 return n&&typeof n==='object'&&!Array.isArray(n)&&Object.keys(n).length===3&&typeof n.eventId==='string'&&n.eventId.length>0&&n.eventId.length<=4096&&n.status==='pending'&&candidate(file.revision)&&n.resourceRevision===file.revision;
}
export function resourceNotificationSummary(files){
 const drafts=files.filter(f=>candidate(f.revision));
 if(drafts.some(f=>!validResourceNotification(f)||f.notification===undefined))return '草案通知状态不可用；未确认 Agent 接收。';
 const count=drafts.filter(f=>f.notification?.status==='pending').length;
 return count?`${count} 个资源的当前草案已保存，通知待投递；尚未通知 Agent。`:null;
}
