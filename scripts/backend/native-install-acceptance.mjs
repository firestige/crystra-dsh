import {mkdtemp,mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {auditRecords} from './native-record-audit.mjs';
import {verifyPreservation} from './native-config-preservation.mjs';
import {verifyWeb} from './native-web-acceptance.mjs';
import assert from 'node:assert/strict';
import {fixture,content,publish} from '../../test/integration/squidex-fixture.mjs';
import {spawn} from 'node:child_process';
const repo=resolve(import.meta.dirname,'../..');
const base=await mkdtemp(join(tmpdir(),'crystra-native-acceptance-'));const home=join(base,'home'),project=join(base,'project'),provider=join(base,'provider');for(const p of [home,project,provider])await mkdir(p);
const output=resolve(repo,'artifacts/backend-rebuild/native-runtime',String(Date.now()));await mkdir(output,{recursive:true});
const env={...process.env,DSH_HOME:home,CRYSTRA_NATIVE_OBSERVATIONS:join(output,'observations.jsonl'),CRYSTRA_NATIVE_CASE:'plain'};
async function run(name,args,{cwd=base,timeout=30000}={}){return new Promise(resolve=>{const child=spawn(args[0],args.slice(1),{cwd,env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);child.on('close',async(code,signal)=>{clearTimeout(timer);const result={name,args,code,signal,stdout,stderr};await writeFile(join(output,name+'.json'),JSON.stringify(result,null,2));resolve(result);});});}
await writeFile(join(provider,'package.json'),JSON.stringify({name:'crystra-native-acceptance-provider',version:'1.0.0',type:'module',main:'index.mjs',dependencies:{'@deepseek-ai/dsh-llm':'0.1.5-rc.2'},dsh:{bundle:{patch:'cordis.patch.yml'}}}));await copyFile(join(repo,'test/fixtures/native-cli-provider.mjs'),join(provider,'index.mjs'));await copyFile(join(repo,'test/fixtures/code-candidate.mjs'),join(provider,'code-candidate.mjs'));await writeFile(join(provider,'cordis.patch.yml'),'- insert:\n    - id: native-acceptance-provider\n      name: crystra-native-acceptance-provider\n');
const pack=await run('pack',['npm','pack',repo,'--pack-destination',base,'--ignore-scripts','--json']);if(pack.code!==0)throw Error(pack.stderr);const tarball=join(base,JSON.parse(pack.stdout)[0].filename);
// Initialize and install solely through the DSH public command.
const init=await run('initialize',['dsh','--profile','acceptance','--from-default-profile','headless','--dump-config']);if(init.code!==0)throw Error(init.stderr);
const fixturePack=await run('pack-provider',['npm','pack',provider,'--pack-destination',base,'--ignore-scripts','--json']);if(fixturePack.code!==0)throw Error(fixturePack.stderr);const fixtureTarball=join(base,JSON.parse(fixturePack.stdout)[0].filename);
const installed=await run('install',['dsh','plugin','--profile','acceptance','add',tarball,fixtureTarball,'--ignore-scripts'],{timeout:60000});if(installed.code!==0)throw Error(installed.stderr);
if(process.env.CRYSTRA_VERIFY_PRESERVATION==='1')await verifyPreservation({home,output,run,tarball});
await writeFile(join(home,'settings.yaml'),'agent-default-model:\n  provider: native-fixture\n  model: offline\ncrystra:\n  enabled: false\n');
const result=await run('unconfigured',['dsh','--profile','acceptance','Run native installation probe'],{cwd:project});
await writeFile(join(output,'location.json'),JSON.stringify({base,home,project,output,tarball},null,2));console.log(JSON.stringify({base,output,result},null,2));

assert.equal(result.code,0,'Unconfigured native profile must remain usable');
if(process.env.CRYSTRA_SQUIDEX_URL){
 const f=await fixture(join(base,'cms-setup-records'));
 try{
 const published=await publish(f,content('Bound consensus publications: native installation acceptance','native'));
 const config={enabled:true,project:{root:project,scope:'native',references:[published.reference]},squidex:{baseUrl:f.baseUrl,app:f.app,schema:'agreements',managementTokenRef:'CRYSTRA_CMS_WRITE',consumerTokenRef:'CRYSTRA_CMS_READ'}};
 env.CRYSTRA_CMS_WRITE=f.management;env.CRYSTRA_CMS_READ=f.consumer;env.CRYSTRA_NATIVE_CASE='managed';
 const settings=async c=>writeFile(join(home,'settings.yaml'),JSON.stringify({'agent-default-model':{provider:'native-fixture',model:'offline'},crystra:c}));
 await settings(config);
 env.CRYSTRA_NATIVE_CASE='plain';
 const outside=await run('outside-project',['dsh','--profile','acceptance','Unmanaged ordinary work'],{cwd:base});assert.equal(outside.code,0);env.CRYSTRA_NATIVE_CASE='managed';
 const managed=await run('managed',['dsh','--profile','acceptance','Run the managed probe'],{cwd:project});
 console.log(JSON.stringify({managed},null,2));
 assert.equal(managed.code,0);
 const clientConfig={...config,squidex:{baseUrl:f.baseUrl,app:f.app,schema:'agreements',managementClientId:f.managementClientId,managementSecretRef:'CRYSTRA_CMS_WRITE',consumerClientId:f.consumerClientId,consumerSecretRef:'CRYSTRA_CMS_READ'}};
 await settings(clientConfig);env.CRYSTRA_CMS_WRITE=f.managementSecret;env.CRYSTRA_CMS_READ=f.consumerSecret;assert.equal((await run('client-authentication',['dsh','--profile','acceptance','Read consensus using native host secrets'],{cwd:project})).code,0);
 env.CRYSTRA_CMS_WRITE=f.management;env.CRYSTRA_CMS_READ=f.consumer;await settings(config);
 await verifyWeb({env,project,output,run,tarball,fixtureTarball});
 await writeFile(join(project,'core.mjs'),'export const double=x=>x*2;');
 config.reflection={enabled:true,provider:'native-fixture',model:'reflection-offline',files:['core.mjs'],experiments:[{id:'regression',command:process.execPath,args:['-e','if(2*2!==4)process.exit(1)']}]};
 config.crystallization={enabled:true,provider:'native-fixture',model:'crystallization-offline',python:'/usr/bin/python3'};
 await settings(config);env.CRYSTRA_NATIVE_ALL='1';
 const all=await run('four-capabilities',['dsh','--profile','acceptance','Run four capabilities'],{cwd:project,timeout:60000});console.log(JSON.stringify({all},null,2));assert.equal(all.code,0);delete env.CRYSTRA_NATIVE_ALL;
 for(const [name,c,credentials] of [
 ['missing-credentials',config,false],
 ['cms-unavailable',{...config,squidex:{...config.squidex,baseUrl:'http://127.0.0.1:3948',timeoutMs:1000}},true],
 ['wrong-reference',{...config,project:{...config.project,references:[{...published.reference,publication_event_id:'wrong'}]}},true],
 ['invalid-configuration',{enabled:true},true],
 ]){
 await settings(c);if(!credentials){delete env.CRYSTRA_CMS_WRITE;delete env.CRYSTRA_CMS_READ;}
 const beforeObservations=await readFile(env.CRYSTRA_NATIVE_OBSERVATIONS,'utf8');
 const bad=await run(name,['dsh','--profile','acceptance','This must not reach the model'],{cwd:project});
 assert.notEqual(bad.code,0);assert.equal(await readFile(env.CRYSTRA_NATIVE_OBSERVATIONS,'utf8'),beforeObservations,'Rejected configuration must not reach the model');
 console.log(JSON.stringify({name,code:bad.code,stderr:bad.stderr},null,2));env.CRYSTRA_CMS_WRITE=f.management;env.CRYSTRA_CMS_READ=f.consumer;
 }
 console.log(JSON.stringify({audit:await auditRecords(home,output)},null,2));
 }finally{await f.close();}
}
