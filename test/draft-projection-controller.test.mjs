import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftProjectionController} from '../src/client/draft-projection-controller.js';
const context={draftId:'crystra-ui-exploration',revision:'draft.1',sourceLockDigest:'a'.repeat(64),environment:'exploration',taskId:'a',goalRevision:'g',planRevision:null,accessAllowed:true,adapterId:'test',allowFixtures:true};
function snapshot(ctx,expiry=1000){
 const {accessAllowed,allowFixtures,...binding}=ctx;
 return {binding,provenance:'fixture',snapshotRevision:'s1',expiresAt:new Date(expiry).toISOString(),surfaces:Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(name=>[name,{state:'unavailable',reason:'missing'}]))};
}
function clock(){let time=0,seq=0;const timers=new Map();return {now:()=>time,setTimer:(fn,delay)=>{timers.set(++seq,{fn,at:time+delay});return seq;},clearTimer:id=>timers.delete(id),advance:ms=>{time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}}};}
test('expires visible content without another request and clears it immediately on access withdrawal',async()=>{
 const timer=clock();const ctl=createDraftProjectionController({read:async c=>snapshot(c),...timer});
 await ctl.setContext(context);assert.equal(ctl.getSnapshot().state,'valid');
 timer.advance(1000);assert.equal(ctl.getSnapshot().reason,'SNAPSHOT_EXPIRED');assert.equal('projection' in ctl.getSnapshot(),false);
 timer.advance(-1000);await ctl.setContext(context);assert.equal(ctl.getSnapshot().state,'valid');
 const update=ctl.setContext({...context,accessAllowed:false});assert.equal('projection' in ctl.getSnapshot(),false);await update;assert.equal(ctl.getSnapshot().reason,'ACCESS_REQUIRED');ctl.dispose();
});
test('late reads cannot revive a previous task or disposed controller',async()=>{
 const pending=[];const timer=clock();const ctl=createDraftProjectionController({read:c=>new Promise(resolve=>pending.push({c,resolve})),...timer});
 const first=ctl.setContext(context);const second=ctl.setContext({...context,taskId:'b'});
 pending[1].resolve(snapshot(pending[1].c));await second;assert.equal(ctl.getSnapshot().projection.binding.taskId,'b');
 pending[0].resolve(snapshot(pending[0].c));await first;assert.equal(ctl.getSnapshot().projection.binding.taskId,'b');
 const third=ctl.setContext(context);ctl.dispose();pending[2].resolve(snapshot(context));await third;assert.equal('projection' in ctl.getSnapshot(),false);
});
test('adapter cannot rewrite trusted context and failures discard prior content',async()=>{
 const timer=clock();let mode='valid';
 const ctl=createDraftProjectionController({read:async ctx=>{if(mode==='fail')throw Error('offline');if(mode==='mutate')ctx.taskId='foreign';return snapshot(ctx);},...timer});
 await ctl.setContext(context);assert.equal(ctl.getSnapshot().state,'valid');
 mode='mutate';await ctl.setContext(context);assert.equal(ctl.getSnapshot().state,'invalid');assert.equal(ctl.getSnapshot().reason,'BINDING_CHANGED');
 mode='fail';await ctl.setContext(context);assert.equal(ctl.getSnapshot().reason,'READ_FAILED');assert.equal('projection' in ctl.getSnapshot(),false);ctl.dispose();
});
