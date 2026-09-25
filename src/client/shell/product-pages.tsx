import {useState, type ReactNode} from 'react';
import {AnalysisAuditPage, PageHeader, TaskDetailPage} from 'crystra-ui-core';
import type {Route} from '../navigation/routes.js';
import {useTasks} from '../tasks/use-tasks';
import {TasksFeedback, TaskBrowser} from '../tasks/task-views';
import {WorkflowExplorer, WorkflowStudio} from '../workflows/workflow-views';
import {HostTaskWorkbench} from '../task-workbench/host-task-workbench';
/** One page composition for both DSH and the dev host. Host injects native Chat only. */
export function ProductPages({route,chat,bench}:{route:Route;chat:ReactNode;bench:ReactNode}) {
 const tasks=useTasks();
 const [navigation,setNavigation]=useState<HTMLDivElement|null>(null);
 switch(route.page) {
  case 'tasks':return <TaskBrowser bench={bench}/>;
  case 'task':return <TaskDetailPage title={tasks.items.find(t=>t.id===route.taskId)?.title??'未解析任务'} description={route.taskId} navigation={<div ref={setNavigation}/>} context={<TasksFeedback state={tasks}/>} chat={chat} bench={<HostTaskWorkbench taskId={route.taskId} navigationContainer={navigation}/>}/>;
  case 'new-task':return <><PageHeader title="新建任务" description="描述你想完成的工作"/>{chat}</>;
  case 'workflows':return <WorkflowExplorer bench={bench}/>;
  case 'workflow':return <WorkflowStudio definitionId={route.definitionId} revision={route.revision??undefined} chat={chat} bench={bench}/>;
  case 'analysis':return <AnalysisAuditPage title={{dashboard:'总览',traces:'调用追踪',reports:'对比分析'}[route.view]} description="Analysis & Audit" bench={bench}/>;
  default:return <PageHeader title="页面不存在" description="请从侧栏选择页面"/>;
 }
}
