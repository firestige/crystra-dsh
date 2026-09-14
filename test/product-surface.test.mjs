import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductSurface} from '../src/client/product-surface.js';
test('registers only additive overlay and return entry, retaining the Harness tree',()=>{
 const calls=[];
 const React={createElement:(type,props,...children)=>({type,props,children})};
 const Core={CrystraShell(){},Button(){}};
 const runtime=createProductSurface({React,Core,controller:{},renderAnalysis(){}});
 runtime.apply({slots:{inject(name,fn){calls.push(['inject',name]);fn();},register(def,render){calls.push(['register',def.name,render]);return()=>{};}}});
 assert.deepEqual(calls.filter(c=>c[0]==='register').map(c=>c[1]),['shell.overlay','sidebar.footer.action']);
 const open=calls.find(c=>c[1]==='sidebar.footer.action'&&c[0]==='register')[2]();
 runtime.navigation.openHarness();open.props.onClick();
 assert.equal(runtime.navigation.getSnapshot().surface,'crystra');
 assert.equal(calls.some(c=>c[1]==='root'||c[1]==='conversation'),false);
});
test('rejects an older UI dependency without the accepted Shell export',()=>{
 assert.throws(()=>createProductSurface({Core:{}}),/SHELL_COMPONENT_REQUIRED/);
});
