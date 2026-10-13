import {z} from 'zod';
import {presentationFromApprovalReason} from './consensus-approval-display.js';
const cell=z.object({number:z.number().int().positive(),text:z.string(),segments:z.array(z.object({text:z.string(),changed:z.boolean()}))}).nullable();
const rows=z.array(z.object({kind:z.enum(['context','add','delete','modify']),old:cell,new:cell}));
const presentation=z.object({heading:z.string(),sections:z.array(z.object({label:z.string(),text:z.string()})),diffs:z.array(z.object({rows:rows.optional(),review:z.array(z.object({kind:z.enum(['context','add','delete']),text:z.string()})).optional(),parts:z.array(z.union([z.object({kind:z.literal('context'),text:z.string()}),z.object({kind:z.enum(['add','delete','modify']),oldText:z.string(),newText:z.string(),fallback:z.boolean().optional()})]))})).optional()});
const view=z.object({callId:z.string(),requestId:z.string().nullable(),presentation}).nullable();
/** One pending display, transported and recovered by DSH's native session projection. No authority to approve. */
export const approvalDetailProjection={
 key:'crystraConsensusApprovalDetail',stateVersion:2,stateSchema:view,init:()=>null,
 apply(state,event){
  if(event.type==='crystra/consensus-approval-detail'){const parsed=view.safeParse({...event.data,requestId:null});return parsed.success?parsed.data:state;}
  if(event.type==='approval/asked'&&event.data.toolName==='crystra_consensus_approve'){const presentation=presentationFromApprovalReason(event.data.reason);if(presentation){const parsed=view.safeParse({callId:event.data.callId,requestId:event.data.id,presentation});return parsed.success?parsed.data:state;}}
  if(event.type==='approval/asked'&&state&&event.data.toolName==='crystra_consensus_approve'&&event.data.callId===state.callId)return {...state,requestId:event.data.id};
  if(event.type==='approval/decided'&&state?.requestId===event.data.id)return null;
  return state;
 },wire:{viewSchema:view,view:state=>state},
};
