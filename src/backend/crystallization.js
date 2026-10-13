import {randomUUID} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {digest,same,plain} from './value.js';

const copy=value=>structuredClone(value);
class GuardDeclined extends Error {}
function reference(value) {
  if(!plain(value)||typeof value.id!=='string'||!value.id||!Number.isSafeInteger(value.version)||value.version<1||!/^[a-f0-9]{64}$/.test(value.hash))throw new Error('Invalid frozen capability reference');
  return {id:value.id,version:value.version,hash:value.hash};
}

/** Host-owned execution boundary. No scheduler, model routing, or arbitrary-code sandbox. */
export class Crystallization {
  static async open(config,journal) {
    if(typeof config.namespace!=='string'||!config.namespace||!['context','original','readFacts','evaluate','resolve'].every(key=>typeof config[key]==='function'))throw new TypeError('Crystallization namespace and trusted host ports required');
    const threshold=config.threshold??2;
    if(!Number.isSafeInteger(threshold)||threshold<2)throw new TypeError('At least two distinct originals required');
    const identity=`crystallization:${config.namespace}`;
    const state=await journal.read()??{schemaVersion:1,workerSessionId:identity,families:{},receipts:{}};
    if(state.schemaVersion!==1||state.workerSessionId!==identity||!plain(state.families))throw new Error('Invalid crystallization journal identity');
    state.receipts??={};
    for(const family of Object.values(state.families))for(const job of family.jobs)if(job.status==='running')job.status='interrupted';
    return new Crystallization({...config,threshold},journal,state);
  }
  constructor(config,journal,state){this.config=config;this.journal=journal;this.state=copy(state);this.tail=Promise.resolve();this.unavailable=false;this.closed=false;this.originalExecution=new AsyncLocalStorage();}
  isOriginalExecution(){return this.originalExecution.getStore()===this;}
  snapshot(){return copy(this.state);}
  async save(){try{await this.journal.append(this.state);}catch(error){this.unavailable=true;throw error;}}
  enqueue(request,operation) {
    const next=this.tail.then(async()=>{
      if(this.unavailable||this.closed)throw new Error('Crystallization service unavailable');
      if(!plain(request)||typeof request.scope!=='string'||!request.scope||typeof request.boundary!=='string'||!request.boundary)throw new TypeError('Explicit scope and execution boundary required');
      digest(request.input);return operation(copy(request));
    });
    this.tail=next.catch(()=>{});return next;
  }
  run(request) {return this.enqueue(request,r=>this.execute(r));}
  tryRun(request) {return this.enqueue(request,async r=>{
    const context=await this.context(r),{family}=this.family(r,context);
    return this.fast(r,context,family);
  });}
  observe(request,receipt,expectedContext,durationMs=null) {return this.enqueue(request,async r=>{
    const context=expectedContext===undefined?await this.context(r):copy(expectedContext);
    digest(context);await this.current(r,context);
    const {key,family}=this.family(r,context);
    const identity=this.receiptKey(receipt);
    if(this.state.receipts[identity])return {path:'ignored',reason:'already-observed'};
    return this.recordOriginal(r,copy(receipt),context,key,family,durationMs);
  });}
  recordRoute(request,ref,receipt,outcome){return this.enqueue(request,async r=>{
    const id=this.receiptKey(receipt);this.state.routes??={};
    if(!this.state.routes[id]){
      const frozen=reference(ref);
      this.state.routes[id]={path:'crystallized',scope:r.scope,boundary:r.boundary,inputHash:digest(r.input),reference:frozen,receipt:copy(receipt),isError:outcome.isError===true};
      if(outcome.isError===true)for(const family of Object.values(this.state.families)){
        if(family.scope===r.scope&&family.boundary===r.boundary&&family.active&&same(family.active.reference,frozen)){
          family.failures.push({reference:frozen,inputHash:digest(r.input),receipt:copy(receipt),reason:'Native tool pipeline rejected crystallized result'});
          family.active=null;family.nextEvaluation=family.observations.length;
        }
      }
      await this.save();
    }
  });}
  family(request,context){
    const key=digest({scope:request.scope,boundary:request.boundary,context});
    const family=this.state.families[key]??={scope:request.scope,boundary:request.boundary,context,observations:[],jobs:[],active:null,failures:[],nextEvaluation:this.config.threshold};
    return {key,family};
  }
  receiptKey(receipt){
    if(!receipt||typeof receipt.sessionId!=='string'||!Number.isSafeInteger(receipt.callSeq)||!Number.isSafeInteger(receipt.resultSeq))throw new Error('Invalid native original receipt');
    return digest({sessionId:receipt.sessionId,callSeq:receipt.callSeq,resultSeq:receipt.resultSeq});
  }
  async close(){this.closed=true;await this.tail;}
  async context(request){const result=copy(await this.config.context(copy(request)));digest(result);return result;}
  async capability(ref){
    const cap=await this.config.resolve(copy(ref));
    if(!cap||!same(reference(cap.reference),reference(ref))||digest(cap.material)!==ref.hash||!['guard','run','check'].every(k=>typeof cap[k]==='function'))throw new Error('Frozen capability version or material changed');
    return cap;
  }
  async current(request,context,ref){
    if(!same(await this.context(request),context))throw new Error('Applicability context changed during execution');
    if(ref)await this.capability(ref);
  }
  async execute(request){
    const context=await this.context(request),{key,family}=this.family(request,context);
    const fast=await this.fast(request,context,family);if(fast)return fast;
    const started=performance.now(),receipt=copy(await this.originalExecution.run(this,()=>this.config.original(copy(request))));
    return this.recordOriginal(request,receipt,context,key,family,performance.now()-started);
  }
  async fast(request,context,family){
    if(family.active){
      let result,error,execution;
      const ref=family.active.reference,started=performance.now();
      try{
        const cap=await this.capability(ref);
        if(await cap.guard(copy(request.input),copy(context))!==true)throw new GuardDeclined('Capability guard declined');
        execution={mode:'live',context:copy(context)};result=await cap.run(copy(request.input),execution);digest(result);
        if(await cap.check(copy(result),{input:copy(request.input),context:copy(context)})!==true)throw new Error('Capability output check failed');
        await this.current(request,context,ref);
      }catch(e){error=e;}
      if(!error){
        family.executions??=[];family.executions.push({reference:copy(ref),inputHash:digest(request.input),outputHash:digest(result),durationMs:performance.now()-started,...(execution?.receipt?{execution:copy(execution.receipt)}:{})});
        await this.save();return {path:'crystallized',output:copy(result),reference:copy(ref)};
      }
      if(error instanceof GuardDeclined){
        family.bypasses??=[];family.bypasses.push({reference:copy(ref),inputHash:digest(request.input),reason:error.message});
      }else{
        family.failures.push({reference:copy(ref),inputHash:digest(request.input),reason:error.message});family.active=null;family.nextEvaluation=family.observations.length;
      }
      await this.save();
      // A failed context read is not permission to run against unknown consensus.
      await this.current(request,context);
    }
    return null;
  }
  async recordOriginal(request,receipt,context,key,family,durationMs){
    const receiptKey=this.receiptKey(receipt);
    if(this.state.receipts[receiptKey])throw new Error('Native original receipt reused');
    const output=await this.originalOutput(request,receipt);
    await this.current(request,context);
    this.state.receipts[receiptKey]=key;
    const inputHash=digest(request.input);
    if(!family.observations.some(o=>o.inputHash===inputHash))family.observations.push({input:copy(request.input),inputHash,output:copy(output),outputHash:digest(output),receipt,durationMs});
    await this.save();
    if(!family.active&&family.observations.length>=family.nextEvaluation)await this.evaluate(request,family);
    return {path:'original',output:copy(output),receipt};
  }
  async originalOutput(request,receipt){
    if(!receipt||typeof receipt.sessionId!=='string'||!Number.isSafeInteger(receipt.callSeq)||!Number.isSafeInteger(receipt.resultSeq)||receipt.resultSeq<=receipt.callSeq)throw new Error('Invalid native original receipt');
    const facts=await this.config.readFacts(receipt.sessionId,{after:receipt.callSeq-1,callSeq:receipt.callSeq});
    if(!facts||facts.sessionId!==receipt.sessionId||!Array.isArray(facts.executions))throw new Error('Missing native original facts');
    const matches=facts.executions.filter(e=>e.callSeq===receipt.callSeq&&e.resultSeq===receipt.resultSeq);
    if(matches.length!==1)throw new Error('Ambiguous or missing native original receipt');
    const execution=matches[0];
    if(execution.tool!==request.boundary||!same(execution.arguments.input,request.input))throw new Error('Native original provenance mismatch');
    if(!execution.original?.found)throw new Error('Unsupported native original result');
    return copy(execution.original.value);
  }
  async evaluate(request,family){
    const job={id:randomUUID(),status:'running',context:copy(family.context),observationCount:family.observations.length,shadows:[]};
    family.jobs.push(job);family.nextEvaluation=family.observations.length+this.config.threshold;
    await this.save();
    let admitted=null;
    try{
      const proposal=copy(await this.config.evaluate({id:job.id,scope:family.scope,boundary:family.boundary,context:copy(family.context),observations:copy(family.observations)}));
      if(proposal?.evaluation)job.evaluation=copy(proposal.evaluation);
      if(!proposal||!['candidate','defer','decline'].includes(proposal.decision)||typeof proposal.reason!=='string'||!proposal.reason.trim())throw new Error('Invalid evaluation decision');
      job.proposal=proposal;
      if(proposal.decision!=='candidate')job.status=proposal.decision;
      else{
        const ref=reference(proposal.reference),cap=await this.capability(ref);
        for(const observation of [...family.observations].reverse()){
          if(await cap.guard(copy(observation.input),copy(family.context))!==true)continue;
          const started=performance.now();
          const execution={mode:'shadow',context:copy(family.context)};const output=await cap.run(copy(observation.input),execution);digest(output);
          const passed=await cap.check(copy(output),{input:copy(observation.input),context:copy(family.context)})===true&&same(output,observation.output);
          job.shadows.push({inputHash:observation.inputHash,receipt:copy(observation.receipt),outputHash:digest(output),passed,durationMs:performance.now()-started,...(execution.receipt?{execution:copy(execution.receipt)}:{})});
          if(!passed)throw new Error('Historical shadow disagrees with native original');
          await this.current(request,family.context,ref);
          if(job.shadows.length>=this.config.threshold)break;
        }
        if(job.shadows.length<this.config.threshold)throw new Error('Insufficient applicable independent originals');
        await this.current(request,family.context,ref);
        admitted={reference:ref,jobId:job.id};job.status='promoted';
      }
    }catch(error){job.status='failed';job.error=error.message;family.nextEvaluation=family.observations.length+1;}
    family.active=admitted;await this.save();
  }
}
