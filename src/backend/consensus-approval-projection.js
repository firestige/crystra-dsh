import {z} from 'zod';
import {decodeApprovalReason,normalizeLegacyPresentation,isVersionedApprovalReason} from './consensus-approval-codec.js';
import {sectionKinds} from './consensus-approval-presentation.js';
const cell=z.object({number:z.number().int().positive(),text:z.string(),segments:z.array(z.object({text:z.string(),changed:z.boolean()}))}).nullable();
const rows=z.array(z.object({kind:z.enum(['context','add','delete','modify']),old:cell,new:cell}));
const presentation=z.object({heading:z.string(),sections:z.array(z.object({kind:z.enum(sectionKinds),label:z.string(),text:z.string()})),diffs:z.array(z.object({rows:rows.optional(),review:z.array(z.object({kind:z.enum(['context','add','delete']),text:z.string()})).optional(),parts:z.array(z.union([z.object({kind:z.literal('context'),text:z.string()}),z.object({kind:z.enum(['add','delete','modify']),oldText:z.string(),newText:z.string(),fallback:z.boolean().optional()})]))})).optional()});
const view=z.object({callId:z.string(),requestId:z.string().nullable(),presentation}).nullable();
/** One pending display, transported and recovered by DSH's native session projection. No authority to approve. */
export const approvalDetailProjection={
 key:'crystraConsensusApprovalDetail',stateVersion:3,stateSchema:view,init:()=>null,
 apply(state,event){
  if(event.type==='crystra/consensus-approval-detail'){if(event.data?.schemaVersion!==undefined)return null;const parsed=view.safeParse({...event.data,presentation:normalizeLegacyPresentation(event.data?.presentation),requestId:null});return parsed.success?parsed.data:null;}
  if(event.type==='approval/asked'&&event.data.toolName==='crystra_consensus_approve'){const presentation=decodeApprovalReason(event.data.reason);if(presentation){const parsed=view.safeParse({callId:event.data.callId,requestId:event.data.id,presentation});return parsed.success?parsed.data:state;}}
  if(event.type==='approval/asked'&&event.data.toolName==='crystra_consensus_approve'){if(!isVersionedApprovalReason(event.data.reason)&&state?.requestId===null&&event.data.callId===state.callId)return {...state,requestId:event.data.id};return null;}
  if(event.type==='approval/decided'&&state?.requestId===event.data.id)return null;
  return state;
 },wire:{viewSchema:view,view:state=>state},
};
