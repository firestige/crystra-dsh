import test from 'node:test';import assert from 'node:assert/strict';
import {admitResourceRelations,createResourceRelationsRenderer} from '../src/client/workflow-resource-relations.js';
const source={root:'/package',version:'v1',files:[{path:'a.md',content:'A',internal:false,truncated:false},{path:'b.md',content:'B',internal:false,truncated:false}],nodes:[{id:'file:a.md',label:'A',kind:'file',file:'a.md'},{id:'file:b.md',label:'B',kind:'file',file:'b.md'}],edges:[{from:'file:a.md',to:'file:b.md',label:'references'}]};
test('relations require closed node/file references and exact snapshot bytes after candidate saves',()=>{
 const current={...source,files:source.files.map(f=>({...f,revision:'s1'}))};assert.equal(admitResourceRelations(source,current,'s1'),true);
 for(const mutate of [s=>s.edges[0].to='foreign',s=>s.nodes.push(s.nodes[0]),s=>s.nodes[0].file='outside',s=>s.nodes[0].kind='unknown']){const bad=structuredClone(source);mutate(bad);assert.equal(admitResourceRelations(bad,current,'s1'),false);}
 assert.equal(admitResourceRelations(source,{...current,files:current.files.map(f=>f.path==='a.md'?{...f,content:'Changed',revision:'candidate1'}:f)},'s1'),false);
});
test('retained graph navigation cannot open undeclared files or act after source revocation',()=>{
 let live=true,opened;
 const render=createResourceRelationsRenderer({React:{createElement:(type,props,...children)=>({type,props,children})},Core:{ResourceRelationGraph:'graph'},source,workspace:source,snapshotRevision:'s1',isCurrent:()=>live,catalog:[{id:'a',path:'a.md',files:[{path:'a.md'}]},{id:'b',path:'b.md',files:[{path:'b.md'}]}]});
 const view=render({selection:{resourceId:'a',path:'a.md'},onOpenFile:p=>opened=p});assert.equal(view.type,'graph');view.props.onOpenFile('outside');assert.equal(opened,undefined);view.props.onOpenFile('b.md');assert.equal(opened,'b.md');live=false;opened=undefined;view.props.onOpenFile('a.md');assert.equal(opened,undefined);
});
test('a candidate saved while a graph is open immediately invalidates retained file actions',()=>{
 let current=structuredClone(source),opened;
 const render=createResourceRelationsRenderer({React:{createElement:(type,props,...children)=>({type,props,children})},Core:{ResourceRelationGraph:'graph'},source,getWorkspace:()=>current,snapshotRevision:'s1',isCurrent:()=>true,catalog:[{id:'a',path:'a.md',files:[{path:'a.md'},{path:'b.md'}]}]});
 const view=render({selection:{resourceId:'a',path:'a.md'},onOpenFile:p=>opened=p});
 current.files[1]={...current.files[1],content:'Changed',revision:'candidate1'};view.props.onOpenFile('b.md');assert.equal(opened,undefined);
 assert.equal(render({selection:{resourceId:'a',path:'a.md'},onOpenFile:()=>{}}).props.role,'status');
});
test('cyclic intermediary expansion is rejected before graph projection',()=>{
 const unsafe={...source,nodes:[...source.nodes,{id:'r1',label:'r1',kind:'resource'},{id:'r2',label:'r2',kind:'resource'}],edges:[...source.edges,{from:'r1',to:'r2',label:'ref'},{from:'r2',to:'r1',label:'ref'}]};
 assert.equal(admitResourceRelations(unsafe,source,'s1'),false);
});

test('malformed rendering metadata and duplicate current files never reach the graph',()=>{
 const cases=[s=>s.files[0].displayName={},s=>s.files[0].presentation={id:'cli',type:'cli',renderer:'markdown',name:'CLI',members:['foreign'],aliases:[]},s=>s.nodes[0].typeLabel={}];
 for(const mutate of cases){const bad=structuredClone(source);mutate(bad);assert.equal(admitResourceRelations(bad,source,'s1'),false);}
 assert.equal(admitResourceRelations(source,{...source,files:[source.files[0],source.files[0]]},'s1'),false);
});

test('malformed source file rows fail closed without throwing',()=>{
 for(const row of [null,undefined,42])assert.equal(admitResourceRelations({...source,files:[row,source.files[1]]},source,'s1'),false);
});
