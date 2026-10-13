// Consumer acceptance: no source checkout imports, existing npm cache, DSH home or CMS volume.
import {mkdtemp,mkdir,writeFile,readFile,readdir,realpath,stat,copyFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const repository=resolve(import.meta.dirname,'../..');
const evidence=resolve(repository,'artifacts/backend-rebuild/backend-only-clean-install');await mkdir(evidence,{recursive:true});
const root=await mkdtemp('/private/tmp/crystra-clean-'),consumer=join(root,'consumer');
for(const part of ['consumer','home','cache','tmp','pack','xdg-config','xdg-data','xdg-cache'])await mkdir(join(root,part),{recursive:true});
await writeFile(join(root,'empty-npmrc'),'');await writeFile(join(root,'global-npmrc'),'');
const env={PATH:process.env.PATH,HOME:join(root,'home'),TMPDIR:join(root,'tmp'),XDG_CONFIG_HOME:join(root,'xdg-config'),XDG_DATA_HOME:join(root,'xdg-data'),XDG_CACHE_HOME:join(root,'xdg-cache'),npm_config_cache:join(root,'cache'),npm_config_userconfig:join(root,'empty-npmrc'),npm_config_globalconfig:join(root,'global-npmrc'),npm_config_registry:'https://registry.npmjs.org',DOCKER_HOST:'unix:///var/run/docker.sock'};
const result={root,consumer,environment:'whitelisted fresh HOME/XDG/TMPDIR/npm cache; no model or CMS credentials inherited',steps:[],passed:false};
async function run(label,command,args,options={}){
 console.log(label);const started=Date.now();let stdout='',stderr='';
 const code=await new Promise((done,fail)=>{const child=spawn(command,args,{cwd:consumer,env,...options,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.on('error',fail);child.on('exit',code=>done(code));});
 await writeFile(join(evidence,label+'.log'),stdout+'\n'+stderr);result.steps.push({label,code,elapsedMs:Date.now()-started});if(code!==0)throw Error(label+' failed; see '+join(evidence,label+'.log'));return stdout;
}
const runtime=(label,args,extra={})=>run(label,process.execPath,['--permission','--allow-addons','--allow-fs-read='+consumer,'--allow-fs-read='+join(root,'tmp'),'--allow-fs-write='+root,'--allow-child-process',...args],{env:{...env,...extra}});
let compose,project;
try{
 project='crystra-clean-'+root.split('-').at(-1).toLowerCase();
 const manifest=JSON.parse(await readFile(join(repository,'package.json'),'utf8'));
 // Explicit supported DSH host profile: dependency overrides are not inherited by npm consumers.
 await writeFile(join(consumer,'package.json'),JSON.stringify({name:'crystra-clean-consumer',version:'1.0.0',private:true,type:'module',dependencies:manifest.devDependencies,overrides:manifest.overrides},null,2));
 await copyFile(join(consumer,'package.json'),join(evidence,'consumer-package.json'));
 const packed=JSON.parse(await run('pack','npm',['pack','--json','--pack-destination',join(root,'pack')],{cwd:repository}))[0];
 const archive=join(root,'pack',packed.filename);result.archive={filename:packed.filename,size:packed.size,unpackedSize:packed.unpackedSize,sha256:createHash('sha256').update(await readFile(archive)).digest('hex'),files:packed.files.map(f=>f.path)};
 await copyFile(archive,join(evidence,packed.filename));
 await run('install','npm',['install','--omit=dev','--no-audit','--no-fund',archive]);
 await copyFile(join(consumer,'package-lock.json'),join(evidence,'consumer-package-lock.json'));
 const installed=await realpath(join(consumer,'node_modules/dsh-crystra'));assert(installed.startsWith(consumer+'/'),'Package must be extracted, not a checkout symlink');
 await stat(join(installed,'src/backend/python/capability_bridge.py'));
 for(const part of ['home','xdg-config','xdg-data'])assert.deepEqual(await readdir(join(root,part)),[],part+' unexpectedly populated before startup');

 await writeFile(join(consumer,'imports.mjs'),`import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as b from 'dsh-crystra';import * as l from 'dsh-crystra/pi-ai-lifecycle';await assert.rejects(readFile(${JSON.stringify(join(repository,'package.json'))}),{code:'ERR_ACCESS_DENIED'});assert.equal(typeof b.apply,'function');assert.equal(typeof b.createCodeCapabilities,'function');console.log(JSON.stringify({backend:Object.keys(b),lifecycle:Object.keys(l),resolved:import.meta.resolve('dsh-crystra')}));`);
 await runtime('installed-exports',['imports.mjs']);
 const tests=['native-config.test.mjs','native-lifecycle.test.mjs','squidex-auth.test.mjs','barrier.test.mjs','barrier-call-identity.test.mjs','barrier-native-results.test.mjs','barrier-comparison-budget.test.mjs','consensus.test.mjs','controller.test.mjs','dsh.test.mjs','journal.test.mjs','managed-consensus.test.mjs','squidex-client.test.mjs','reflection.test.mjs','reflection-exit.test.mjs','crystallization.test.mjs','crystallization-dsh.test.mjs','code-capabilities.test.mjs'];
 const rewrites=[];
 async function copyTest(path){
  let source=await readFile(join(repository,path),'utf8');
  source=source.replace(/(['"])\.\.\/\.\.\/src\/backend\/([^'"]+)\1/g,(_all,q,name)=>{rewrites.push({path,name});return q+(name==='index.js'?'dsh-crystra':name==='dsh-pi-ai-lifecycle.js'?'dsh-crystra/pi-ai-lifecycle':'file://'+join(installed,'src/backend',name))+q;});
  source=source.replaceAll('crystra-squidex-trial-',project+'-');
  assert(!source.includes('../../src/backend/'),'Unrewritten checkout import in '+path);
  await mkdir(dirname(join(consumer,path)),{recursive:true});await writeFile(join(consumer,path),source);
 }
 project='crystra-clean-'+root.split('-').at(-1).toLowerCase();
 for(const name of tests)await copyTest('test/backend/'+name);
 for(const name of ['code-candidate.mjs','native-result-probe.mjs','reflection-exit-worker.mjs','consensus-crash-worker.mjs','consensus-dsh-worker.mjs'])await copyTest('test/fixtures/'+name);
 for(const name of ['squidex-fixture.mjs','squidex-managed.test.mjs'])await copyTest('test/integration/'+name);
 result.testAdaptations={policy:'Unchanged assertions; only backend imports redirected to installed package and destructive Docker targets renamed to this isolated project',rewrites};
 await runtime('installed-backend-tests',['--test',...tests.map(n=>'test/backend/'+n)]);
 // Fresh instance, unique project and newly created volumes; no pre-existing CMS data.
 compose=join(root,'squidex.compose.yml');
 const source=(await readFile(join(repository,'test/integration/squidex.compose.yml'),'utf8')).replace('name: crystra-squidex-trial','name: '+project).replaceAll('1946','2946').replace('172.30.194.0/28',process.env.CRYSTRA_CLEAN_SUBNET??'172.30.195.0/28');
 await writeFile(compose,source);await copyFile(compose,join(evidence,'squidex.compose.yml'));
 const names=await run('volumes-before','docker',['volume','ls','--format','{{.Name}}']);assert(!names.split('\n').some(n=>n.startsWith(project+'_')),'Fresh volumes required');
 await run('cms-start','docker-compose',['-f',compose,'up','-d','--wait']);
 const deadline=Date.now()+90000;while(true){try{const r=await fetch('http://127.0.0.1:2946/api/ping');if(r.ok)break;}catch{}if(Date.now()>deadline)throw Error('Fresh Squidex startup timeout');await new Promise(r=>setTimeout(r,1000));}
 await runtime('installed-squidex-tests',['--test','test/integration/squidex-managed.test.mjs'],{CRYSTRA_SQUIDEX_URL:'http://127.0.0.1:2946',CRYSTRA_SQUIDEX_REPORT:join(root,'squidex-results.json')});
 await copyFile(join(root,'squidex-results.json'),join(evidence,'squidex-results.json'));
 result.passed=true;
}catch(error){result.error=error.message;process.exitCode=1;console.error(error.message);}
finally{
 if(compose)try{await run('cms-cleanup','docker-compose',['-f',compose,'down','-v']);}catch(error){result.cleanupError=error.message;result.passed=false;process.exitCode=1;}
 await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,root,error:result.error}));
}
