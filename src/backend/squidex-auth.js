import {SquidexClient} from './squidex-client.js';
/** Local client-credentials token source. Secrets never enter agent state. */
export function clientToken({baseUrl,clientId,secret,timeoutMs=10000,now=Date.now}){
 new SquidexClient({baseUrl,app:'validation',schema:'validation',managementToken:async()=>'',consumerToken:async()=>''});
 if(typeof clientId!=='string'||!clientId.trim()||typeof secret!=='function')throw Error('Squidex client identity and host secret required');
 let cached=null,pending=null;
 return async()=>{
  if(cached&&now()<cached.until)return cached.value;
  if(pending)return pending;
  pending=(async()=>{
   const response=await fetch(new URL('/identity-server/connect/token',baseUrl),{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'squidex-api',client_id:clientId,client_secret:await secret()})});
   if(!response.ok)throw Error(`Squidex authentication failed (${response.status})`);
   const data=await response.json();if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Invalid Squidex authentication response');
   cached={value:data.access_token,until:now()+Math.max(0,data.expires_in-30)*1000};return cached.value;
  })();
  try{return await pending;}finally{pending=null;}
 };
}
