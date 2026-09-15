import test from 'node:test';import assert from 'node:assert/strict';
import {attachWorkflowInputGeometry} from '../src/client/workflow-input-geometry.js';
test('tracks the outer Input rectangle and removes geometry on detach without moving native DOM',()=>{
 const values=new Map();let observer,disconnected=false;const events=new Map();
 const frame={style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
 const rect={left:64,top:88,width:400,height:632};const input={getBoundingClientRect:()=>rect};
 const doc={querySelector:s=>s.includes('input-stream')?input:frame};
 const win={addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 const stop=attachWorkflowInputGeometry({document:doc,window:win,ResizeObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){disconnected=true;}}});
 assert.equal(values.get('--crystra-workflow-input-width'),'400px');rect.width=516;observer();assert.equal(values.get('--crystra-workflow-input-width'),'516px');
 stop();assert.equal(values.size,0);assert.equal(disconnected,true);assert.equal(events.size,0);
});
