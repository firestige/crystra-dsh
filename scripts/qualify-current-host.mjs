#!/usr/bin/env node
// Real rc.2 host/browser and durable Task admission; localhost model protocol fixture.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {execFile,spawn,spawnSync} from 'node:child_process';
import {qualificationArchives} from './lib/qualification-artifacts.mjs';
import {repository,prepareProfile,assertSinglePlugin,dsh} from './lib/crystra-profile.mjs';
import {prepareExecutionConfiguration} from '../modules/initialization/src/host.js';
import {normalizePluginConfiguration} from '../modules/initialization/src/configuration.js';
import {createNativeTaskProtocolFixture} from './lib/native-task-protocol-fixture.mjs';
import {launchUrlFromLog} from './lib/host-auth-qualification.mjs';
const {chromium}=await import(process.env.CRYSTRA_PLAYWRIGHT_MODULE||'playwright');
const root=await realpath(await mkdtemp(join(tmpdir(),'crystra-current-host-')));
let host,browser,page,log='';
const requests=[],fixtureErrors=[];
const modelReply=createNativeTaskProtocolFixture();
const fixture=createServer(async(request,response)=>{
 if(request.url==='/models'){response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{id:'crystra-test-model'}]}));return;}
 if(request.url!=='/chat/completions'){response.writeHead(404).end();return;}
 let body='';for await(const chunk of request)body+=chunk;
 const input=JSON.parse(body);requests.push(input);
 let reply;try{reply=modelReply(input);}catch(error){fixtureErrors.push(error.message);response.writeHead(500).end(JSON.stringify({error:{message:error.message}}));return;}
 response.writeHead(200,{'content-type':'text/event-stream'});
 response.end(`data: ${JSON.stringify({choices:[{index:0,delta:reply.delta,finish_reason:null}]})}\n\ndata: ${JSON.stringify({choices:[{index:0,delta:{},finish_reason:reply.finish}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}})}\n\ndata: [DONE]\n\n`);
});
async function waitFor(read,label,timeout=60000){const end=Date.now()+timeout;while(Date.now()<end){const value=await read();if(value)return value;await new Promise(r=>setTimeout(r,200));}throw Error(label);}
async function stop(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
try{
 console.log('Packing current plugin and preparing isolated rc.2 profile');
 const [archive]=await qualificationArchives({root:repository,output:join(root,'artifacts')});
 const home=join(root,'home'),workspace=join(root,'workspace');await mkdir(workspace);
 const env={...await prepareProfile(home),DSH_TELEMETRY_DISABLED:'1'};
 await writeFile(join(home,'.credentials.yaml'),'version: 1\nrefs:\n  CRYSTRA_HOST_TEST_KEY: qualification-only\n',{mode:0o600});
 await new Promise(r=>fixture.listen(0,'127.0.0.1',r));
 const endpoint=`http://127.0.0.1:${fixture.address().port}`;
 const configuration=normalizePluginConfiguration({stateRoot:join(root,'state')});
 const profile=await prepareExecutionConfiguration(configuration);
 const execution=JSON.parse(await readFile(profile.configFile,'utf8'));
 execution.paths.repositoryRoot=workspace;execution.paths.workspaceRoot=workspace;execution.paths.allowedWorktreeRoots=[workspace];execution.observation.enabled=false;delete execution.observation.endpoint;
 await writeFile(profile.configFile,JSON.stringify(execution),{mode:0o600});
 env.DEEPSEEK_BASE_URL=endpoint;env.DEEPSEEK_API_KEY='qualification-only';
 const overlay=join(root,'host.patch.yml');
 await writeFile(overlay,`- id: llm-deepseek\n  config:\n    apiKeyEnv: CRYSTRA_HOST_TEST_KEY\n    baseURL: ${endpoint}\n    models:\n      - id: crystra-test-model\n        name: Crystra protocol fixture\n    thinking: disabled\n- id: agent-default-model\n  config:\n    provider: deepseek-official\n    model: crystra-test-model\n- id: session-title-llm\n  disabled: true\n- id: crystra\n  config:\n    stateRoot: ${JSON.stringify(join(root,'state'))}\n    execution:\n      configFile: ${JSON.stringify(profile.configFile)}\n      bindingFile: ${JSON.stringify(profile.bindingFile)}\n`);
 dsh(['plugin','--profile','web','add',archive,'--ignore-scripts'],env);
 const rebuild=spawnSync('pnpm',['rebuild','better-sqlite3'],{cwd:join(home,'profiles/web'),env,encoding:'utf8'});assert.equal(rebuild.status,0,'native dependency rebuild');
 await assertSinglePlugin(home,env);
 const probe=await promisify(execFile)(process.execPath,['--input-type=module','-e',`import {createDshAgentProviderFactory} from 'crystra-execution'; const models=await createDshAgentProviderFactory({stateDirectory:${JSON.stringify(join(root,'probe'))}}).listModels(); if(models.length!==1||models[0].model!=='crystra-test-model')throw Error('MODEL_CATALOG_MISMATCH');`],{cwd:join(home,'profiles/web'),env,encoding:'utf8',timeout:45000});
 assert.ok(!probe.stderr.includes('Error:'),'installed Execution DSH model discovery');
 const reserve=createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const origin=`http://127.0.0.1:${port}`;
 const startHost=async()=>{
  log='';host=spawn(env.CRYSTRA_DSH_BINARY||'dsh',['web','--patch',overlay,'--no-open','--host','127.0.0.1','--port',String(port)],{cwd:workspace,env,stdio:['ignore','pipe','pipe']});
  for(const stream of [host.stdout,host.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-131072);});
  return waitFor(()=>{if(host.exitCode!==null)throw Error('HOST_START_FAILED');return launchUrlFromLog(log,origin);},'HOST_LAUNCH_UNAVAILABLE');
 };
 const launch=await startHost();
 assert.equal((await fetch(origin)).status,401,'unauthenticated browser must be rejected');
 assert.equal((await fetch(`${origin}/api/workspace/create`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401,'unauthenticated RPC must be rejected');
 console.log('Host started; qualifying authenticated browser and Task admission');
 browser=await chromium.launch({headless:true,...(process.env.CRYSTRA_CHROME_BINARY?{executablePath:process.env.CRYSTRA_CHROME_BINARY}:{})});
 page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const navigation=await page.goto(launch);assert.equal(navigation.status(),200);assert.equal(new URL(page.url()).search,'');
 for(const name of ['Continue','Configure later']){const button=page.getByRole('button',{name,exact:true});if(await button.isVisible())await button.click();}
 const rpc=async(method,payload)=>page.evaluate(async({method,payload})=>{const rpcId=crypto.randomUUID();const response=await fetch(`/api/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId,method,payload})});const envelope=await response.json();if(!response.ok||envelope.rpcId!==rpcId||envelope.result?.ok!==true)throw Error(`RPC_FAILED ${method}: ${JSON.stringify(envelope.result)}`);return envelope.result.value;},{method,payload});
 assert.equal((await page.request.post(`${origin}/api/workspace/create`,{headers:{origin:'https://invalid.example'},data:{}})).status(),403,'foreign-origin RPC must be rejected');
 await rpc('workspace/create',{args:{request:{path:workspace}}});
 await page.locator('[data-section-id="new-task-action"]').click();
 const choose=page.getByRole('button',{name:/^(Choose workspace|选择工作区)$/});
 if(await choose.isVisible()){await choose.click();await page.getByText('workspace',{exact:true}).last().click();}
 const prompt=`本机 DSH 协议验收 ${randomUUID()}：中文需求和计划确认后，记录管控里程碑；不要修改产品代码或发布。`;
 const input=page.locator('[contenteditable=true]');await input.fill(prompt);await input.press('Enter');
 await page.waitForURL(/#\/tasks\/task-/);
 for(const question of ['确认以下需求并进入计划？','确认以下计划与绑定方案？']){
  await page.getByText(question,{exact:true}).waitFor();
  await page.getByText('确认此版本',{exact:true}).last().click();
  const submit=page.getByRole('button',{name:/^(Submit|提交|Send|发送)$/});
  if(await submit.isVisible())await submit.click();
 }
 await page.getByText('本地协议验收完成',{exact:true}).first().waitFor();
 const route=new URL(page.url()).hash,taskId=decodeURIComponent(route.split('/')[2]);
 const projection=await rpc('crystra-control/tasks/projection',{taskId});assert.equal(projection.taskId,taskId);assert.equal(projection.stage,'ready');assert.equal(projection.brief.confirmed,true);assert.equal(projection.plan.confirmed,true);assert.equal(projection.run.current.nodes.ready.state,'completed');
 for(const name of ['需求','计划','执行','审核','交付'])await page.getByRole('tab',{name:new RegExp(`^${name}`)}).click();
 assert.equal(await page.locator('.crystra-sidebar').count(),1);
 const refreshed=await page.reload();assert.equal(refreshed.status(),200);await page.getByText(prompt,{exact:true}).first().waitFor();assert.equal(new URL(page.url()).hash,route);
 assert.equal((await rpc('crystra-control/tasks/projection',{taskId})).taskId,taskId);
 console.log('Task persisted; restarting host and checking cookie/session recovery');
 await stop(host);await startHost();
 assert.equal((await page.reload()).status(),200);await page.getByText(prompt,{exact:true}).first().waitFor();
 assert.equal(new URL(page.url()).hash,route);
 const restored=await rpc('crystra-control/tasks/projection',{taskId});assert.equal(restored.taskId,taskId);assert.equal(restored.brief.digest,projection.brief.digest);assert.equal(restored.plan.digest,projection.plan.digest);assert.equal(restored.run.current.nodes.ready.state,'completed');
 const tasks=await rpc('crystra-tasks/list',{});assert.equal(tasks.items.filter(task=>task.id===taskId).length,1);assert.equal(tasks.items.find(task=>task.id===taskId).status,'执行阶段');assert.equal(tasks.items.find(task=>task.id===taskId).workspace,'workspace');
 assert.ok(requests.length>0);assert.ok(requests.every(request=>request.model==='crystra-test-model'));assert.deepEqual(errors,[]);assert.deepEqual(fixtureErrors,[]);
 console.log(JSON.stringify({qualification:'current-host-local-protocol',runtime:'0.1.5-rc.2',status:'PASS',checks:['unauthenticated-rejected','token-exchange','workspace-registration','task-admission','installed-execution-model-query','native-deepseek-protocol','native-task-document-tool','brief-human-confirmation','plan-human-confirmation','owner-control-receipt','confirmed-state-restart','task-projection','five-tabs','authenticated-reload','host-restart','single-durable-task','foreign-origin-rejected']},null,2));
}catch(error){
 // Do not emit launch tokens, signed cookies, model payloads, or user credentials.
 if(process.env.CRYSTRA_QUALIFY_DIAGNOSTICS && page)await page.screenshot({path:process.env.CRYSTRA_QUALIFY_DIAGNOSTICS+'.png'}).catch(()=>{});
 if(process.env.CRYSTRA_QUALIFY_DIAGNOSTICS)await writeFile(process.env.CRYSTRA_QUALIFY_DIAGNOSTICS,log.replace(/token=[A-Za-z0-9_-]+/gu,'token=[redacted]'),{mode:0o600});
 throw new Error(String(error.message).replace(/token=[A-Za-z0-9_-]+/gu,'token=[redacted]'));
}finally{await browser?.close();await stop(host);fixture.closeAllConnections();await new Promise(r=>fixture.close(r));await rm(root,{recursive:true,force:true});}
