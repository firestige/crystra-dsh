import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createHostPlugin} from '../../../src/index.js';
test('empty root plugin registers one command; setup attaches Execution through the same command and disposes it',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'crystra-root-'));
 try {
  const commands=[],effects=[],modules=[];const gateways=new Map();let executionStarts=0;
  const plugin=createHostPlugin({executionModule:{name:'execution',inject:[],async apply(ctx,config,hooks){executionStarts++;hooks.registerCommand({handler:async()=>({kind:'success',text:'delegated'})});}},studioModule:{name:'studio',inject:[],apply(){}}});
  const ctx={inject(services, callback){if(services.includes('settings'))callback({settings:{register(){}}});},connection:{fetch:{register(route){gateways.set(route.path,route);return ()=>gateways.delete(route.path);}}},commands:{register(command){commands.push(command);return ()=>commands.splice(commands.indexOf(command),1);}},
   plugin(module,config){modules.push(module.name);return module.apply(ctx,config);},
   effect(effect){effects.push(effect);},
  };
  await plugin.apply(ctx,{stateRoot:root});
  assert.equal(commands.length,1);assert.equal(executionStarts,0);
  const response=await gateways.get("/api/crystra-workflows/list").fetch(new Request("http://localhost/api/crystra-workflows/list",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"client-request",rpcId:"test",method:"crystra-workflows/list",payload:{}})}));
  assert.equal((await response.json()).result.ok,false);
  await commands[0].handler({rawInput:'setup',attachments:[]});
  assert.equal(commands.length,1);assert.equal(executionStarts,1);
  assert.equal((await commands[0].handler({rawInput:'list',attachments:[]})).text,'delegated');
  for(const effect of effects){const cleanup=effect();if(typeof cleanup==="function")await cleanup();else for await(const stop of cleanup)await stop();}
  assert.equal(commands.length,0);assert.equal(gateways.size,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
