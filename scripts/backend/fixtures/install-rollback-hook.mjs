import{readFile,writeFile,mkdir,access}from'node:fs/promises';import{execFile}from'node:child_process';import{promisify}from'node:util';import{join}from'node:path';
const run=promisify(execFile),c=JSON.parse(await readFile(process.env.CRYSTRA_ROLLBACK_CONTEXT,'utf8')),stage=process.argv[2];
const record=async data=>{const rows=JSON.parse(await readFile(c.trace,'utf8'));rows.push(data);await writeFile(c.trace,JSON.stringify(rows));};
try{
 if(stage==='pre'){
  const candidates=c.fail==='environment'?['/definitely-missing-container-engine']:c.candidates;let runtime;
  for(const cmd of candidates){try{await run(cmd,['version','--format','{{.Server.Version}}'],{timeout:5000});await run(cmd,['compose','version'],{timeout:5000});runtime=cmd;break;}catch{}}
  if(!runtime)throw Error('No available compatible container runtime');
  await record({stage:'preflight',runtime});
 }else{
  await run(c.engine,['compose','-f',c.compose,'up','-d','--wait','--pull','never'],{timeout:120000,maxBuffer:2e6});await record({stage:'service-started'});
  const deadline=Date.now()+90000;while(true){try{const r=await fetch(c.origin+'/api/ping');if(r.ok)break;}catch{}if(Date.now()>deadline)throw Error('CMS readiness timeout');await new Promise(r=>setTimeout(r,500));}
  const response=await fetch(c.origin+'/identity-server/connect/token',{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:'crystra-admin',client_secret:'crystra-local-admin-fixture-only',scope:'squidex-api'})});if(!response.ok)throw Error('CMS authentication failed');const {access_token:token}=await response.json();
  const req=async(method,path,data)=>{const r=await fetch(c.origin+path,{method,headers:{authorization:'Bearer '+token,'X-Unpublished':'1','content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});if(!r.ok)throw Error('CMS '+method+' failed '+r.status);return r.status===204?null:r.json();};
  const apps=await req('GET','/api/apps');if(!apps.some(a=>a.name==='rollback-protected'))await req('POST','/api/apps',{name:'rollback-protected'});
  const credentials=JSON.parse(await readFile(c.credentials,'utf8'));credentials.crystraFixture={management:'fixture-only',consumer:'fixture-readonly'};await writeFile(c.credentials,JSON.stringify(credentials));await record({stage:'app-and-credentials-created'});
  if(c.fail==='initialization')throw Error('Injected initialization failure after service/app/credentials');
  const schemas=await req('GET','/api/apps/rollback-protected/schemas');if(!schemas.items.some(s=>s.name==='agreements'))await req('POST','/api/apps/rollback-protected/schemas',{name:'agreements',isPublished:true,fields:[{name:'body',partitioning:'invariant',properties:{fieldType:'String'}}]});
  const items=await req('GET','/api/content/rollback-protected/agreements');if(!items.items.length)await req('POST','/api/content/rollback-protected/agreements',{body:{iv:'protected consensus data from the first successful installation'}});
  const settings=JSON.parse(await readFile(c.settings,'utf8'));settings.crystraFixture={enabled:true,origin:c.origin};await writeFile(c.settings,JSON.stringify(settings));await record({stage:'initialized'});
 }
}catch(e){await record({stage,error:e.message});console.error(e.message);process.exitCode=23;}
