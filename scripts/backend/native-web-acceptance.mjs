import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const pause=()=>new Promise(r=>setTimeout(r,100));
/** Uses only native browser HTTP RPCs; no in-process agent assembly. */
export async function verifyWeb({env,project,output,run,tarball,fixtureTarball}){
 assert.equal((await run('web-initialize',['dsh','--profile','web-check','--from-default-profile','web','--dump-config'])).code,0);
 assert.equal((await run('web-install',['dsh','plugin','--profile','web-check','add',tarball,fixtureTarball,'--ignore-scripts'],{timeout:60000})).code,0);
 let child,stdout='',stderr='';
 const start=async()=>{
  stdout='';stderr='';child=spawn('dsh',['--profile','web-check','--no-open','--port','0'],{cwd:project,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
  const deadline=Date.now()+20000;let url;
  while(!(url=(stdout+'\n'+stderr).match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+\/[^\s]*/)?.[0])){if(child.exitCode!==null||Date.now()>deadline)throw Error('Web startup failed: '+stderr.replace(/http:\/\/\S+/g,'[launch URL]'));await pause();}
  const exchange=await fetch(url,{redirect:'manual'});const cookie=exchange.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie,'Native launch URL must establish authentication');
  const origin=new URL(url).origin;
  return async(method,request)=>{const r=await fetch(origin+'/api/session/'+method,{method:'POST',headers:{'content-type':'application/json',cookie,origin},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:'session/'+method,payload:{args:{request}}})});const body=await r.json();if(!body.result?.ok)throw Error('Native RPC '+method+': '+JSON.stringify(body));return body.result.value;};
 };
 const stop=async()=>{if(!child||child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(r=>{const timer=setTimeout(()=>child.kill('SIGKILL'),3000);child.once('close',()=>{clearTimeout(timer);r();});});};
 try{
  let rpc=await start();const id='native-web-worker';const created=await rpc('create',{sessionId:id,cwd:project});
  await rpc('prompt',{sessionId:id,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:'Run the managed probe'}]});
  const waitDone=async()=>{const deadline=Date.now()+15000;while(true){const files=await readFile(join(output,'observations.jsonl'),'utf8').catch(()=> '');const calls=files.trim().split('\n').filter(Boolean).map(JSON.parse).filter(x=>x.type==='request'&&x.status.managed.includes(id));if(calls.length>=5)return calls;if(Date.now()>deadline)throw Error('Web managed work did not finish');await pause();}};
  const calls=await waitDone();assert.equal(calls[0].hasConsensus,true);await new Promise(r=>setTimeout(r,300));await stop();
  rpc=await start();await rpc('prompt',{sessionId:id,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:'Continue the persisted managed session'}]});await new Promise(r=>setTimeout(r,1500));
  await stop();
  const settingsPath=join(env.DSH_HOME,'settings.yaml'),original=await readFile(settingsPath,'utf8'),changed=JSON.parse(original);changed.crystra.project.scope='changed-binding';await writeFile(settingsPath,JSON.stringify(changed));
  try{rpc=await start();const before=await readFile(join(output,'observations.jsonl'),'utf8');await rpc('prompt',{sessionId:id,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:'Resume with a changed binding; this must fail before model use'}]});await new Promise(r=>setTimeout(r,1200));assert.equal(await readFile(join(output,'observations.jsonl'),'utf8'),before);await stop();}finally{await writeFile(settingsPath,original);}
  await writeFile(join(output,'web-summary.json'),JSON.stringify({created,firstPromptManaged:true,restartedAndPromptAccepted:true,changedBindingBlockedBeforeModel:true},null,2));
 }finally{await stop();}
}
