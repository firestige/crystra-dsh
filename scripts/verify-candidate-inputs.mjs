#!/usr/bin/env node
import {resolve} from 'node:path';
import {verifyPublishedInputs} from './lib/published-inputs.mjs';
try {
 const services=await verifyPublishedInputs(resolve(import.meta.dirname,'..'),{cache:process.argv.includes('--cache')});
 console.log(JSON.stringify({status:'PASS',services}));
}catch(error){console.error(error.message);process.exitCode=1;}
