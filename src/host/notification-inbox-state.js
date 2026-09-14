import {isDeepStrictEqual} from 'node:util';
const fail=code=>{throw Error(code);};
/** Replay the public inbox splice log; an old insertion may later have been canceled. */
export function notificationInboxState(events,message){
 if(!Array.isArray(events)||events.length>20000)fail('NOTIFICATION_HISTORY_UNAVAILABLE');
 const queues={'next-step':[],'next-turn':[]};let status='absent';
 for(const e of events){
  if(e.type!=='agent/inbox/spliced')continue;const s=e.data,q=queues[s?.target],removed=s?.removedCount??0;
  if(!q||!Number.isSafeInteger(s.start)||s.start<0||s.start>q.length||!Number.isSafeInteger(removed)||removed<0||removed>q.length-s.start||!Array.isArray(s.inserted)||s.inserted.length>10000)fail('NOTIFICATION_HISTORY_UNAVAILABLE');
  const previous=q.splice(s.start,removed,...s.inserted);
  if(previous.some(m=>m.id===message.id))status=s.outcome==='canceled'?'canceled':'claimed';
  for(const m of s.inserted)if(m.id===message.id){if(!isDeepStrictEqual(m,message))fail('NOTIFICATION_IDENTITY_CONFLICT');status='queued';}
  const ids=[...queues['next-step'],...queues['next-turn']].map(m=>m.id);if(new Set(ids).size!==ids.length)fail('NOTIFICATION_HISTORY_UNAVAILABLE');
 }
 return status;
}
