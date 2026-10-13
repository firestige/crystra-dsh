import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const worker=fileURLToPath(new URL('../../test/fixtures/payload-spike-worker.mjs',import.meta.url));
const out=fileURLToPath(new URL('../../artifacts/backend-rebuild/payload-spike/',import.meta.url));mkdirSync(out,{recursive:true});
const records=[];
function run(spec){
 const id=[spec.mode,spec.location,spec.overflow?'overflow':`d${spec.depth??0}`,spec.array?'array':'object'].join('-');
 const child=spawnSync(process.execPath,[worker,JSON.stringify(spec)],{encoding:'utf8',timeout:5000,maxBuffer:4*1024*1024});
 writeFileSync(out+id+'.log',child.stdout+'\nSTDERR\n'+child.stderr);
 const line=child.stdout.split('\n').find(l=>l.startsWith('PAYLOAD_RESULT '));let observed;
 try{observed=line?JSON.parse(line.slice(15)):null;}catch{}
 const rec={id,spec,exitStatus:child.status,signal:child.signal,error:child.error?.message,observed};records.push(rec);writeFileSync(out+id+'.json',JSON.stringify(rec,null,2));
 console.log(id,JSON.stringify(observed?{compile:observed.compile?.status,verify:observed.verify,declare:observed.declare,finish:observed.finish,host:observed.host}:rec));return rec;
}
for(const mode of ['pure','native'])for(const location of ['args-target','args-side','result-target','result-side']){run({mode,location,depth:0});run({mode,location,overflow:true});}
for(const location of ['args-target','result-target'])run({mode:'compile',location,overflow:true});
for(const mode of ['compile','pure','native'])for(const location of ['args-target','args-side','result-target','result-side'])for(const array of [false,true]){
 if(mode==='compile'&&location.endsWith('side'))continue;
 for(const depth of [32,256,1024,4096,8192]){
  const r=run({mode,location,array,depth});const o=r.observed;
  const failed=r.exitStatus!==0||o?.host||o?.compile?.status==='threw'||o?.verify?.status==='threw'||o?.finish?.status==='threw';
  if(failed){if(depth>32)run({mode,location,array,depth:Math.floor(depth/2)});break;}
 }
}
const versions=Object.fromEntries(['dsh-agent-loop','dsh-tools','dsh-session','dsh-session-persistence-jsonl'].map(name=>[name,JSON.parse(readFileSync(new URL(`../../node_modules/@deepseek-ai/${name}/package.json`,import.meta.url),'utf8')).version]));
writeFileSync(out+'summary.json',JSON.stringify({generatedAt:new Date().toISOString(),node:process.version,versions,records},null,2));
