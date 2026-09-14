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
