#!/usr/bin/env node
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {qualificationArchives} from './lib/qualification-artifacts.mjs';
import {repository,prepareProfile,assertSinglePlugin,dsh} from './lib/crystra-profile.mjs';
const temporary=await mkdtemp(join(tmpdir(),'crystra-lifecycle-'));
try {
 const [archive]=await qualificationArchives({root:repository,output:join(temporary,'artifacts')});
 const home=join(temporary,'home');
 const state=join(temporary,'persistent-state');await mkdir(state);
 const marker=join(state,'delivery-marker');await writeFile(marker,'preserve-user-state');
 const env=await prepareProfile(home);
 for(const operation of ['add','reload','reinstall']) {
  dsh(['plugin','--profile','web','add',archive,'--ignore-scripts'],env);
  await assertSinglePlugin(home,env);
  if(operation!=='reload') {
   dsh(['plugin','--profile','web','remove','dsh-crystra'],env);
   const dump=dsh(['--profile','web','--dump-config'],env);
   if(/\bid:\s*['"]?crystra['"]?\s*$/mu.test(dump)) throw new Error('PLUGIN_REMOVE_FAILED');
  }
  if(await readFile(marker,'utf8')!=='preserve-user-state') throw new Error('USER_STATE_CHANGED');
 }
 console.log(JSON.stringify({plugin:'dsh-crystra',add:'PASS',reload:'PASS',remove:'PASS',reinstall:'PASS',preserveState:'PASS'}));
} finally {await rm(temporary,{recursive:true,force:true});}
