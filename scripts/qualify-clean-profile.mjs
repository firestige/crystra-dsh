#!/usr/bin/env node
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {qualificationArchives} from './lib/qualification-artifacts.mjs';
import {repository,prepareProfile,assertSinglePlugin,dsh} from './lib/crystra-profile.mjs';
const temporary=await mkdtemp(join(tmpdir(),'crystra-clean-profile-'));
try {
 const [archive]=await qualificationArchives({root:repository,output:join(temporary,'artifacts')});
 const home=join(temporary,'home');
 const env=await prepareProfile(home);
 dsh(['plugin','--profile','web','add',archive,'--ignore-scripts'],env);
 await assertSinglePlugin(home,env);
 console.log(JSON.stringify({plugin:'dsh-crystra',archives:1,profile:'web',status:'PASS'}));
} finally {await rm(temporary,{recursive:true,force:true});}
