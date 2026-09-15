import test from 'node:test';
import assert from 'node:assert/strict';
import {bindHostBanner} from '../src/client/host-banner.js';
function button(kind='brand') {
 const node=new EventTarget(), attrs=new Map([['aria-label','New session']]);
 node.matches=selector=>selector===`button.hHd-Xa_${kind}`;
 node.getAttribute=name=>attrs.get(name)??null;
 node.setAttribute=(name,value)=>attrs.set(name,value);
 node.removeAttribute=name=>attrs.delete(name);
 return node;
}
test('banner switches once and prevents the native new-session click; disposal restores it',()=>{
 const b=button();let opened=0,created=0;
 const stop=bindHostBanner(b,()=>opened++);
 b.addEventListener('click',()=>created++);
 const click=new Event('click',{cancelable:true});b.dispatchEvent(click);
 assert.equal(opened,1);assert.equal(created,0);assert.equal(click.defaultPrevented,true);
 assert.equal(b.getAttribute('aria-label'),'进入 Crystra');
 stop();b.dispatchEvent(new Event('click'));
 assert.equal(opened,1);assert.equal(created,1);assert.equal(b.getAttribute('aria-label'),'New session');
});
test('collapsed toggle remains owned by the host and only expands',()=>{
 const b=button('toggle');let opened=0,expanded=0;
 const stop=bindHostBanner(b,()=>opened++);b.addEventListener('click',()=>expanded++);
 b.dispatchEvent(new Event('click'));assert.equal(opened,0);assert.equal(expanded,1);stop();
});
test('unknown host DOM is rejected rather than intercepting an unrelated button',()=>{
 assert.throws(()=>bindHostBanner(button('unknown'),()=>{}),/HOST_BANNER_LAYOUT_UNSUPPORTED/);
});
