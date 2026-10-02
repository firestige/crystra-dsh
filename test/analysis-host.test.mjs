import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysisLocation, analysisViewPath, analysisPeriodPath} from '../src/client/analysis/navigation.js';
test('analysis navigation preserves semantic source identity and host routing without bootstrap credentials',()=>{
 const href='http://127.0.0.1:3085/?token=secret#/analysis?view=traces&task_id=task-1&from_gate_id=gate-1&period=30d';
 assert.deepEqual(analysisLocation(href),{period:'30d',scope:'all',sourceContext:{task_id:'task-1',from_gate_id:'gate-1'}});
 const next=analysisViewPath(href,'reports');
 assert.equal(next,'/analysis?view=reports&task_id=task-1&from_gate_id=gate-1&period=30d');
 assert(!next.includes('secret'));
 assert.equal(analysisViewPath('http://localhost:3086/analysis?view=dashboard','traces'),'/analysis?view=traces');
});

test('formal analysis bundles from installed UI without fixture or dev dependencies',async()=>{
 const {build}=await import('esbuild');
 const result=await build({entryPoints:['src/client/analysis/host-analysis.tsx'],bundle:true,format:'esm',platform:'browser',jsx:'automatic',external:['react','react-dom','react/jsx-runtime'],loader:{'.css':'text'},write:false,metafile:true});
 const inputs=Object.keys(result.metafile.inputs);
 assert(inputs.some(path=>path.includes('node_modules/crystra-ui-core/dist/index.js')));
 assert(!inputs.some(path=>/test-harness|dev\/layout/.test(path)));
 const output=result.outputFiles[0].text;
 assert(!output.includes('delivery-0001'));
 assert(!output.includes('2026-09-09'));
});

test('host configuration outlives subscriptions and owns immutable accepted settings',async()=>{
 const {build}=await import('esbuild');
 const result=await build({entryPoints:['src/client/analysis/configuration-store.ts'],bundle:true,format:'esm',platform:'node',write:false});
 const {createAnalysisConfigurationStore}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const store=createAnalysisConfigurationStore();let notifications=0;
 const unsubscribe=store.subscribe(()=>notifications++);
 const settings=[{id:'s1',name:'已确认设置',charts:[]}];
 store.setSettings(settings);settings[0].name='外部突变';
 assert.equal(store.getSnapshot().settings[0].name,'已确认设置');assert.equal(notifications,1);
 unsubscribe();store.setSettings([{id:'s2',name:'离开页面后',charts:[]}]);
 assert.equal(notifications,1);assert.equal(store.getSnapshot().settings[0].id,'s2');
});

test('analysis host injects RPC transport and preserves service codes and abort signal',async()=>{
 const {build}=await import('esbuild');
 const result=await build({entryPoints:['src/client/analysis/transport.ts'],bundle:true,format:'esm',platform:'node',write:false});
 const {createAnalysisTransport}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const calls=[];const signal=new AbortController().signal;
 const api=createAnalysisTransport({call:async(...args)=>{calls.push(args);return {ok:true,value:{items:[]}};}});
 assert.deepEqual(await api.request('tasks/list',{limit:100},signal),{items:[]});
 assert.deepEqual(calls[0],['/crystra-studio','tasks/list',{limit:100},signal]);
 const failed=createAnalysisTransport({call:async()=>({ok:false,error:{code:'internal',message:'expired',details:{serviceCode:'CURSOR_EXPIRED'}}})});
 await assert.rejects(failed.request('tasks/list',{},signal),e=>e.code==='CURSOR_EXPIRED');
});

test('global period navigation preserves identity but drops Task scope outside Trace',()=>{
 const href='http://127.0.0.1:3085/?token=secret#/analysis?view=traces&scope=task-a&task_id=task-a&period=7d';
 assert(!analysisViewPath(href,'dashboard').includes('scope='));
 assert(analysisViewPath(href,'traces').includes('scope=task-a'));
 const next=analysisPeriodPath(href,'30d');
 assert(next.includes('period=30d'));assert(next.includes('task_id=task-a'));assert(!next.includes('secret'));
});

test('analysis configuration persists across stores and tolerates corrupt or unavailable localStorage',async()=>{
 const {build}=await import('esbuild');
 const result=await build({entryPoints:['src/client/analysis/configuration-store.ts'],bundle:true,format:'esm',platform:'node',write:false});
 const {createAnalysisConfigurationStore}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const first=createAnalysisConfigurationStore(storage);
 first.setSettings([{id:'saved',name:'持久设置',charts:[]}]);
 assert.equal(createAnalysisConfigurationStore(storage).getSnapshot().settings[0]?.id,'saved');
 assert.equal(values.size,1);
 storage.setItem([...values.keys()][0],'{broken');
 assert.deepEqual(createAnalysisConfigurationStore(storage).getSnapshot().settings,[]);
 const failed=createAnalysisConfigurationStore({getItem(){throw Error('denied');},setItem(){throw Error('quota');}});
 assert.doesNotThrow(()=>failed.setSettings([{id:'memory',name:'当前页面',charts:[]}]));
 assert.equal(failed.getSnapshot().settings[0].id,'memory');
 assert(failed.getSnapshot().storageError);
});
