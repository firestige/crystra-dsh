import {LlmAdapter} from '@deepseek-ai/dsh-llm';
import {candidate} from './code-candidate.mjs';
import {appendFileSync} from 'node:fs';
export const inject=['llm','tools','crystraNative'];
export function apply(ctx){
 const counts=new Map();
 const output=(event)=>{if(process.env.CRYSTRA_NATIVE_OBSERVATIONS)appendFileSync(process.env.CRYSTRA_NATIVE_OBSERVATIONS,JSON.stringify(event)+'\n');};
 class Adapter extends LlmAdapter{async *stream(options){
  if(!options.tools?.length){const block={type:'text',text:'Native probe'};yield {type:'block-start',index:0,blockType:'text'};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:'stop'}};return;}
  const session=options.model,i=(counts.get(session)??0)+1;counts.set(session,i);
  output({type:'request',i,model:options.model,status:ctx.crystraNative.status(),hasConsensus:JSON.stringify(options.messages).includes('Bound consensus publications'),tools:options.tools?.map(t=>t.name)});
  const check=process.env.CRYSTRA_NATIVE_CASE==='managed';
  const call=(name,args)=>({type:'tool-call',id:'call-'+i,name,arguments:JSON.stringify(args)});
  let block;
  if(options.model==='reflection-offline'){
   block=i===1?call('crystra_reflection_read',{file:'core.mjs'}):i===2?call('crystra_reflection_experiment',{id:'regression'}):i===3?call('crystra_reflection_report',{summary:'Actual regression passed; no performance comparison claimed.',assessments:{correctness:'Known fixture passed.',robustness:'Limited fixture coverage.',performance:'Unmeasured.'},findings:[]}):{type:'text',text:'Reflection done'};
  }else if(options.model==='crystallization-offline'){
   const texts=[];const walk=x=>{if(!x||typeof x!=='object')return;if(x.type==='text')texts.push(x.text);for(const v of Object.values(x))if(typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);};walk(options.messages);
   const reference=texts.map(t=>{try{return JSON.parse(t).reference;}catch{return null;}}).findLast(Boolean);
   block=i===1?call('crystra_crystallization_read',{index:0,offset:0}):i===2?call('crystra_code_register',candidate()):i===3?call('crystra_crystallization_propose',{decision:'candidate',reason:'Verified deterministic doubling boundary',reference}):{type:'text',text:'Evaluation done'};
  }else if(!check)block={type:'text',text:'Native profile works.'};
  else if(i===1)block={type:'tool-call',id:'declare',name:'crystra_declare_step',arguments:JSON.stringify({label:'Execute probe successfully',actions:[{id:'probe',tool:'native_probe',kind:'result-equals',match:{suite:'public'},path:['x'],equals:0}]})};
  else if(i===2)block={type:'tool-call',id:'bad',name:'native_probe',arguments:'{"suite":"public","bad":true}'};
  else if(i===3)block={type:'text',text:'Attempt early finish.'};
  else if(i===4)block={type:'tool-call',id:'good',name:'native_probe',arguments:'{"suite":"public"}'};
  else if(process.env.CRYSTRA_NATIVE_ALL==='1'&&i===5)block=call('crystra_reflect_core',{goal:'Check core correctness, robustness and performance'});
  else if(process.env.CRYSTRA_NATIVE_ALL==='1'&&i>=6&&i<=9)block=call('native_double',{input:{x:i===9?-1:i-5}});
  else block={type:'text',text:'Native managed work done.'};
  yield {type:'block-start',index:0,blockType:block.type};yield {type:'block-end',index:0,block};yield {type:'finish',reason:{kind:block.type==='tool-call'?'tool-calls':'stop'}};
 }}
 ctx.llm.registerAdapter(['native-fixture'],new Adapter());
 ctx.tools.register({name:'native_probe',description:'Native installation probe',parameters:{type:'object'},output:{schema:{type:'object'},render:(_args,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:args=>({x:args.bad?1:0})});
 ctx.tools.register({name:'native_double',description:'Double a public numeric input',parameters:{type:'object',properties:{input:{type:'object',properties:{x:{type:'integer'}},required:['x']}},required:['input']},output:{schema:{type:'number'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},execute:args=>{output({type:'original-double',input:args.input});return args.input.x*2;}});
 ctx.on('agent/disposed',({agent})=>output({type:'disposed',sessionId:agent.session.id,status:ctx.crystraNative.status(),events:agent.session.snapshotEvents()}));
}
