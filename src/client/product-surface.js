import {installNativeSessionHeader} from './native-session-header.js';
import {attachWorkflowInputGeometry} from "./workflow-input-geometry.js";
import {projectEvidenceTasks} from './task-browser-projection.js';
import {nativeInputLayoutStyles} from './native-input-layout.js';
import {createProductNavigation} from './product-navigation.js';

/** Host bridge: the framework retains its conversation tree under the product surface. */
export function createProductSurface({React,Core,controller,renderAnalysis,storage,sharedStyles,taskInput,renderTaskPanels,workflowInput,workflowDrafts}) {
 if(typeof Core.CrystraShell!=='function')throw new Error('CRYSTRA_SHELL_COMPONENT_REQUIRED');
 const navigation=createProductNavigation(storage);
 let clearSession=()=>{};
 const newTask=()=>{navigation.navigate("new-task");clearSession();};
 const saveBrowserView=view=>{const nav=navigation.getSnapshot();if(nav.route.page==='tasks')navigation.saveContext({...nav.context,view});};
 const saveWorkflowView=view=>{const nav=navigation.getSnapshot();if(nav.route.page==='workflows')navigation.saveContext({...nav.context,view});};
 let sidebarCollapsed=false;
 try{sidebarCollapsed=storage?.getItem("crystra.sidebar.collapsed")==="true";}catch{}
 const saveSidebar=collapsed=>{sidebarCollapsed=collapsed===true;try{storage?.setItem("crystra.sidebar.collapsed",String(sidebarCollapsed));}catch{}};
 const inactive=Object.freeze({kind:"inactive"});
 const inputSource=taskInput??{getSnapshot:()=>inactive,subscribe:()=>()=>{}};
 const workflowSource=workflowInput??{getSnapshot:()=>inactive,subscribe:()=>()=>{}};
 const emptyWorkflows=Object.freeze({phase:'unavailable',workflows:[]});
 const draftWorkflows=workflowDrafts??{subscribe:()=>()=>{},getSnapshot:()=>emptyWorkflows,directory:()=>({entries:[],phase:'unavailable'}),select:()=>undefined};
 const activeWorkflow=(nav,input)=>nav.route.page==='workflow'&&input.kind==='active'&&input.definitionId===nav.route.id&&input.revision===nav.route.revision;
 function Page(){
  const nav=React.useSyncExternalStore(navigation.subscribe,navigation.getSnapshot,navigation.getSnapshot);
  const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const input=React.useSyncExternalStore(inputSource.subscribe,inputSource.getSnapshot,inputSource.getSnapshot);
  const workflow=React.useSyncExternalStore(workflowSource.subscribe,workflowSource.getSnapshot,workflowSource.getSnapshot);
  React.useSyncExternalStore(draftWorkflows.subscribe,draftWorkflows.getSnapshot,draftWorkflows.getSnapshot);
  const selectedWorkflow=draftWorkflows.select(nav.route.id,nav.route.revision);
  if(nav.route.page==='task')return React.createElement(Core.TaskWorkbench,{
   title:nav.route.id,workspace:'Task',page:nav.context.workbench??'grilling',onPageChange:workbench=>navigation.saveContext({...nav.context,workbench}),
   input:input.taskId===nav.route.id&&input.kind==='active'?null:React.createElement('div',null,React.createElement('p',{role:'status'},input.kind==='ambiguous'?'此任务关联多个会话，请选择本实例中的会话。':input.kind==='unbound'?'此任务尚未关联当前实例的会话。':'当前无法确认此任务的会话关联。'),...(input.choices??[]).map(choice=>React.createElement(Core.Button,{key:choice.id,onClick:()=>taskInput?.selectSession(choice.id)},choice.label))),
   panels:{...Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(page=>[page,React.createElement('p',{role:'status'},'该工作面的正式投影尚未接入。')])),...renderTaskPanels?.(nav.route.id)},
  });
  if(nav.route.page==='workflows')return React.createElement(Core.WorkflowExplorer,{...draftWorkflows.directory(),initialViewState:typeof nav.context.view==='string'?nav.context.view:undefined,onViewStateChange:saveWorkflowView,onOpen:(id,revision)=>navigation.navigate('workflow',id,revision)});
  if(nav.route.page==='workflow')return React.createElement(Core.WorkflowWorkbench,{
   key:JSON.stringify([nav.route.id,nav.route.revision]),definitionId:nav.route.id,revision:nav.route.revision,title:selectedWorkflow?.title??nav.route.id,description:selectedWorkflow?.description??'工作流定义尚未解析',
   page:['studio','resources','crystallization'].includes(nav.context.workbench)?nav.context.workbench:'studio',onPageChange:workbench=>navigation.saveContext({...nav.context,workbench}),
   input:activeWorkflow(nav,workflow)?null:React.createElement('p',{role:'status'},'此工作流尚未关联当前实例中的包工作区与会话。'),
   panels:selectedWorkflow?.panels??Object.fromEntries(['studio','resources','crystallization'].map(page=>[page,React.createElement('p',{role:'status'},'此工作面的精确版本投影尚未接入。')])),
  });
  if(nav.route.page==='new-task')return null;
  if(nav.route.page.startsWith('analysis-'))return renderAnalysis(nav.route.page,navigation.navigate);
  if(nav.route.page==='tasks')return React.createElement(Core.TaskBrowser,{
   initialViewState:typeof nav.context.view==='string'?nav.context.view:undefined,onViewStateChange:saveBrowserView,
   tasks:projectEvidenceTasks(state.taskList.items),phase:state.taskList.phase==='idle'?'loading':state.taskList.phase,error:state.taskList.error?.message,
   onOpen:id=>navigation.navigate('task',id),onNewTask:newTask,onRefresh:()=>{void controller.loadTasks();},
   hasMore:typeof state.taskList.page?.next_cursor==='string'&&state.taskList.page.next_cursor.length>0,
   onLoadMore:()=>{const cursor=controller.getSnapshot().taskList.page?.next_cursor;if(cursor)void controller.loadTasks(cursor);},
  });
  return React.createElement(Core.Surface,{as:'section'},
   React.createElement(Core.Typography,{as:'h1',variant:'page-title'},nav.route.page==='task'?'Task':'Workflow'),
   nav.route.id?React.createElement('p',null,nav.route.id):null,
   React.createElement('p',{role:'status'},'当前宿主尚未提供此工作面的数据接口。'),
   React.createElement(Core.Button,{onClick:()=>navigation.back()},'返回'));
 }
 return {navigation,
  apply(ctx){
   clearSession=()=>ctx.sessions.clear();
   const headerTarget={
    getSnapshot(){const nav=navigation.getSnapshot();if(nav.surface!=='crystra')return undefined;
     const workflow=workflowSource.getSnapshot(),input=inputSource.getSnapshot();
     if(activeWorkflow(nav,workflow))return workflow.sessionId;
     if(nav.route.page==='task'&&input.kind==='active'&&input.taskId===nav.route.id)return input.sessionId;
     return undefined;
    },
    subscribe(fn){const stops=[navigation.subscribe(fn),inputSource.subscribe(fn),workflowSource.subscribe(fn)];return()=>stops.forEach(stop=>stop());},
   };
   function Overlay(){
    React.useEffect(()=>installNativeSessionHeader({React,slots:ctx.slots,target:headerTarget}),[]);
    const nav=React.useSyncExternalStore(navigation.subscribe,navigation.getSnapshot,navigation.getSnapshot);
    const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
    React.useEffect(()=>{void controller.loadTasks();},[]);
    const input=React.useSyncExternalStore(inputSource.subscribe,inputSource.getSnapshot,inputSource.getSnapshot);
    const workflow=React.useSyncExternalStore(workflowSource.subscribe,workflowSource.getSnapshot,workflowSource.getSnapshot);
    const nativeMode=activeWorkflow(nav,workflow)?'workflow':nav.route.page==='new-task'?'hero':nav.route.page==='task'&&input.kind==='active'&&input.taskId===nav.route.id?'task':undefined;
    React.useEffect(()=>{if(nav.surface!=='crystra'||nativeMode!=='workflow')return;return attachWorkflowInputGeometry({document,window,ResizeObserver:window.ResizeObserver});},[nativeMode,nav.surface,nav.route.id,nav.route.revision]);
    React.useSyncExternalStore(draftWorkflows.subscribe,draftWorkflows.getSnapshot,draftWorkflows.getSnapshot);
    if(nav.surface==='harness')return null;
    return React.createElement(Core.BiSurface,{'data-crystra-product-overlay':true,'data-crystra-native-input':nativeMode,theme:'dark','data-crystra-theme':'dark',className:'crystra-product-overlay'},
     React.createElement('style',null,sharedStyles+nativeInputLayoutStyles+'\n.crystra-product-overlay{position:fixed;inset:0;pointer-events:auto;background:var(--color-background-shell);}'),
     React.createElement(Core.CrystraShell,{
      initialSidebarCollapsed:sidebarCollapsed,onSidebarCollapsedChange:saveSidebar,
      route:nav.route.page,selectedId:nav.route.id,tasks:projectEvidenceTasks(state.taskList.items),workflows:draftWorkflows.directory().entries.map(entry=>({id:entry.definitionId,title:entry.title,revision:entry.revision})),
      onNavigate:navigation.navigate,onOpenHarness:navigation.openHarness,
      onNewTask:newTask,
      onOpenSettings:navigation.openHarness,
     },React.createElement(Page)));
   }
   ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'crystra-product'},Overlay));
   ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'crystra-open-product'},
    ()=>React.createElement(Core.Button,{onClick:navigation.openCrystra},'Crystra')));
  },
 };
}
