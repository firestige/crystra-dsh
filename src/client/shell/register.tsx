import {DiscussionTopicBar,Button} from "crystra-ui-core";
import {useTaskTopics} from "../topics/use-task-topics";
import {useWorkflowSession} from "../workflows/use-workflow-session";
import {workflowSessionReady} from "../workflows/workflow-session-policy.js";
import {createScope} from "@deepseek-ai/dsh-api-session-controller/client";
import {TaskControlContext} from '../task-workbench/task-control-context';
import {ProductPages} from "./product-pages";
import * as sidebarUi from "@deepseek-ai/dsh-client-ui-sidebar";
import { createSurfaceModeStore } from "./surface-mode";
import * as conversationUi from "@deepseek-ai/dsh-client-ui-conversation";
import { resolveTaskSession } from "./session-binding.js";
import React, { useState, useSyncExternalStore, useEffect } from "react";
import { Sidebar } from "../sidebar/sidebar";
import { defaultSidebarPreferences } from "../sidebar/model";
import { projectSidebar } from "../navigation/sidebar-model.js";
import { navigate, useRoute } from "../navigation/use-route";
import { createExecutionTasksApi } from "../tasks/execution-tasks-api";
import { createTasksResource, createTasksStore } from "../tasks/tasks-resource";
import { TasksProvider } from "../tasks/tasks-provider";
import { useTasks } from "../tasks/use-tasks";
import { TasksFeedback } from "../tasks/task-views";
import { createWorkflowsApi } from "../workflows/workflows-api";
import {
  createWorkflowsResource,
  createWorkflowsStore,
} from "../workflows/workflows-resource";
import { WorkflowsProvider } from "../workflows/workflows-provider";
import { useWorkflows } from "../workflows/use-workflows";
import { WorkflowsFeedback } from "../workflows/workflow-views";
import { SettingsDialog } from "../settings/settings-dialog";
import { WorkbenchContext } from "../task-workbench/workbench-context";
import { createWorkbenchStore } from "../task-workbench/workbench-store";
import sidebarCss from "../sidebar/sidebar.css";
import settingsCss from "../settings/settings.css";
import shellCss from "./shell.css";

/** Native DSH transport adapter. Owner APIs retain their logical resource channels. */
export function productRpc(rpc: any) {
  return {
    call: (
      channel: string,
      endpoint: string,
      payload: Record<string, unknown>,
      signal?: AbortSignal,
    ) => rpc.call("/api", `${channel.slice(1)}/${endpoint}`, payload, signal),
  };
}
const AdmissionReady=React.createContext(true);
const analysis = [
  { id: "dashboard", title: "总览", icon: "table" },
  { id: "traces", title: "调用追踪", icon: "activity" },
  { id: "reports", title: "对比分析", icon: "arrows-exchange" },
] as const;

export function registerProductShell(ctx: any, controlPlane: any) {
  const rpc = productRpc(ctx.connection.rpc);
  const tasks = createTasksResource(
    createExecutionTasksApi(rpc),
    createTasksStore().create(),
  );
  const workflows = createWorkflowsResource(
    createWorkflowsApi(rpc),
    createWorkflowsStore().create(),
  );
  const workbench = createWorkbenchStore().create();
  const surfaceMode = createSurfaceModeStore();
  const show = (surface: "crystra" | "harness") => {
    surfaceMode.actions.show(surface);
    ctx.layout.selectPanel("conversation");
  };
  function useSurface() {
    return useSyncExternalStore(
      surfaceMode.subscribe,
      surfaceMode.getSnapshot,
      surfaceMode.getSnapshot,
    ).surface;
  }
  ctx.effect(
    () => () => {
      tasks.dispose();
      workflows.dispose();
    },
    "Crystra product resources",
  );
  const style = document.createElement("style");
  style.dataset.crystraProduct = "";
  style.textContent = [sidebarCss, settingsCss, shellCss].join("\n");
  document.head.append(style);
  ctx.effect(() => () => style.remove(), "Crystra product styles");
  const go = (href: string) => {
    if(href === "/tasks/new") ctx.sessions.clear();
    navigate(href,true);
    ctx.layout.selectPanel("conversation");
  };
  function Providers({ children }: { children: React.ReactNode }) {
    return (
      <TasksProvider resource={tasks}>
        <WorkflowsProvider resource={workflows}>
          <WorkbenchContext.Provider value={workbench}><TaskControlContext.Provider value={rpc}>
            {children}
          </TaskControlContext.Provider></WorkbenchContext.Provider>
        </WorkflowsProvider>
      </TasksProvider>
    );
  }
  function ProductSidebar(props: any) {
    const taskState = useTasks();
    const workflowState = useWorkflows();
    const route = useRoute();
    const [preferences, setPreferences] = useState(defaultSidebarPreferences);
    const [settings, setSettings] = useState(false);
    const links = projectSidebar(
      { tasks: taskState.items, workflows: workflowState.items, analysis },
      route,
    );
    return (
      <div
        className="crystra-bi crystra-product-sidebar"
        data-crystra-theme="dark"
      >
        <Sidebar
          {...links}
          preferences={{ ...preferences, collapsed: props.collapsed }}
          onPreferencesChange={(next) => {
            setPreferences(next);
            if (next.collapsed !== props.collapsed) ctx.layout.toggleSidebar();
          }}
          tasksReady={taskState.phase === "ready"}
          workflowsReady={workflowState.phase === "ready"}
          taskFeedback={<TasksFeedback state={taskState} />}
          workflowFeedback={<WorkflowsFeedback state={workflowState} />}
          onNavigate={go}
          onNewTask={() => go("/tasks/new")}
          onOpenHarness={() => show("harness")}
          onOpenSettings={() => setSettings(true)}
        />
        {settings && (
          <SettingsDialog
            rpc={rpc}
            onClose={() => setSettings(false)}
            onSaved={() => void workflowState.actions.refresh()}
          />
        )}
      </div>
    );
  }
  function ProductMain(props: any) {
    const route = useRoute();
    const taskState = useTasks();
    const sessions = props.useSessions((state: any) => state.byId);
    const inventory = useSyncExternalStore(
      controlPlane.inventory.subscribe,
      controlPlane.inventory.getSnapshot,
      controlPlane.inventory.getSnapshot,
    ) as any;
    const task =
      route.page === "task"
        ? taskState.items.find((item) => item.id === route.taskId)
        : undefined;
    const [bindings,setBindings]=useState<any[]>([]);
    const [admissionError,setAdmissionError]=useState<string>();
    const [preparedSession,setPreparedSession]=useState<string>();
    const taskTopics=useTaskTopics(task?.id,rpc,ctx.sessions);
    const sessionId = route.page==='task'?taskTopics.snapshot?.selected.sessionId:resolveTaskSession(task?.id, inventory, sessions, bindings);
    const selectedSessionId = props.useSessions((state: any) => state.current);
    const workflowSession=useWorkflowSession(route.page==='workflow'?route.definitionId:undefined,rpc,ctx.sessions);
    const isolatedWorkflowReady=route.page==='workflow'&&workflowSessionReady(route.definitionId,workflowSession.binding,selectedSessionId);
    useEffect(()=>{if(route.page==='workflow'&&workflowSession.binding?.sessionId&&selectedSessionId!==workflowSession.binding.sessionId)ctx.sessions.open(workflowSession.binding.sessionId);},[route.page,workflowSession.binding?.sessionId,selectedSessionId]);

    useEffect(()=>{
      let cancelled=false;let timer:ReturnType<typeof setTimeout>;
      async function poll(){
       try {
        const result=await rpc.call('/crystra-control','tasks/bindings',{});
        if(!result.ok)throw Error(result.error?.message??'Task 绑定读取失败');
        if(!cancelled)setBindings(result.value);
        if(route.page==='new-task'&&selectedSessionId){
         const answer=await rpc.call('/crystra-control','tasks/admit',{sessionId:selectedSessionId});
         if(!answer.ok)throw Error(answer.error?.message??'Task 创建失败');
         if(!cancelled)setPreparedSession(selectedSessionId);
         if(!cancelled&&answer.value){
          setBindings(rows=>[...rows.filter(r=>r.taskId!==answer.value.taskId),answer.value]);
          await taskState.actions.refresh();
          if(!cancelled)go('/tasks/'+encodeURIComponent(answer.value.taskId));
         }
        }
        if(!cancelled)setAdmissionError(undefined);
       }catch(error){if(!cancelled)setAdmissionError(error instanceof Error?error.message:'Task 创建失败');}
       if(!cancelled)timer=setTimeout(poll,1000);
      }
      void poll();return ()=>{cancelled=true;clearTimeout(timer);};
    },[route.page,selectedSessionId]);
    useEffect(() => {
      if (sessionId) ctx.sessions.open(sessionId);
    }, [sessionId]);
    const nativeChat = () => props.renderSlot("main.conversation", {});
    const content=route.page==='workflow'&&!isolatedWorkflowReady
      ? <div role="status" className="crystra-product-empty">{workflowSession.error||'正在打开独立工作流会话…'}{workflowSession.error&&<button onClick={workflowSession.retry}>重试</button>}</div>
      : route.page==='task'  && (!sessionId || selectedSessionId!==sessionId)
      ? <p role="status" className="crystra-product-empty">{taskTopics.error||"正在恢复当前主题…"}<Button onClick={taskTopics.retry}>重试</Button></p>
      : nativeChat();
    const discussion=route.page==='workflow'?workflowSession:taskTopics;
    const topicSnapshot=discussion.snapshot;
    const topicBar=(route.page==='task'||route.page==='workflow')&&topicSnapshot?<DiscussionTopicBar group={topicSnapshot.group} groups={topicSnapshot.groups} topics={topicSnapshot.topics} selectedId={topicSnapshot.selected.id} busy={discussion.pending||topicSnapshot.busy} historical={topicSnapshot.group.id!==topicSnapshot.currentGroup.id} onSelect={id=>{void discussion.select(id).catch(()=>{});}} onSelectGroup={id=>{void discussion.selectGroup(id).catch(()=>{});}} onNew={()=>{void discussion.create().catch(()=>{});}} onRename={discussion.rename}/>:null;
    const chat=<>{topicBar}{discussion.error&&topicSnapshot&&<p role="alert" className="crystra-product-empty">{discussion.error}<Button onClick={discussion.retry}>重试</Button></p>}{admissionError&&<p role="alert" className="crystra-product-empty">任务创建暂未完成：{admissionError}</p>}{content}</>;
    const page=<ProductPages route={route} chat={chat} onWorkflowQuote={(text)=>{if(!isolatedWorkflowReady||!workflowSession.binding)throw Error("工作流独立会话尚未就绪");const scope=createScope(ctx,workflowSession.binding!.sessionId);try{ctx.conversation.input.for(scope.ctx).setDraft(text);}finally{scope.fiber.dispose();}}} onNavigate={go} hostRoot bench={<section data-section-id="control-workspace" aria-label="Bench" className="crystra-product-empty">Bench</section>}/>;
    return (
      <div
        className="crystra-bi crystra-product-main"
        data-crystra-theme="dark"
        data-page={route.page}
      >
        <AdmissionReady.Provider value={route.page!=="new-task"||!selectedSessionId||preparedSession===selectedSessionId}>{page}</AdmissionReady.Provider>
      </div>
    );
  }
  const sidebarClient = sidebarUi as unknown as {
    inject: string[];
    apply(ctx: unknown): void;
  };
  ctx.inject(sidebarClient.inject, (inner: any) => {
    const slots = new Proxy(inner.slots, {
      get(target, property) {
        if (property === "register")
          return (definition: any, Component: React.ComponentType<any>) => {
            function SidebarSurface(props: any) {
              return useSurface() === "harness" ? (
                <Component {...props} onSwitchSurface={() => show("crystra")} />
              ) : (
                <Providers>
                  <ProductSidebar {...props} />
                </Providers>
              );
            }
            return target.register(
              definition,
              definition.name === "sidebar" ? SidebarSurface : Component,
            );
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    sidebarClient.apply(
      new Proxy(inner, {
        get(target, property) {
          return property === "slots" ? slots : Reflect.get(target, property);
        },
      }),
    );
  });
  const conversationClient = conversationUi as unknown as {
    inject: string[];
    apply(ctx: unknown): void;
  };
  ctx.inject(conversationClient.inject, (inner: any) => {
    const slots = new Proxy(inner.slots, {
      get(target, property) {
        if (property === "register")
          return (definition: any, component: any) => {
            if(definition.name==='main.conversation') {
              const NativeRoot=component;
              return target.register(definition,function ConversationSurface(props:any){
                const product=useSurface()==='crystra';
                const ready=React.useContext(AdmissionReady);
                return <NativeRoot {...props} crystraSurface={product} renderSlot={(name:string,...args:any[])=>product&&name==='conversation.session.header'?null:props.renderSlot(name,...(product&&!ready&&name==='conversation.composer.bar'?[{...args[0],disabled:true},...args.slice(1)]:args))}/>;
              });
            }
            return target.register(
              definition,
              definition.name === "main" && definition.key === "conversation"
                ? function MainSurface(props: any) {
                    const NativeMain = component;
                    return useSurface() === "harness" ? (
                      <NativeMain {...props} />
                    ) : (
                      <Providers>
                        <ProductMain {...props} />
                      </Providers>
                    );
                  }
                : component,
            );
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    conversationClient.apply(
      new Proxy(inner, {
        get(target, property) {
          return property === "slots" ? slots : Reflect.get(target, property);
        },
      }),
    );
    ctx.layout.selectPanel("conversation");
  });
  // Product routing selects a keyed main panel; the host retains its single React root.
  const select = () => ctx.layout.selectPanel("conversation");
  window.addEventListener("popstate", select);
  ctx.effect(
    () => () => window.removeEventListener("popstate", select),
    "Crystra navigation",
  );
}
