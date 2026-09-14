import test from 'node:test';
import assert from 'node:assert/strict';
import {installNativeSessionHeader} from '../src/client/native-session-header.js';
function source(value){const listeners=new Set();return {getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(next){value=next;for(const fn of [...listeners])fn();}};}
function setup(){
 const target=source(undefined),changes=new Set();const store={};const original={store,options:{priority:0}};let entries=[original];const registrations=[];
 const slots={inject(_,fn){return fn();},entries:()=>entries,subscribe(_,fn){changes.add(fn);return()=>changes.delete(fn);},register(options,component){const entry={store:options.store,options,component};entries.push(entry);registrations.push(entry);return()=>{entries=entries.filter(e=>e!==entry);};}};
 const React={useStore(){},useLayoutEffect(fn){fn();},createElement:(type,props,...children)=>({type,props,children})};
 const stop=installNativeSessionHeader({React,slots,target});return {target,slots,original,registrations,stop,changes};
}
test('header shadows only during an exact native Input binding and restores the original occupant',()=>{
 const f=setup();assert.equal(f.registrations.length,0);f.target.set('s1');assert.equal(f.registrations.length,1);
 const entry=f.registrations[0];assert.equal(entry.store,f.original.store);assert.equal(entry.options.priority,-1);assert.equal(entry.options.children,undefined);
 f.target.set('s2');assert.equal(f.registrations.length,1);f.target.set(undefined);assert.deepEqual(f.slots.entries(),[f.original]);
 f.target.set('s1');f.stop();assert.deepEqual(f.slots.entries(),[f.original]);assert.equal(f.changes.size,0);
});
test('entering a bound session selects chat while a later native drilldown offers a return action',()=>{
 const f=setup();f.target.set('s1');const Header=f.registrations[0].component;const writes=[];
 const props={sessionId:'s1',useStore:fn=>fn({view:'delivery'}),actions:{setView:v=>writes.push(v)}};
 const result=Header(props);assert.deepEqual(writes,['chat']);assert.equal(result.children[0],'返回对话');result.props.onClick();assert.deepEqual(writes,['chat','chat']);
 Header({...props,sessionId:'foreign'});assert.deepEqual(writes,['chat','chat']);f.stop();
});
