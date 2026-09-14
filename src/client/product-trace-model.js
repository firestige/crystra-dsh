/** Exact recorded Trace queries; no evaluation or inferred run selection. */
export function createProductTraceController({gateway,decode,load,compile}) {
  let snapshot=Object.freeze({phase:'idle',traceId:'',view:'waterfall'}),generation=0;
  const listeners=new Set();
  const publish=patch=>{snapshot=Object.freeze({...snapshot,...patch});for(const listener of listeners)listener();};
  return Object.freeze({
    getSnapshot:()=>snapshot,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    clear(){generation++;publish({phase:'idle',traceId:'',trace:undefined,error:undefined});},
    setView(view){if(!['waterfall','tree'].includes(view))throw new Error('TRACE_VIEW_INVALID');publish({view});},
    async open(traceId){
      const request=++generation;
      publish({traceId,phase:'loading',trace:undefined,error:undefined});
      if(typeof traceId!=='string'||!/^[a-f0-9]{32}$/.test(traceId)){
        publish({phase:'error',error:'请输入 32 位小写十六进制 Trace ID。'});return;
      }
      const items=[];
      try{
        const result=await load({async getTracesPage(filters){
          if(request!==generation)return {ok:false,error:{code:'TRACE_QUERY_SUPERSEDED'}};
          const answer=await gateway.call('traces/read',filters);
          if(!answer.ok)return answer;
          const decoded=decode('traces',answer.value,filters.limit);
          if(decoded.ok)items.push(...decoded.value.items);
          return decoded;
        }},traceId);
        if(request!==generation)return;
        if(!result.ok){publish({phase:'error',error:result.reason});return;}
        if(result.state==='ABSENT'){publish({phase:'absent'});return;}
        const trace=compile(items);
        if(trace.status==='INVALID'){publish({phase:'error',error:trace.errors.join('; ')});return;}
        publish({phase:result.state==='PARTIAL'?'partial':'ready',trace});
      }catch(error){if(request===generation)publish({phase:'error',error:error?.message??'Trace 查询失败'});}
    },
  });
}
