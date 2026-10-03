import {basename} from 'node:path';
import {taskListMetadata} from './task-list-metadata.js';
import {createTaskTopics} from './task-topics.js';
import { createTaskFlow } from "./task-flow.js";
import { createTaskPlanRuns } from "./task-plan-run.js";
import { createTaskControlRequests } from "./task-control-request.js";
async function sessionEvents(ctx, sessionId) {
  const session = ctx.sessions.get(sessionId);
  let events;
  if (session) events = session.ownEvents();
  else {
    const handle = await ctx.sessionPersistence.open(sessionId, "read");
    try {
      events = (await handle.read(handle.inheritedEventCount)).events;
    } finally {
      await handle.close();
    }
  }
  return events;
}
export async function taskSourceMessages(ctx, sessionId) {
  return (await sessionEvents(ctx,sessionId)).filter(e => e.type === "user/message" && e.data?.source?.kind === "user")
    .map(e => ({ id: e.data.id }));
}
/** Existing control owners composed against the 0.1.5 Session and Execution ports. */
export function createTaskControl({ ctx, stateRoot, admission, runtime }) {
  const enrolled = new Set();
  let topics;
  const tasks = { async admit(sessionId){const bound=await topics?.binding(sessionId);if(bound){if(!bound.discussion.active)throw Error('TASK_TOPIC_NOT_ACTIVE');const session=ctx.sessions.get(sessionId),workspace=ctx.workspaceRegistry.list().find(w=>w.id===bound.workspaceId&&w.sessionIds.includes(sessionId));if(!session||!workspace||session.header.cwd!==bound.workspacePath)throw Error('TASK_SESSION_UNAVAILABLE');return bound;}if(sessionId.startsWith('crystra-task-topic-'))throw Error('TASK_TOPIC_UNKNOWN');return admission.admit(sessionId);} };
  const flow = createTaskFlow({
    stateRoot,
    applyPlanBindings: async (task, value, digest) => {
      const owner = runtime();
      if (!owner?.saveRepositoryBindings)
        throw Error("EXECUTION_NOT_CONFIGURED");
      await owner.saveRepositoryBindings(
        task.workspacePath,
        value.roleBindings,
        digest,
      );
    },
    sourceMessagesForTask: async task => {const primary={...task,sessionId:task.primarySessionId??task.sessionId};return (await Promise.all((topics?await topics.sessionIds(primary):[task.sessionId]).map(id=>taskSourceMessages(ctx,id)))).flat();},
  });
  const runs = createTaskPlanRuns({ stateRoot, flow, runtime,
    activeAgentForTask:async task=>{const primary=await taskFor(task.taskId),id=await topics.selectedSession(primary);return ctx.agents?.roots().find(agent=>agent.session.id===id);}
  });
  const requests = createTaskControlRequests({ stateRoot, flow, runs });
  const updates = new Map(), reads = new Map();
  const serializeProjection = (task, action) => {
    const result = (reads.get(task.taskId) ?? Promise.resolve()).then(action);
    const tail = result.catch(() => {}); reads.set(task.taskId, tail);
    void tail.then(() => { if (reads.get(task.taskId) === tail) reads.delete(task.taskId); });
    return result;
  };
  async function loadProjection(task) {
    const value = await flow.read(task), run = await runs.read(task);
    return {...value, updating:false, run:run.current?.planDigest === value.plan.digest ? run : {...run,current:null}};
  }
  async function beginUpdate(task) {
    const update = await serializeProjection(task, async () => {
      let current = updates.get(task.taskId);
      if (!current) { current = {value:await loadProjection(task), writers:0}; updates.set(task.taskId,current); }
      current.writers++; return current;
    });
    let closed = false;
    return () => { if (closed) return; closed=true; if (--update.writers === 0) updates.delete(task.taskId); };
  }
  const control = { tasks, flow, runs, requests, execution: runtime, beginUpdate };
  async function taskFor(id) {
    const task = (await admission.bindings()).find((t) => t.taskId === id);
    if (!task) throw Error("CRYSTRA_TASK_UNAVAILABLE");
    return task;
  }
  topics=createTaskTopics({stateRoot,taskFor,projection:task=>serializeProjection(task,()=>updates.get(task.taskId)?.value??loadProjection(task)),createSession:request=>{if(!ctx.sessionController)throw Error('TOPIC_SESSION_SERVICE_UNAVAILABLE');return ctx.sessionController.create(request);},isRunning:id=>ctx.agents?.roots().some(agent=>agent.session?.id===id&&agent.status==='running')??false,firstMessage:id=>ctx.sessions.get(id)?.ownEvents().find(e=>e.type==='user/message'&&e.data?.source?.kind==='user')?.data.content?.filter(p=>p.type==='text').map(p=>p.text).join('\n')});
  return {
    ...control, topics,
    async listMetadata(ids) {
      const wanted=new Set(ids),rows=(await admission.bindings()).filter(t=>wanted.has(t.taskId));
      return Object.fromEntries(await Promise.all(rows.map(async task=>{
        try{
          const sessionId=await topics.selectedSession(task);
          const view=await serializeProjection(task,()=>updates.get(task.taskId)?.value??loadProjection(task));
          const events=await sessionEvents(ctx,sessionId);
          return [task.taskId,{...taskListMetadata({view,events}),workspacePath:task.workspacePath,workspace:basename(task.workspacePath)}];
        }catch{return [task.taskId,{status:'状态读取失败',attention:1}];}
      })));
    },
    async forSession(id) {
      if(id.startsWith("crystra-workflow-"))return undefined;
      return !!(await topics.binding(id)) || enrolled.has(id) ||
        (await admission.bindings()).some((t) => t.sessionId === id)
        ? control
        : undefined;
    },
    async handle(endpoint, payload) {
      try {
        if (!payload || typeof payload !== "object" || Array.isArray(payload))
          throw Error("INVALID_REQUEST");
        if (endpoint === "tasks/admit") {
          if (
            typeof payload.sessionId !== "string" ||
            !payload.sessionId ||
            Object.keys(payload).length !== 1
          )
            throw Error("INVALID_REQUEST");
          if(payload.sessionId.startsWith("crystra-workflow-"))throw Error("WORKFLOW_SESSION_CANNOT_ADMIT_TASK");
          enrolled.add(payload.sessionId);
          return { ok: true, value: await tasks.admit(payload.sessionId) };
        }
        if(endpoint.startsWith('topics/')){
          if(typeof payload.taskId!=='string'||!payload.taskId)throw Error('INVALID_REQUEST');
          const fields={'topics/read':['taskId'],'topics/create':['taskId','groupId'],'topics/select':['taskId','groupId','topicId'],'topics/rename':['taskId','topicId','title']}[endpoint];
          if(!fields||Object.keys(payload).length!==fields.length||fields.some(k=>typeof payload[k]!=='string'||!payload[k]))throw Error('INVALID_REQUEST');
          const value=endpoint==='topics/read'?await topics.read(payload.taskId):endpoint==='topics/create'?await topics.create(payload.taskId,payload.groupId):endpoint==='topics/select'?await topics.select(payload.taskId,payload.groupId,payload.topicId):await topics.rename(payload.taskId,payload.topicId,payload.title);
          return {ok:true,value};
        }
        const fields = {
          "tasks/bindings": [],
          "tasks/projection": ["taskId"],
          "tasks/select-gate": ["taskId", "planDigest", "gateId"],
          "tasks/artifact": [
            "taskId",
            "planDigest",
            "waveId",
            "resultIdentity",
            "artifactId",
          ],
        }[endpoint];
        if (
          !fields ||
          Object.keys(payload).length !== fields.length ||
          fields.some((k) => typeof payload[k] !== "string" || !payload[k])
        )
          throw Error("INVALID_REQUEST");
        if (endpoint === "tasks/bindings")
          return { ok: true, value: await admission.bindings() };
        const task = await taskFor(payload.taskId);
        if (endpoint === "tasks/projection") {
          return {ok:true, value:await serializeProjection(task, () => {
            const update = updates.get(task.taskId);
            return update ? {...update.value,updating:true} : loadProjection(task);
          })};
        }
        if (endpoint === "tasks/select-gate")
          return { ok: true, value: await runs.selectGate(task, payload) };
        if (endpoint === "tasks/artifact")
          return { ok: true, value: await runs.readArtifact(task, payload) };
        throw Error("INVALID_REQUEST");
      } catch (error) {
        return {
          ok: false,
          error: { code: error.message, message: error.message },
        };
      }
    },
  };
}
