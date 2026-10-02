import { createTemporaryDirectory } from "./support/temporary-directory.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { createTaskTopics } from "../src/host/task-topics.js";
test("topics retain Task identity, group by semantic Plan revision, persist selection and never copy history", async (t) => {
  const root = await createTemporaryDirectory("task-topics-");
  t.after(() => rm(root, { recursive: true, force: true }));
  const task = {
    taskId: "task-test",
    sessionId: "original",
    workspaceId: "workspace",
    workspacePath: "/workspace",
  };
  let revision,
    created = [],
    running = false;
  const options = {
    stateRoot: root,
    taskFor: async (id) => {
      if (id !== task.taskId) throw Error("missing");
      return task;
    },
    projection: async () => ({
      plan: revision
        ? { value: { revision }, digest: "digest-" + revision }
        : { state: "missing" },
    }),
    createSession: async (r) => {
      created.push(r);
      return { sessionId: r.sessionId };
    },
    isRunning: () => running,
  };
  let api = createTaskTopics(options);
  let first = await api.read(task.taskId);
  assert.equal(first.selected.sessionId, "original");
  assert.equal(created.length, 0);
  const next = await api.create(task.taskId, first.group.id);
  assert.notEqual(next.selected.sessionId, "original");
  assert.equal(created[0].workspaceId, "workspace");
  assert.equal(created[0].fork, undefined);
  assert.equal(
    (await api.binding(next.selected.sessionId)).taskId,
    task.taskId,
  );
  assert.equal(
    (await api.binding(next.selected.sessionId)).sessionId,
    next.selected.sessionId,
  );
  revision = "v1";
  const versioned = await api.read(task.taskId);
  assert.equal(versioned.group.planRevision, "v1");
  assert.equal(versioned.selected.sessionId, next.selected.sessionId);
  api = createTaskTopics(options);
  assert.equal((await api.read(task.taskId)).selected.id, next.selected.id);
  running = true;
  await assert.rejects(
    api.select(task.taskId, versioned.group.id, first.selected.id),
    /BUSY/,
  );
  running = false;
  await assert.rejects(
    api.select(task.taskId, versioned.group.id, "unrelated"),
    /TOPIC/,
  );
  assert.deepEqual(
    new Set(await api.sessionIds(task)),
    new Set(["original", next.selected.sessionId]),
  );
});
