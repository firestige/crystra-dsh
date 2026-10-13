import {plain,digest} from './value.js';

// Host-only decoding. Domain consumers receive facts, never DSH envelopes.
export function decodeOriginalResult(message){
 const blocks=message?.content;
 if(!Array.isArray(blocks)||blocks.length!==1||blocks[0]?.type!=='tool-result'||blocks[0].isError||!Array.isArray(blocks[0].content)||blocks[0].content.length!==1||blocks[0].content[0]?.type!=='text')return {found:false};
 try{const value=JSON.parse(blocks[0].content[0].text);digest(value);return {found:true,value};}catch{return {found:false};}
}
function structuredResult(block){try{return {found:true,value:JSON.parse(block.content.filter(p=>p.type==='text').map(p=>p.text).join(''))};}catch{return {found:false};}}
export function extractExecutionFacts(evidence,{after=0,callSeq}={}){
 if(!Array.isArray(evidence?.events))throw new Error('Missing native execution events');
 const {sessionId,seq,events}=evidence,calls=[],results=new Map(),linked=new Map(),counts=new Map();
 if(after>=seq)return {sessionId,seq,executions:[]};
 for(const e of events){
  // Strict originals reject every link to their call, including malformed links
  // before the call itself. Windowing must not erase that ambiguity.
  if(callSeq!==undefined&&e.type==='tool/result'&&e.sourceEventSeqs?.includes(callSeq))linked.set(callSeq,(linked.get(callSeq)??0)+1);
  if(e.seq<=after||e.seq>seq)continue;
  if(e.type==='tool/call'&&(callSeq===undefined||e.seq===callSeq)){calls.push(e);counts.set(e.seq,(counts.get(e.seq)??0)+1);}
  else if(e.type==='tool/result'&&Array.isArray(e.sourceEventSeqs)){
   if(callSeq===undefined)for(const source of new Set(e.sourceEventSeqs))linked.set(source,(linked.get(source)??0)+1);
   if(e.sourceEventSeqs.length!==1)continue;
   const source=e.sourceEventSeqs[0];if(!Number.isSafeInteger(source)||source<=after||source>=e.seq||(callSeq!==undefined&&source!==callSeq))continue;
   results.set(source,results.has(source)?null:e);
  }
 }
 const executions=[];
 for(const call of calls){
  const result=results.get(call.seq),message=result?.data?.message;
  if(message?.source?.callId!==call.data.callId||!Array.isArray(message.content)||message.content.some(p=>!plain(p)))continue;
  const blocks=message.content.filter(p=>p.type==='tool-result'&&p.toolCallId===call.data.callId);
  if(blocks.length!==1||blocks[0].isError)continue;
  let args;try{args=JSON.parse(call.data.arguments);}catch{continue;}if(!plain(args))continue;
  const original=counts.get(call.seq)===1&&linked.get(call.seq)===1&&typeof call.data.callId==='string'&&call.data.callId?decodeOriginalResult(message):{found:false};
  executions.push({callSeq:call.seq,resultSeq:result.seq,callId:call.data.callId,tool:call.data.name,arguments:args,result:structuredResult(blocks[0]),original});
 }
 return {sessionId,seq,executions};
}
export const nativeEvidence=source=>async window=>extractExecutionFacts(await source(),window);
export function nativeCrystallizationConfig(config){
 if(typeof config.readFacts!=='function'&&typeof config.readEvents!=='function')throw new TypeError('Native event reader required');
 return {...config,readFacts:config.readFacts??(async(id,window)=>extractExecutionFacts({sessionId:id,seq:Number.MAX_SAFE_INTEGER,events:await config.readEvents(id)},window))};
}
