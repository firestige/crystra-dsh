import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductSurface} from '../src/client/product-surface.js';
test('registers overlay and host brand, without a footer entry or replacing the Harness tree',()=>{
 const calls=[];
 const React={createElement:(type,props,...children)=>({type,props,children})};
 const Core={CrystraShell(){},Button(){}};
 const runtime=createProductSurface({React,Core,controller:{},renderAnalysis(){}});
 runtime.apply({slots:{inject(name,fn){calls.push(['inject',name]);fn();},register(def,render){calls.push(['register',def.name,render]);return()=>{};}}});
 assert.deepEqual(calls.filter(c=>c[0]==='register').map(c=>c[1]),['shell.overlay','sidebar.brand.mark']);
 assert.equal(calls.some(c=>c[1]==='root'||c[1]==='conversation'),false);
});
test('rejects an older UI dependency without the accepted Shell export',()=>{
 assert.throws(()=>createProductSurface({Core:{}}),/SHELL_COMPONENT_REQUIRED/);
});
test('mounts with the overlay props supplied by the host, without a child-slot renderer',()=>{
 const entries=new Map();
 const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},Button(){},BiSurface(){}};
 const controller={getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}};
 const runtime=createProductSurface({React,Core,controller,renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});
 const tree=entries.get('shell.overlay')({});
 assert.equal(tree.type,Core.BiSurface);
 assert.equal(tree.props['data-crystra-theme'],'dark');
 assert.equal(tree.props.className,'crystra-product-overlay');
 const shell=tree.children[1];
 shell.props.onOpenSettings();
 assert.equal(runtime.navigation.getSnapshot().surface,'harness');
});
test('new task keeps Crystra shell and exposes the dedicated native Input without creating a session',()=>{
 const entries=new Map();let cleared=0,created=0;
 const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},Button(){},BiSurface(){}};
 const controller={getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}};
 const runtime=createProductSurface({React,Core,controller,renderAnalysis(){}});
 runtime.apply({sessions:{clear(){assert.equal(runtime.navigation.getSnapshot().route.page,'new-task','leave Task binding before clearing current session');cleared++;}},workspaces:{startSession(){created++;}},slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});
 entries.get('shell.overlay')({}).children[1].props.onNewTask();
 assert.equal(created,0,'a blank draft must not create Session+Agent');
 assert.equal(cleared,1);
 assert.equal(runtime.navigation.getSnapshot().surface,'crystra');
 assert.equal(runtime.navigation.getSnapshot().route.page,'new-task');
 const next=entries.get('shell.overlay')({});
 assert.equal(next.props['data-crystra-native-input'],'hero');
});
test('sidebar preference survives a new surface without changing navigation or session state',()=>{
 const values=new Map([['crystra.sidebar.collapsed','true']]);const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 function mount(){const entries=new Map();const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const surface=createProductSurface({React,Core:{CrystraShell(){},Button(){},BiSurface(){}},controller:{getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}},renderAnalysis(){},storage});
 surface.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});
 return entries.get('shell.overlay')({}).children[1].props;}
 const first=mount();assert.equal(first.initialSidebarCollapsed,true);first.onSidebarCollapsedChange(false);
 assert.equal(mount().initialSidebarCollapsed,false);
 assert.equal(values.get('crystra.sidebar.collapsed'),'false');
});
test('Task Browser returns to its own saved view without placing it on Task context',()=>{
 const entries=new Map();const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},TaskBrowser(){},Button(){},BiSurface(){}};
 const runtime=createProductSurface({React,Core,controller:{getSnapshot:()=>({taskList:{phase:'ready',items:[]}}),subscribe(){}},renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});
 const Page=entries.get('shell.overlay')({}).children[1].children[0].type;
 const browser=Page();const saved='{"version":1,"view":"list"}';browser.props.onViewStateChange(saved);browser.props.onOpen('task-a');
 browser.props.onViewStateChange('late');assert.equal(runtime.navigation.getSnapshot().context.view,undefined);
 runtime.navigation.back();assert.equal(Page().props.initialViewState,saved);
});
test('Workflow directory uses the accepted component and explicitly distinguishes missing owner data',()=>{
 const entries=new Map();const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},WorkflowExplorer(){},Button(){},BiSurface(){}};
 const runtime=createProductSurface({React,Core,controller:{getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}},renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});
 runtime.navigation.navigate('workflows');const Page=entries.get('shell.overlay')({}).children[1].children[0].type;
 const tree=Page();assert.equal(tree.type,Core.WorkflowExplorer);assert.equal(tree.props.phase,'unavailable');assert.equal(tree.props.onNewWorkflow,undefined);
 tree.props.onOpen('definition-a','r2');assert.deepEqual(runtime.navigation.getSnapshot().route,{page:'workflow',id:'definition-a',revision:'r2'});
});
test('Workflow workbench retains the requested definition and revision with an unbound input',()=>{
 const entries=new Map();const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},WorkflowWorkbench(){},Button(){},BiSurface(){}};
 const runtime=createProductSurface({React,Core,controller:{getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}},renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});runtime.navigation.navigate('workflow','exact-definition','revision-a');
 const Page=entries.get('shell.overlay')({}).children[1].children[0].type;
 const first=Page();assert.equal(first.type,Core.WorkflowWorkbench);assert.equal(first.props.definitionId,'exact-definition');assert.equal(first.props.revision,'revision-a');assert.equal(first.props.page,'studio');
 first.props.onPageChange('resources');assert.equal(Page().props.page,'resources');assert.equal(entries.get('shell.overlay')({}).props['data-crystra-native-input'],undefined);
 runtime.navigation.saveContext({workbench:'invalid'});assert.equal(Page().props.page,'studio');
});
test('Workflow directory saves its view before exact navigation and ignores late view updates',()=>{
 const entries=new Map();const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},WorkflowExplorer(){},Button(){},BiSurface(){}};
 const runtime=createProductSurface({React,Core,controller:{getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}},renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});runtime.navigation.navigate('workflows');
 const Page=entries.get('shell.overlay')({}).children[1].children[0].type;const directory=Page();
 directory.props.onViewStateChange('saved');directory.props.onOpen('a','r1');directory.props.onViewStateChange('late');runtime.navigation.back();
 assert.equal(Page().props.initialViewState,'saved');
});
test('Workflow Input is exposed only for the exact active workflow revision',()=>{
 const entries=new Map();const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},WorkflowWorkbench(){},Button(){},BiSurface(){}};
 const workflowInput={subscribe(){},getSnapshot:()=>({kind:'active',definitionId:'a',revision:'r1',sessionId:'s'})};
 const runtime=createProductSurface({React,Core,workflowInput,controller:{getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}},renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});runtime.navigation.navigate('workflow','a','r1');
 const overlay=entries.get('shell.overlay')({});assert.equal(overlay.props['data-crystra-native-input'],'workflow');const Page=overlay.children[1].children[0].type;assert.equal(Page().props.input,null);
 runtime.navigation.navigate('workflow','a','r2');assert.equal(entries.get('shell.overlay')({}).props['data-crystra-native-input'],undefined);assert.notEqual(Page().props.input,null);
});
test('configured Workflow directory and exact panels revoke without retaining stale content',()=>{
 const entries=new Map();let enabled=true;
 const React={createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,snapshot)=>snapshot(),useEffect(){}};
 const Core={CrystraShell(){},WorkflowExplorer(){},WorkflowWorkbench(){},Button(){},BiSurface(){}};
 const wf={subscribe(){},getSnapshot:()=>enabled,directory:()=>({entries:enabled?[{definitionId:'wf',revision:'r1'}]:[],phase:'ready'}),select:(id,r)=>enabled&&id==='wf'&&r==='r1'?{title:'Exact',panels:{studio:'actual'}}:undefined};
 const runtime=createProductSurface({React,Core,workflowDrafts:wf,controller:{getSnapshot:()=>({taskList:{items:[]}}),subscribe(){}},renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){entries.set(def.name,render);}}});runtime.navigation.navigate('workflows');
 const shell=entries.get('shell.overlay')({}).children[1];assert.equal(shell.props.workflows[0].id,'wf');
 const Page=shell.children[0].type;assert.equal(Page().props.entries.length,1);
 runtime.navigation.navigate('workflow','wf','r1');assert.equal(Page().props.panels.studio,'actual');enabled=false;assert.notEqual(Page().props.panels.studio,'actual');
});

test('brand registration coexists with the native priority-zero brand and can restore it',()=>{
 const occupied=new Map([['sidebar.brand.mark',new Map([[0,'native']])]]);
 const runtime=createProductSurface({React:{},Core:{CrystraShell(){}},controller:{},renderAnalysis(){}});
 runtime.apply({slots:{inject(_,fn){fn();},register(def,render){
  const entries=occupied.get(def.name)??new Map(),priority=def.priority??0;
  assert.equal(entries.has(priority),false,'must not collide with the native brand registration');
  entries.set(priority,render);occupied.set(def.name,entries);return()=>entries.delete(priority);
 }}});
 const brand=occupied.get('sidebar.brand.mark');assert.equal(brand.get(0),'native');
 assert.ok(Math.min(...brand.keys())<0,'the product entry must shadow, not remove, the native brand');
});
