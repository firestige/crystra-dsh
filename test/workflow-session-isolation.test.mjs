import { createTemporaryDirectory } from "./support/temporary-directory.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createWorkflowSessions } from "../src/host/workflow-sessions.js";
import { workflowSessionReady } from "../src/client/workflows/workflow-session-policy.js";
test("workflow session identity is independent of Task, revision and duplicate ensure calls", async (t) => {
  const root = await createTemporaryDirectory("workflow-session-");
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL("./fixtures/workflow-studio/", import.meta.url), root, {
    recursive: true,
  });
  const binding = path.join(root, "binding.json");
  await writeFile(
    binding,
    JSON.stringify({
      schemaVersion: "crystra.workflow-directories@1.0.0",
      directories: [{ path: path.join(root, "package"), kind: "package" }],
    }),
  );
  const requests = [];
  const service = createWorkflowSessions({
    bindingFile: binding,
    create: async (r) => {
      requests.push(r);
      return { sessionId: r.sessionId };
    },
  });
  const a = await service.ensure({ definitionId: "test" });
  await writeFile(path.join(root, "package/roles/test.md"), "new revision");
  const b = await service.ensure({ definitionId: "test" });
  assert.equal(a.sessionId, b.sessionId);
  assert(a.sessionId.startsWith("crystra-workflow-"));
  assert.equal(requests[0].cwd, path.join(root, "package"));
  assert.equal(requests[0].fork, undefined);
  await assert.rejects(service.ensure({ definitionId: "unbound" }));
  assert.equal(workflowSessionReady("test", a, "old-task-session"), false);
  assert.equal(workflowSessionReady("other", a, a.sessionId), false);
  assert.equal(workflowSessionReady("test", a, a.sessionId), true);
});
test("workflow topics persist selection, retain original Session and reject foreign or busy switches", async (t) => {
  const root = await createTemporaryDirectory("workflow-topics-");
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL("./fixtures/workflow-studio/", import.meta.url), root, {
    recursive: true,
  });
  const bindingFile = path.join(root, "binding.json");
  await writeFile(
    bindingFile,
    JSON.stringify({
      schemaVersion: "crystra.workflow-directories@1.0.0",
      directories: [{ path: path.join(root, "package"), kind: "package" }],
    }),
  );
  const requests = [];
  let busy = false;
  const config = {
    bindingFile,
    stateRoot: root,
    isRunning: () => busy,
    create: async (r) => {
      requests.push(r);
      return { sessionId: r.sessionId };
    },
  };
  const service = createWorkflowSessions(config),
    original = await service.ensure({ definitionId: "test" });
  const first = await service.topics("read", { definitionId: "test" });
  assert.equal(first.selected.sessionId, original.sessionId);
  const next = await service.topics("create", {
    definitionId: "test",
    groupId: first.group.id,
  });
  assert.notEqual(next.selected.sessionId, original.sessionId);
  assert(next.selected.sessionId.startsWith("crystra-workflow-"));
  assert.equal(requests.at(-1).cwd, path.join(root, "package"));
  assert.equal(requests.at(-1).fork, undefined);
  await service.topics("rename", {
    definitionId: "test",
    topicId: next.selected.id,
    title: "讨论资源绑定",
  });
  await writeFile(path.join(root, "package/roles/test.md"), "changed revision");
  const restored = await createWorkflowSessions(config).topics("read", {
    definitionId: "test",
  });
  assert.equal(restored.selected.title, "讨论资源绑定");
  assert.equal(restored.group.id, first.group.id);
  assert.equal(
    (await service.ensure({ definitionId: "test" })).sessionId,
    next.selected.sessionId,
  );
  await assert.rejects(
    service.topics("select", {
      definitionId: "test",
      groupId: first.group.id,
      topicId: "foreign",
    }),
    /UNKNOWN/,
  );
  busy = true;
  await assert.rejects(
    service.topics("select", {
      definitionId: "test",
      groupId: first.group.id,
      topicId: first.selected.id,
    }),
    /BUSY/,
  );
  busy = false;
  assert.equal(
    (
      await service.topics("select", {
        definitionId: "test",
        groupId: first.group.id,
        topicId: first.selected.id,
      })
    ).selected.sessionId,
    original.sessionId,
  );
});
