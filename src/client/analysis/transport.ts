import { QueryError, type AnalysisTransport } from 'crystra-ui-core';
interface AnalysisRpc {
 call(channel:string,endpoint:string,payload:Record<string,unknown>,signal?:AbortSignal):Promise<unknown>;
}
/** DSH is the only layer that knows the RPC route and host error envelope. */
export function createAnalysisTransport(rpc:AnalysisRpc):AnalysisTransport {
 return {async request(endpoint,payload,signal) {
  const answer=await rpc.call('/crystra-studio',endpoint,payload,signal);
  if(!answer||typeof answer!=='object'||!('ok' in answer))throw new QueryError('HOST_RESPONSE_INVALID','分析服务返回格式不正确');
  if(answer.ok===true&&'value' in answer)return answer.value;
  if('error' in answer&&answer.error&&typeof answer.error==='object'&&'code' in answer.error&&'message' in answer.error&&typeof answer.error.code==='string'&&typeof answer.error.message==='string'){
   const details='details' in answer.error ? answer.error.details : undefined;
   const code=details&&typeof details==='object'&&'serviceCode' in details&&typeof details.serviceCode==='string'?details.serviceCode:answer.error.code;
   throw new QueryError(code,answer.error.message);
  }
  throw new QueryError('HOST_RESPONSE_INVALID','分析服务返回格式不正确');
 }};
}
