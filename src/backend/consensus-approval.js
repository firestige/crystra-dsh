import {randomUUID} from 'node:crypto';
import {baseline} from './managed-consensus.js';
import {digest,plain,same,publicationReference} from './value.js';
import {loadConsensus} from './consensus.js';
import {consensusApprovalText,consensusApprovalPresentation} from './consensus-approval-display.js';
const publicContent=c=>({id:c.id,version:c.version,status:c.status,...c.newStatus?{newStatus:c.newStatus}:{},data:c.data});
const uuid=v=>{if(typeof v!=='string'||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v))throw Error('Operation/content UUID required');};
/** Glue around DSH approval, existing managed CMS operations and durable binding changes. */
export class ConsensusApproval{
 #options;#state;#committed;#tail=Promise.resolve();#poisoned=false;
 constructor(options,state){this.#options=options;this.#state=state;this.#committed=structuredClone(state);}
 static async open(options){let state=await options.journal.read();if(state){if(state.schemaVersion!==1||!same(state.seed,options.manifest))throw Error('Approval project seed changed');}else{state={schemaVersion:1,workerSessionId:`approval:${options.namespace}`,seed:structuredClone(options.manifest),manifest:structuredClone(options.manifest),revision:0,history:[],operations:{}};await options.journal.append(state);}return new ConsensusApproval(options,state);}
 receipt(op){const {detail,grantId,command,result,...rest}=op;return {...structuredClone(rest),...(result?{result:{operationId:result.operationId??op.mutationId,state:result.state,...result.status!==undefined?{status:result.status}:{},...result.reference?{reference:structuredClone(result.reference)}:{}}}:{})};}
 manifest(){if(this.#poisoned)throw Error('Approval journal unavailable');return structuredClone(this.#committed.manifest);}
 snapshot(){if(this.#poisoned)throw Error('Approval journal unavailable');return structuredClone(this.#committed);}
 accepts(manifest){if(this.#poisoned)throw Error('Approval journal unavailable');const state=this.#committed;return same(manifest,state.seed)||same(manifest,state.manifest)||state.history.some(h=>same(h.manifest,manifest))||Object.values(state.operations).some(o=>o.state==='switching'&&same(o.target,manifest));}
 async #save(){try{const next=structuredClone(this.#state);await this.#options.journal.append(next);this.#committed=next;}catch(e){this.#poisoned=true;throw e;}}
 request(input,execution){const next=this.#tail.then(()=>{if(this.#poisoned)throw Error('Approval journal unavailable');return this.#request(input,execution);});this.#tail=next.catch(()=>{});return next;}
 #boundary(controller,op){const s=controller.snapshot();if(s.active||s.pending.length)throw Error('Cannot change binding with active or pending responsibility');if(op&&s.manifestRevision!==op.sessionRevision)throw Error('Session binding revision changed');return s;}
 async #displayCurrent(){try{return {...await loadConsensus(this.manifest(),this.#options.resolve),effective:true};}catch(error){const documents=[];for(const reference of this.manifest().references){try{const snapshot=await this.#options.client.historical(reference);documents.push({reference,data:snapshot.data});}catch{documents.push({reference,unavailable:true});}}return {manifest:this.manifest(),effective:false,error:String(error.message),documents};}}
 async #candidate(input){const c=await this.#options.client.inspect(input.id);if(c.version!==baseline(input.base)||digest(c.data)!==input.dataHash||(c.newStatus||c.status)!=='Ready')throw Error('Candidate changed or not Ready');if(c.data.scope?.iv!==this.#state.manifest.scope)throw Error('Candidate scope mismatch');return c;}
 async #request(input,{controller,agent,callId,signal}){
  if(!plain(input)||!['publish','switch','withdraw','restore'].includes(input.type))throw Error('Unsupported approval operation');uuid(input.operationId);
  const allowed={publish:['id','base','dataHash','activate'],switch:['references'],withdraw:['id','base'],restore:['id','from']}[input.type];
  if(Object.keys(input).some(k=>!['operationId','type','reason','expectedRevision',...allowed].includes(k))||typeof input.reason!=='string'||!input.reason.trim())throw Error('Invalid approval request');
  if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw Error('Project binding revision required');
  if(input.type==='publish'){uuid(input.id);baseline(input.base);if(typeof input.activate!=='boolean'||!/^[a-f0-9]{64}$/.test(input.dataHash??''))throw Error('Exact candidate hash and activation decision required');}
  if(input.type==='withdraw'){uuid(input.id);baseline(input.base);}
  if(input.type==='restore'){uuid(input.id);publicationReference(input.from);}
  if(input.type==='switch'){if(!Array.isArray(input.references)||!input.references.length)throw Error('Nonempty exact references required');input.references.forEach(publicationReference);}
  const hash=digest(input);let op=this.#state.operations[input.operationId];
  if(op){if(op.hash!==hash)throw Error('Operation ID intent conflict');if(['completed','rejected','interrupted'].includes(op.state))return this.receipt(op);if(op.state==='awaiting'){op.state='interrupted';await this.#save();return this.receipt(op);}}
  const activate=input.type==='switch'||input.type==='publish'&&input.activate;
  if(!op){
   if(input.expectedRevision!==this.#state.revision)throw Error('Stale project binding revision');
   const session=activate?this.#boundary(controller):controller.snapshot();
   if(input.type==='withdraw'&&(this.manifest().references.some(r=>r.id===input.id)||session.manifest?.references.some(r=>r.id===input.id)))throw Error('Unload this consensus from project and current session before withdrawal');
   let detail;
   if(input.type==='publish')detail=publicContent(await this.#candidate(input));
   else if(input.type==='switch'){const target={...this.manifest(),references:input.references};detail=await loadConsensus(target,this.#options.resolve);}
   else if(input.type==='withdraw'){detail=publicContent(await this.#options.client.inspect(input.id));if(detail.version!==baseline(input.base))throw Error('Withdrawal baseline changed');}
   else detail=publicContent(await this.#options.client.historical(input.from));
   op={hash,intent:structuredClone(input),state:'awaiting',sessionId:agent.session?.id??null,...callId?{callId}:{},sessionRevision:session.manifestRevision,sessionManifest:session.manifest,expiresAt:(this.#options.now?.()??Date.now())+600000,mutationId:randomUUID(),detail:structuredClone(detail)};
   this.#state.operations[input.operationId]=op;await this.#save();
   const timeout=AbortSignal.timeout(600000),lifetime=signal?AbortSignal.any([signal,timeout]):timeout;
   const current=await this.#displayCurrent();
   const reason=consensusApprovalText(input,current,detail);
   const presentation=consensusApprovalPresentation(input,current,detail);
   let outcome;try{outcome=await this.#options.approval({agent,toolName:'crystra_consensus_approve',callId,reason,presentation,signal:lifetime});}catch{outcome='unavailable';}
   if(!['allowed-once','rejected','cancelled','unavailable'].includes(outcome))outcome='unavailable';
   const events=agent.session?.snapshotEvents?.()??[];const asked=events.findLast(e=>e.type==='approval/asked'&&e.data.callId===callId&&e.data.toolName==='crystra_consensus_approve');const decided=asked&&events.findLast(e=>e.type==='approval/decided'&&e.data.id===asked.data.id);if(decided)op.approvalEvidence={sessionId:agent.session.id,requestId:asked.data.id,askedSeq:asked.seq,decidedSeq:decided.seq,outcome:decided.data.outcome};
   op.outcome=outcome;if(outcome!=='allowed-once'||lifetime.aborted){op.state='rejected';await this.#save();return this.receipt(op);}
   op.state='approved';await this.#save();
  }
  if(op.sessionId!==(agent.session?.id??null))throw Error('Approval belongs to another session');
  if(op.state==='approved'){
   if((this.#options.now?.()??Date.now())>=op.expiresAt||signal?.aborted)throw Error('Approval expired or cancelled');
   if(input.expectedRevision!==this.#state.revision)throw Error('Project binding changed during approval');
   if(activate)this.#boundary(controller,op);
   if(input.type==='publish'){await this.#candidate(input);op.grantId=await this.#options.manager.authorize(this.#options.publisher,{id:input.id,base:input.base,dataHash:input.dataHash,reason:input.reason});}
   if(input.type==='switch'){op.target={...this.manifest(),references:input.references};await loadConsensus(op.target,this.#options.resolve);op.state='published';}
   else op.state='authorized';await this.#save();
  }
  if(op.state==='authorized'){
   if((this.#options.now?.()??Date.now())>=op.expiresAt||signal?.aborted)throw Error('Approval expired or cancelled');
   if(input.expectedRevision!==this.#state.revision)throw Error('Project binding changed during approval');
   if(activate)this.#boundary(controller,op);
   const command={operationId:op.mutationId,type:input.type,...input.type==='publish'?{grantId:op.grantId}:input.type==='withdraw'?{id:input.id,base:input.base}:{id:input.id,from:input.from,reason:input.reason}};
   op.command=command;op.state='publishing';await this.#save();
   op.result=await this.#options.manager.execute(this.#options.publisher,command);
   await this.#save();
   const until=Date.now()+20000;
   while(op.result.state==='pending'&&op.result.response?.status>=200&&op.result.response?.status<300&&Date.now()<until){
     if(signal?.aborted)break;
     await new Promise(resolve=>setTimeout(resolve,100));
     op.result=await this.#options.manager.reconcile(this.#options.publisher,op.mutationId);await this.#save();
   }
  }else if(op.state==='publishing'||op.state==='pending'){op.result=await this.#options.manager.execute(this.#options.publisher,op.command);if(op.result.state==='pending')op.result=await this.#options.manager.reconcile(this.#options.publisher,op.mutationId);await this.#save();}
  if(['publishing','pending'].includes(op.state)){
   if(op.result.state!=='confirmed_success'){op.state=op.result.state==='confirmed_rejected'?'rejected':'pending';await this.#save();return this.receipt(op);}
   if(activate){const reference=publicationReference(op.result.reference);op.target={...this.manifest(),references:this.manifest().references.filter(r=>r.id!==reference.id).concat(reference)};}
   op.state='published';await this.#save();
  }
  if(op.state==='published'&&!activate){op.state='completed';await this.#save();return this.receipt(op);}
  if(op.state==='published'){
   if(signal?.aborted)return this.receipt(op);
   if(input.expectedRevision!==this.#state.revision)throw Error('Published; activation requires a fresh approval after concurrent switch');
   this.#boundary(controller,op);await loadConsensus(op.target,this.#options.resolve);op.state='switching';await this.#save();
  }
  if(op.state==='switching'){
   if(input.expectedRevision!==this.#state.revision)throw Error('Project binding revision changed');
   const current=controller.snapshot();const marker=`approval:${input.operationId}: ${input.reason}`;
   if(current.manifestRevision===op.sessionRevision)await controller.setManifest(op.target,{expectedRevision:op.sessionRevision,reason:marker});
   else if(current.manifestRevision!==op.sessionRevision+1||!same(current.manifest,op.target)||!current.bindingHistory?.some(h=>h.revision===op.sessionRevision&&h.reason===marker))throw Error('Session activation does not match approved operation');
   this.#state.history.push({revision:this.#state.revision,manifest:this.manifest(),operationId:input.operationId});this.#state.manifest=structuredClone(op.target);this.#state.revision++;op.state='completed';await this.#save();
  }
  return this.receipt(op);
 }
}
