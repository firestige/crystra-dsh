import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {composeSidebarBanner} from '../scripts/lib/sidebar-banner-fork.mjs';
const source=await readFile(new URL('../node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js',import.meta.url),'utf8');
test('native expanded banner replaces Session creation with surface switching',()=>{
 const patched=composeSidebarBanner(source);
 const action=patched.match(/className: clsx\(SidebarRoot_module_css_default.brand,[\s\S]*?onClick: \(\) => \{([\s\S]*?)\n\s*\},/)[1];
 let switched=0,created=0;
 vm.runInNewContext(`(()=>{${action}})()`,{collapsed:false,onSwitchSurface:()=>switched++,startSession:()=>created++});
 assert.equal(switched,1);assert.equal(created,0);
 let expanded=0;
 vm.runInNewContext(`(()=>{${action}})()`,{collapsed:true,toggleSidebar:()=>expanded++,onSwitchSurface:()=>switched++,startSession:()=>created++});
 assert.equal(expanded,1);assert.equal(switched,1);assert.equal(created,0);
 // The distinct New Session control and collapsed brand expansion remain upstream.
 const independent=source.slice(source.indexOf('className: clsx(SidebarRoot_module_css_default.newSession,'));
 assert.ok(independent.length>0);assert.ok(patched.endsWith(independent));
});
test('an upstream banner seam change stops the build instead of silently breaking switching',()=>{
 assert.throws(()=>composeSidebarBanner(source.replace('function SidebarRoot({','function ChangedSidebarRoot({')),/SIDEBAR_BANNER_UPSTREAM_DRIFT/);
});
