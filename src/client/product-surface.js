import {createProductNavigation} from './product-navigation.js';

/** Host bridge: the framework retains its conversation tree under the product surface. */
export function createProductSurface({React,Core,controller,renderAnalysis,storage,sharedStyles}) {
 if(typeof Core.CrystraShell!=='function')throw new Error('CRYSTRA_SHELL_COMPONENT_REQUIRED');
 const navigation=createProductNavigation(storage);
 function Page(){
  const nav=React.useSyncExternalStore(navigation.subscribe,navigation.getSnapshot,navigation.getSnapshot);
  const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
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
    if(nav.surface==='harness')return null;
    return React.createElement(Core.BiSurface,{'data-crystra-product-overlay':true,theme:'dark','data-crystra-theme':'dark',className:'crystra-product-overlay'},
     React.createElement('style',null,sharedStyles+'\n.crystra-product-overlay{position:fixed;inset:0;pointer-events:auto;background:var(--color-background-shell);}'),
     React.createElement(Core.CrystraShell,{
      route:nav.route.page,selectedId:nav.route.id,tasks:state.taskList.items.map(t=>({id:t.task_id,title:t.task_id})),workflows:[],
      onNavigate:navigation.navigate,onOpenHarness:navigation.openHarness,
      onNewTask:()=>{navigation.openHarness();ctx.sessions.clear();},
      onOpenSettings:navigation.openHarness,
     },React.createElement(Page)));
   }
   ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'crystra-product'},Overlay));
   ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'crystra-open-product'},
    ()=>React.createElement(Core.Button,{onClick:navigation.openCrystra},'Crystra')));
  },
 };
}
