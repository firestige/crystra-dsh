import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
const hash = (value) => createHash("sha256").update(value).digest("hex");
/** Host-owned discussion membership. Task/Plan files remain the fact authority. */
export function createTaskTopics({
  stateRoot,
  taskFor,
  projection,
  createSession,
  isRunning = () => false,
  firstMessage = () => undefined,
}) {
  const root = join(stateRoot, "task-topics"),
    tails = new Map();
  const file = (id) => join(root, hash(id) + ".json");
  async function load(task) {
    try {
      const state = JSON.parse(await readFile(file(task.taskId), "utf8"));
      if (
        state.schemaVersion !== "crystra.task-topics@1" ||
        state.taskId !== task.taskId ||
        state.rootSessionId !== task.sessionId
      )
        throw Error("TASK_TOPICS_INVALID");
      return state;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      return {
        schemaVersion: "crystra.task-topics@1",
        taskId: task.taskId,
        rootSessionId: task.sessionId,
        currentGroupId: null,
        activeGroupId: null,
        groups: [],
        topics: [],
      };
    }
  }
  async function save(state) {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const target = file(state.taskId),
      temp = target + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(state) + "\n", { mode: 0o600 });
    await rename(temp, target);
  }
  const serial = (id, fn) => {
    const next = (tails.get(id) || Promise.resolve()).then(fn),
      tail = next.catch(() => {});
    tails.set(id, tail);
    void tail.then(() => {
      if (tails.get(id) === tail) tails.delete(id);
    });
    return next;
  };
  async function sync(task, state) {
    const view = await projection(task);
    if (view.plan?.state === "invalid" && state.groups.length) return state;
    const revision = view.plan?.value?.revision ?? null,
      kind = view.plan?.value ? "plan" : "pre-plan";
    let group = state.groups.find(
      (g) => g.kind === kind && g.planRevision === revision,
    );
    if (!group) {
      group = {
        id: randomUUID(),
        kind,
        planRevision: revision,
        title:
          kind === "pre-plan"
            ? "需求与计划"
            : revision
              ? "Plan " + revision
              : "Plan 草稿",
        topicIds: [],
        selectedTopicId: null,
      };
      state.groups.push(group);
    }
    if (!state.topics.length) {
      const topic = {
        id: randomUUID(),
        sessionId: task.sessionId,
        title: "需求与计划",
        autoTitle: true,
        createdAt: new Date().toISOString(),
      };
      state.topics.push(topic);
      group.topicIds.push(topic.id);
      group.selectedTopicId = topic.id;
    }
    if (state.currentGroupId !== group.id) {
      const previous = state.groups.find((g) => g.id === state.activeGroupId);
      const topicId = previous?.selectedTopicId ?? state.topics[0].id;
      if (!group.topicIds.includes(topicId)) group.topicIds.push(topicId);
      group.selectedTopicId ??= topicId;
      state.currentGroupId = group.id;
      state.activeGroupId = group.id;
    }
    for (const topic of state.topics) {
      if (topic.autoTitle) {
        const message = await firstMessage(topic.sessionId);
        if (message?.trim()) {
          topic.title = Array.from(message.trim().replace(/\s+/g, " "))
            .slice(0, 48)
            .join("");
          topic.autoTitle = false;
        }
      }
    }
    return state;
  }
  const snapshot = (task, state) => {
    const group = state.groups.find((g) => g.id === state.activeGroupId),
      selected = state.topics.find((t) => t.id === group.selectedTopicId);
    return {
      taskId: task.taskId,
      workspacePath: task.workspacePath,
      workspaceId: task.workspaceId,
      group,
      currentGroup: state.groups.find((g) => g.id === state.currentGroupId),
      groups: state.groups.map(({ topicIds, ...g }) => ({
        ...g,
        count: topicIds.length,
      })),
      topics: state.topics.filter((t) => group.topicIds.includes(t.id)),
      selected,
      busy: state.topics.some((t) => isRunning(t.sessionId)),
    };
  };
  const withTask = (id, action) =>
    serial(id, async () => {
      const task = await taskFor(id),
        state = await load(task),
        before = JSON.stringify(state);
      await sync(task, state);
      await action?.(task, state);
      if (JSON.stringify(state) !== before) await save(state);
      return snapshot(task, state);
    });
  const idle = (state) => {
    if (state.topics.some((t) => isRunning(t.sessionId)))
      throw Error("TASK_TOPIC_BUSY");
  };
  return {
    read: (id) => withTask(id),
    create: (id, groupId) =>
      withTask(id, async (task, state) => {
        idle(state);
        const group = state.groups.find((g) => g.id === groupId);
        if (!group || groupId !== state.currentGroupId)
          throw Error("TOPIC_GROUP_CHANGED");
        const sessionId = "crystra-task-topic-" + randomUUID();
        const created = await createSession({
          sessionId,
          workspaceId: task.workspaceId,
        });
        if (created.sessionId !== sessionId)
          throw Error("TOPIC_SESSION_MISMATCH");
        const topic = {
          id: randomUUID(),
          sessionId,
          title: "新主题",
          autoTitle: true,
          createdAt: new Date().toISOString(),
        };
        state.topics.push(topic);
        group.topicIds.push(topic.id);
        group.selectedTopicId = topic.id;
        state.activeGroupId = groupId;
      }),
    select: (id, groupId, topicId) =>
      withTask(id, (_task, state) => {
        idle(state);
        const group = state.groups.find((g) => g.id === groupId);
        if (!group || !group.topicIds.includes(topicId))
          throw Error("TASK_TOPIC_UNKNOWN");
        group.selectedTopicId = topicId;
        state.activeGroupId = groupId;
      }),
    rename: (id, topicId, title) =>
      withTask(id, (_task, state) => {
        if (typeof title !== "string" || !title.trim() || title.length > 120)
          throw Error("TOPIC_TITLE_INVALID");
        const topic = state.topics.find((t) => t.id === topicId);
        if (!topic) throw Error("TASK_TOPIC_UNKNOWN");
        topic.title = title.trim();
        topic.autoTitle = false;
      }),
    async sessionIds(task) {
      return [
        ...new Set([
          task.sessionId,
          ...(await load(task)).topics.map((t) => t.sessionId),
        ]),
      ];
    },
    async binding(sessionId) {
      let files;
      try {
        files = await readdir(root);
      } catch (e) {
        if (e.code === "ENOENT") return;
        throw e;
      }
      for (const name of files.filter((f) => f.endsWith(".json"))) {
        const value = JSON.parse(await readFile(join(root, name), "utf8"));
        const topic = value.topics?.find((t) => t.sessionId === sessionId);
        if (!topic) continue;
        const task = await taskFor(value.taskId);
        const state = await load(task);
        const active = state.groups.find((g) => g.id === state.activeGroupId);
        return {
          ...task,
          sessionId,
          primarySessionId: task.sessionId,
          discussion: {
            topicId: topic.id,
            title: topic.title,
            groupId: active.id,
            planRevision: active.planRevision,
            active: active.selectedTopicId === topic.id,
          },
        };
      }
    },
    async selectedSession(task) {
      const state = await load(task),
        group = state.groups.find((g) => g.id === state.activeGroupId);
      return (
        state.topics.find((t) => t.id === group?.selectedTopicId)?.sessionId ??
        task.sessionId
      );
    },
  };
}
