import test from 'node:test';
import assert from 'node:assert/strict';
import {createTaskInputController} from '../src/client/task-input-controller.js';
const store=value=>{let snapshot=value;const listeners=new Set();return{getSnapshot:()=>snapshot,subscribe:f=>{listeners.add(f);return()=>listeners.delete(f);},set:v=>{snapshot=v;for(const f of listeners)f();}};};
const inv=(task,id)=>({kind:'ready',snapshot:{schemaVersion:'execution.delivery-control-plane@1.0.0',generation:1,deliveries:[{deliveryId:'d',task:{identity:task,displayName:null},lifecycle:'BOUND',detached:false,recoverable:false,navigation:{sessionCorrelation:id}}]}});
function fixture(){const inventory=store({kind:'loading'});const list=store({phase:'ready',ids:['s1','s2'],byId:{s1:{id:'s1'},s2:{id:'s2'}}});const opened=[];const sessions={list,open:id=>{opened.push(id);list.set({...list.getSnapshot(),current:id});}};return{inventory,list,opened,controller:createTaskInputController({inventory,sessions})};}
test('opens an exact local binding and only exposes Input after current confirms it',()=>{const f=fixture();f.controller.setTask('t1');assert.equal(f.controller.getSnapshot().kind,'unavailable');f.inventory.set(inv('t1','s1'));assert.deepEqual(f.opened,['s1']);assert.equal(f.controller.getSnapshot().kind,'active');assert.equal(f.controller.getSnapshot().sessionId,'s1');f.controller.dispose();});
test('late results for a previous Task cannot reopen its session',()=>{const f=fixture();f.controller.setTask('t1');f.controller.setTask('t2');f.inventory.set(inv('t1','s1'));assert.deepEqual(f.opened,[]);f.inventory.set(inv('t2','s2'));assert.deepEqual(f.opened,['s2']);f.controller.setTask(undefined);f.inventory.set(inv('t1','s1'));assert.equal(f.controller.getSnapshot().kind,'inactive');assert.deepEqual(f.opened,['s2']);f.controller.dispose();});
test('losing membership immediately hides Input without creating a replacement',()=>{const f=fixture();f.inventory.set(inv('t1','s1'));f.controller.setTask('t1');f.list.set({phase:'ready',ids:[],byId:{},current:'s1'});assert.equal(f.controller.getSnapshot().kind,'unavailable');assert.deepEqual(f.opened,['s1']);f.controller.dispose();});
test('ambiguous bindings expose only local choices and require explicit selection',()=>{const f=fixture();const state=inv('t','s1');state.snapshot.deliveries.push({...state.snapshot.deliveries[0],deliveryId:'d2',navigation:{sessionCorrelation:'foreign'}});f.inventory.set(state);f.controller.setTask('t');assert.deepEqual(f.opened,[]);assert.deepEqual(f.controller.getSnapshot().choices,[{id:'s1',label:'s1'}]);f.controller.selectSession('foreign');assert.deepEqual(f.opened,[]);f.controller.selectSession('s1');assert.deepEqual(f.opened,['s1']);assert.equal(f.controller.getSnapshot().kind,'active');f.controller.dispose();});
test('an admitted draft opens only its explicit local session and yields to an owner Task',()=>{
 const inventory=store({kind:'loading'}),list=store({phase:'ready',ids:['s1'],byId:{s1:{id:'s1'}}});
 const drafts=store({state:'valid',ownerTaskIds:[],knownTaskIds:['t1'],entries:[{taskId:'t1',workspaceId:'w1',packageRoot:'/private/tmp/task-draft',sessionId:'s1'}]});
 const workspaces={list:store({phase:'ready',baselinesReady:true,items:[{workspaceId:'w1',path:'/private/tmp/task-draft',sessionIds:['s1']}],archivedSessionIds:[]})};
 const opened=[];const controller=createTaskInputController({inventory,drafts,workspaces,sessions:{list,open:id=>{opened.push(id);list.set({...list.getSnapshot(),current:id});}}});
 controller.setTask('t1');assert.equal(controller.getSnapshot().kind,'active');assert.equal(controller.getSnapshot().authority,'draft');assert.deepEqual(opened,['s1']);
 workspaces.list.set({...workspaces.list.getSnapshot(),archivedSessionIds:['s1']});assert.equal(controller.getSnapshot().kind,'unavailable');
 workspaces.list.set({...workspaces.list.getSnapshot(),archivedSessionIds:[]});assert.equal(controller.getSnapshot().kind,'active');
 drafts.set({...drafts.getSnapshot(),state:'invalid'});assert.equal(controller.getSnapshot().kind,'unavailable');
 drafts.set({...drafts.getSnapshot(),state:'valid',entries:[]});assert.equal(controller.getSnapshot().kind,'unbound');
 drafts.set({...drafts.getSnapshot(),ownerTaskIds:['t1']});assert.equal(controller.getSnapshot().kind,'unavailable');
 controller.dispose();
});
