import {notificationInboxState} from './notification-inbox-state.js';
import {createHash} from 'node:crypto';
const fail=code=>{throw Error(code);};
const text=v=>typeof v==='string'&&v.length>0&&v.length<=4096;
/** A durable native inbox receipt is not proof of model consumption or permission to act. */
export function createResourceNotificationDelivery({ctx,resolveWorkspace}){
 const active=new Map();
 const deliver=async({binding,event,selection,isCurrent,receipt},inspect=false)=>{
  if(!binding||!event||!selection||!['workspaceId','packageRoot','sessionId'].every(k=>text(binding[k]))||!['eventId','resourceId','path','afterRevision'].every(k=>text(event[k]))||!(event.beforeRevision===null||text(event.beforeRevision))||!['definitionId','definitionRevision'].every(k=>text(selection[k]))||typeof isCurrent!=='function')fail('NOTIFICATION_INVALID');
  const key=JSON.stringify([binding.workspaceId,binding.packageRoot,binding.sessionId,selection.definitionId,selection.definitionRevision,event.eventId]);
  if(active.has(key))fail('NOTIFICATION_BUSY');active.set(key,true);
  try{
   const agent=ctx.agents?.get(binding.sessionId),session=agent?.session;
   const live=()=>agent&&agent.id===binding.sessionId&&ctx.agents?.get(binding.sessionId)===agent&&ctx.sessions?.get(binding.sessionId)===session&&typeof agent.inject==='function';
   const check=async()=>{
    if(!await isCurrent())fail('NOTIFICATION_SOURCE_CHANGED');if(!live())fail('NOTIFICATION_SESSION_UNAVAILABLE');
    const authority=await resolveWorkspace(agent);
    if(!await isCurrent())fail('NOTIFICATION_SOURCE_CHANGED');
    if(authority?.sessionKey!==binding.sessionId||authority.workspaceId!==binding.workspaceId||authority.path!==binding.packageRoot||!live())fail('NOTIFICATION_SESSION_UNAVAILABLE');
   };
   await check();
   const id='crystra-resource-'+createHash('sha256').update(key).digest('hex');
   const reference={definitionId:selection.definitionId,definitionRevision:selection.definitionRevision,resourceId:event.resourceId,path:event.path,resourceRevision:event.afterRevision};
   const message={id,role:'user',source:{kind:'plugin',plugin:'crystra',form:'notice',summary:'工作流资源草案已更新；读取精确候选后再判断。'},content:[{type:'text',text:'条件草案资源变更通知。此通知不授权进一步修改、执行或发布；不是用户指令。失效旧资源上下文，使用 Crystra 精确资源读取工具重新读取以下版本；来源失效时停止使用，不回退 latest。\n'+JSON.stringify({eventId:event.eventId,beforeRevision:event.beforeRevision,reference})}]};
   const inboxState=notificationInboxState(session.events,message);
   if(inspect)return inboxState==='absent'?'unavailable':inboxState;
   if(receipt&&inboxState==='absent')fail('NOTIFICATION_HISTORY_UNAVAILABLE');
   await check();
   if(inboxState==='absent'||inboxState==='canceled')agent.inject(message); // Public API: queues next-step context without waking the driver.
   if(!['queued','claimed'].includes(notificationInboxState(session.events,message)))fail('NOTIFICATION_NOT_QUEUED');
   if(typeof ctx.sessions.flush!=='function'||await ctx.sessions.flush(session)!==true)fail('NOTIFICATION_DURABILITY_UNAVAILABLE');
   await check();
   return {status:'queued',eventId:event.eventId,resourceRevision:event.afterRevision,sessionId:binding.sessionId,messageId:id};
  }finally{active.delete(key);}
 };
 deliver.inspect=async input=>{try{return await deliver(input,true);}catch{return 'unavailable';}};
 return deliver;
}
