import {randomUUID} from 'node:crypto';

const prefixes=Object.freeze({reflection:'crystra-reflection-',crystallization:'crystra-crystallization-eval-'});
export function internalAgentRole(sessionId){
 if(typeof sessionId!=='string')return null;
 return Object.keys(prefixes).find(role=>sessionId.startsWith(prefixes[role]))??null;
}
export function isInternalAgent(agent){return internalAgentRole(agent?.session?.id)!==null;}
export function internalSessionId(role){
 if(!Object.hasOwn(prefixes,role))throw new TypeError('Unknown internal agent role');
 return prefixes[role]+randomUUID();
}
