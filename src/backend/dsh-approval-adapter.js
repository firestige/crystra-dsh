import {encodeApprovalReason} from './consensus-approval-codec.js';
export {approvalDetailProjection} from './consensus-approval-projection.js';

/** DSH transport only. The domain submits a presentation and receives a durable decision. */
export function createDshApprovalAdapter(ctx){
 return async ({agent,callId,presentation,signal})=>{
  try{
   const service=typeof ctx.get==='function'?ctx.get('approval'):ctx.approval;
   if(!service||!ctx.sessions?.flush||!agent?.session?.snapshotEvents||!callId)return {outcome:'unavailable'};
   const session=agent.session, previous=session.snapshotEvents().at(-1)?.seq??0;
   const outcome=await service.request({agent,toolName:'crystra_consensus_approve',callId,reason:encodeApprovalReason(presentation),signal});
   await ctx.sessions.flush(session);
   if(!['allowed-once','rejected','cancelled','unavailable'].includes(outcome))return {outcome:'unavailable'};
   const events=session.snapshotEvents();
   const asked=events.findLast(e=>e.seq>previous&&e.type==='approval/asked'&&e.data?.callId===callId&&e.data.toolName==='crystra_consensus_approve');
   const decided=asked&&events.findLast(e=>e.seq>asked.seq&&e.type==='approval/decided'&&e.data?.id===asked.data.id);
   if(!decided||decided.data.outcome!==outcome)return {outcome:'unavailable'};
   return {outcome,approvalEvidence:{sessionId:session.id,requestId:asked.data.id,askedSeq:asked.seq,decidedSeq:decided.seq,outcome}};
  }catch{return {outcome:'unavailable'};}
 };
}
