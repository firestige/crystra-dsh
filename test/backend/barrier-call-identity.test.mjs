// Regression for native DSH calls reusing textual IDs across steps.
import test from 'node:test';import assert from 'node:assert/strict';
import {captureNativeResults} from '../fixtures/native-result-probe.mjs';
import {compileCommitment,verifyCommitment} from '../../src/backend/barrier.js';
test('repeated native call ID must not let an earlier failed operation borrow a later successful result',{timeout:5000},async()=>{
  const evidence=await captureNativeResults([{callId:'reused',tool:'check',args:{suite:'first'},value:{exitCode:1}},{callId:'reused',tool:'check',args:{suite:'second'},value:{exitCode:0}}]);
  const goal=compileCommitment({label:'First suite must pass',actions:[{id:'first',kind:'result-equals',tool:'check',match:{suite:'first'},path:['exitCode'],equals:0}]},{sessionId:evidence.sessionId,seq:0,stepId:'s'},[]);
  assert.equal(verifyCommitment(goal,evidence,[]).decision,'NO_GO','A later result has the same textual call ID but sourceEventSeqs points to a different execution');
});
