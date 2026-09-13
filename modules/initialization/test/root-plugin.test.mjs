import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createHostPlugin} from '../../../src/index.js';
test('empty root plugin registers one command; setup attaches Execution through the same command and disposes it',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'crystra-root-'));
 try {
  const commands=[],effects=[],modules=[];let executionStarts=0;
  const plugin=createHostPlugin({executionModule:{name:'execution',inject:[],async apply(ctx,config,hooks){executionStarts++;hooks.registerCommand({handler:async()=>({kind:'success',text:'delegated'})});}},studioModule:{name:'studio',inject:[],apply(){}}});
  const ctx={commands:{register(command){commands.push(command);return ()=>commands.splice(commands.indexOf(command),1);}},
   plugin(module,config){modules.push(module.name);return module.apply(ctx,config);},
   effect(effect){effects.push(effect);},
  };
  await plugin.apply(ctx,{stateRoot:root});
  assert.equal(commands.length,1);assert.equal(executionStarts,0);
  await commands[0].handler({rawInput:'setup',attachments:[]});
  assert.equal(commands.length,1);assert.equal(executionStarts,1);
  assert.equal((await commands[0].handler({rawInput:'list',attachments:[]})).text,'delegated');
  for(const effect of effects){for await(const cleanup of effect())await cleanup();}
  assert.equal(commands.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
