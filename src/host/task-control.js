import { createTaskFlow } from "./task-flow.js";
import { createTaskPlanRuns } from "./task-plan-run.js";
import { createTaskControlRequests } from "./task-control-request.js";
export async function taskSourceMessages(ctx, sessionId) {
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
  return events.filter(e => e.type === "user/message" && e.data?.source?.kind === "user")
    .map(e => ({ id: e.data.id }));
}
/** Existing control owners composed against the 0.1.5 Session and Execution ports. */
export function createTaskControl({ ctx, stateRoot, admission, runtime }) {
  const enrolled = new Set();
  const tasks = { admit: (sessionId) => admission.admit(sessionId) };
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
    sourceMessagesForTask: task => taskSourceMessages(ctx, task.sessionId),
  });
  const runs = createTaskPlanRuns({ stateRoot, flow, runtime });
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
  return {
    ...control,
    async forSession(id) {
      return enrolled.has(id) ||
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
          enrolled.add(payload.sessionId);
          return { ok: true, value: await tasks.admit(payload.sessionId) };
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
