import {nativeInputLayoutStyles} from './native-input-layout.js';
import {createProductNavigation} from './product-navigation.js';

/** Host bridge: the framework retains its conversation tree under the product surface. */
export function createProductSurface({React,Core,controller,renderAnalysis,storage,sharedStyles,taskInput,renderTaskPanels}) {
 if(typeof Core.CrystraShell!=='function')throw new Error('CRYSTRA_SHELL_COMPONENT_REQUIRED');
 const navigation=createProductNavigation(storage);
 let sidebarCollapsed=false;
 try{sidebarCollapsed=storage?.getItem("crystra.sidebar.collapsed")==="true";}catch{}
 const saveSidebar=collapsed=>{sidebarCollapsed=collapsed===true;try{storage?.setItem("crystra.sidebar.collapsed",String(sidebarCollapsed));}catch{}};
 const inactive=Object.freeze({kind:"inactive"});
 const inputSource=taskInput??{getSnapshot:()=>inactive,subscribe:()=>()=>{}};
 function Page(){
  const nav=React.useSyncExternalStore(navigation.subscribe,navigation.getSnapshot,navigation.getSnapshot);
  const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const input=React.useSyncExternalStore(inputSource.subscribe,inputSource.getSnapshot,inputSource.getSnapshot);
  if(nav.route.page==='task')return React.createElement(Core.TaskWorkbench,{
   title:nav.route.id,workspace:'Task',page:nav.context.workbench??'grilling',onPageChange:workbench=>navigation.saveContext({...nav.context,workbench}),
   input:input.taskId===nav.route.id&&input.kind==='active'?null:React.createElement('div',null,React.createElement('p',{role:'status'},input.kind==='ambiguous'?'此任务关联多个会话，请选择本实例中的会话。':input.kind==='unbound'?'此任务尚未关联当前实例的会话。':'当前无法确认此任务的会话关联。'),...(input.choices??[]).map(choice=>React.createElement(Core.Button,{key:choice.id,onClick:()=>taskInput?.selectSession(choice.id)},choice.label))),
   panels:{...Object.fromEntries(['grilling','plan','execution','gate','delivery'].map(page=>[page,React.createElement('p',{role:'status'},'该工作面的正式投影尚未接入。')])),...renderTaskPanels?.(nav.route.id)},
  });
  if(nav.route.page==='new-task')return null;
  if(nav.route.page.startsWith('analysis-'))return renderAnalysis(nav.route.page,navigation.navigate);
  if(nav.route.page==='tasks')return React.createElement(Core.Surface,{as:'section','data-section-id':'task-browser-content'},
   React.createElement(Core.Typography,{as:'h1',variant:'page-title'},'全部任务'),
   state.taskList.phase==='error'?React.createElement('p',{role:'alert'},state.taskList.error?.message):null,
   React.createElement(Core.Button,{onClick:()=>{void controller.loadTasks();}},'刷新'),
   React.createElement(Core.List,{size:'compact'},...state.taskList.items.map(task=>React.createElement(Core.ListItem,{
    key:task.task_id,primary:task.task_id,'data-object-id':task.task_id,onActivate:()=>navigation.navigate('task',task.task_id),
   }))),state.taskList.phase==='ready'&&state.taskList.items.length===0?React.createElement('p',{role:'status'},'暂无任务'):null);
  return React.createElement(Core.Surface,{as:'section'},
   React.createElement(Core.Typography,{as:'h1',variant:'page-title'},nav.route.page==='task'?'Task':'Workflow'),
   nav.route.id?React.createElement('p',null,nav.route.id):null,
   React.createElement('p',{role:'status'},'当前宿主尚未提供此工作面的数据接口。'),
   React.createElement(Core.Button,{onClick:()=>navigation.back()},'返回'));
 }
 return {navigation,
  apply(ctx){
   function Overlay(){
    const nav=React.useSyncExternalStore(navigation.subscribe,navigation.getSnapshot,navigation.getSnapshot);
    const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
    React.useEffect(()=>{void controller.loadTasks();},[]);
    const input=React.useSyncExternalStore(inputSource.subscribe,inputSource.getSnapshot,inputSource.getSnapshot);
    const nativeMode=nav.route.page==='new-task'?'hero':nav.route.page==='task'&&input.kind==='active'&&input.taskId===nav.route.id?'task':undefined;
    if(nav.surface==='harness')return null;
    return React.createElement(Core.BiSurface,{'data-crystra-product-overlay':true,'data-crystra-native-input':nativeMode,theme:'dark','data-crystra-theme':'dark',className:'crystra-product-overlay'},
     React.createElement('style',null,sharedStyles+nativeInputLayoutStyles+'\n.crystra-product-overlay{position:fixed;inset:0;pointer-events:auto;background:var(--color-background-shell);}'),
     React.createElement(Core.CrystraShell,{
      initialSidebarCollapsed:sidebarCollapsed,onSidebarCollapsedChange:saveSidebar,
      route:nav.route.page,selectedId:nav.route.id,tasks:state.taskList.items.map(t=>({id:t.task_id,title:t.task_id})),workflows:[],
      onNavigate:navigation.navigate,onOpenHarness:navigation.openHarness,
      onNewTask:()=>{navigation.navigate('new-task');ctx.sessions.clear();},
      onOpenSettings:navigation.openHarness,
     },React.createElement(Page)));
   }
   ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'crystra-product'},Overlay));
   ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'crystra-open-product'},
    ()=>React.createElement(Core.Button,{onClick:navigation.openCrystra},'Crystra')));
  },
 };
}
