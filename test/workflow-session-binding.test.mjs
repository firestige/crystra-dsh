import test from 'node:test';import assert from 'node:assert/strict';
import {resolveWorkflowSessionBinding} from '../src/client/workflow-session-binding.js';
const identity={definitionId:'definition-a',revision:'r1'};
function fixture(){return {bindings:{state:'valid',authority:'draft',entries:[{...identity,workspaceId:'w1',packageRoot:'/private/tmp/package-a',sessionId:'s1'}]},workspaces:{phase:'ready',baselinesReady:true,items:[{workspaceId:'w1',path:'/private/tmp/package-a',sessionIds:['s1'] }],archivedSessionIds:[]},sessions:{phase:'ready',ids:['s1'],byId:{s1:{id:'s1'}}}};}
test('requires an exact definition/revision, current workspace path and local session membership',()=>{
 const f=fixture();const resolve=()=>resolveWorkflowSessionBinding(identity,f.bindings,f.workspaces,f.sessions);
 assert.equal(resolve().kind,'bound');f.bindings.entries[0].revision='r2';assert.equal(resolve().kind,'unbound');f.bindings.entries[0].revision='r1';
 f.workspaces.items[0].path='/other';assert.equal(resolve().kind,'unavailable');f.workspaces.items[0].path='/private/tmp/package-a';
 f.workspaces.items[0].sessionIds=[];assert.equal(resolve().kind,'unavailable');
});
test('does not select an ambiguous or archived binding and invalidates with its source',()=>{
 const f=fixture();const resolve=()=>resolveWorkflowSessionBinding(identity,f.bindings,f.workspaces,f.sessions);
 f.bindings.entries.push({...f.bindings.entries[0],sessionId:'foreign'});assert.equal(resolve().kind,'ambiguous');f.bindings.entries.pop();
 f.workspaces.archivedSessionIds=['s1'];assert.equal(resolve().kind,'unavailable');f.workspaces.archivedSessionIds=[];
 f.bindings.state='invalid';assert.equal(resolve().kind,'unavailable');
});
