// Compatibility entry for host-shaped fixtures and standalone native probes.
import {verifyCommitment as verify,splitCommitment as split} from './barrier.js';
import {extractExecutionFacts} from './dsh-evidence.js';
export {compileCommitment,COMPARISON_LIMITS} from './barrier.js';
export const verifyCommitment=(goal,evidence,references)=>verify(goal,extractExecutionFacts(evidence,{after:goal?.declarationSeq??0}),references);
export const splitCommitment=(goal,proposal,evidence,references)=>split(goal,proposal,extractExecutionFacts(evidence,{after:goal?.declarationSeq??0}),references);
