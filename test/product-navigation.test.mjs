import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductNavigation} from '../src/client/product-navigation.js';
test('keeps exact task and per-page return state through Harness and restoration',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const router=createProductNavigation(storage);
 router.navigate('task','task-2');router.saveContext({workbench:'plan',scrollTop:30});
 router.navigate('analysis-traces');router.openHarness();router.openCrystra();router.back();
 assert.equal(router.getSnapshot().route.id,'task-2');
 assert.deepEqual(router.getSnapshot().context,{workbench:'plan',scrollTop:30});
 const restored=createProductNavigation(storage);
 assert.deepEqual(restored.getSnapshot(),router.getSnapshot());
 assert.throws(()=>router.navigate('task'),/IDENTITY_REQUIRED/);
 assert.throws(()=>router.navigate('invalid'),/ROUTE_INVALID/);
});
test('invalid persisted navigation fails to a clean page and draft bodies are not persisted',()=>{
 const router=createProductNavigation({getItem:()=>'{broken',setItem(){}});
 assert.equal(router.getSnapshot().route.page,'tasks');
 assert.throws(()=>router.saveContext({draft:'private content'}),/CONTEXT_INVALID/);
});

test('workflow navigation requires and restores the exact revision',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const router=createProductNavigation(storage);
 assert.throws(()=>router.navigate('workflow','wf-1'),/REVISION_REQUIRED/);
 router.navigate('workflow','wf-1','revision-2');
 assert.equal(createProductNavigation(storage).getSnapshot().route.revision,'revision-2');
});
