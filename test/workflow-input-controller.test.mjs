import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkflowInputController} from '../src/client/workflow-input-controller.js';
const store=value=>{const listeners=new Set();return {getSnapshot:()=>value,subscribe:f=>{listeners.add(f);return()=>listeners.delete(f);},set:next=>{value=next;for(const f of listeners)f();}}};
test('opens only exact local package session and hides Input when workspace membership is revoked',()=>{
 const identity={definitionId:'a',revision:'r1'};
 const bindings=store({state:'valid',entries:[{...identity,workspaceId:'w',packageRoot:'/package',sessionId:'s'}]});
 const workspaces={list:store({phase:'ready',baselinesReady:true,items:[{workspaceId:'w',path:'/package',sessionIds:['s']}],archivedSessionIds:[]})};
 const opened=[];const sessions={list:store({phase:'ready',ids:['s'],byId:{s:{id:'s'}}}),open:id=>{opened.push(id);sessions.list.set({...sessions.list.getSnapshot(),current:id});}};
 const ctl=createWorkflowInputController({bindings,workspaces,sessions});ctl.setWorkflow(identity);assert.equal(ctl.getSnapshot().kind,'active');assert.deepEqual(opened,['s']);
 ctl.setWorkflow({...identity,revision:'r2'});assert.equal(ctl.getSnapshot().kind,'unbound');assert.deepEqual(opened,['s']);
 ctl.setWorkflow(identity);workspaces.list.set({...workspaces.list.getSnapshot(),items:[]});assert.equal(ctl.getSnapshot().kind,'unavailable');
 ctl.setWorkflow(undefined);assert.equal(ctl.getSnapshot().kind,'inactive');ctl.dispose();
});
