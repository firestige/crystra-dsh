import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as execution from "crystra-execution";
import { createTaskQueryGateway } from "../modules/execution/src/host/task-query.js";

test("the installed Execution artifact retains the mainline DSH Provider alongside Task APIs", () => {
  assert.equal(typeof execution.createDshAgentProviderFactory, "function");
  const factory = execution.createDshAgentProviderFactory({ stateDirectory: join(tmpdir(), "crystra-provider-probe") });
  const registry = new execution.AgentProviderFactoryRegistry([factory]);
  assert.equal(registry.admit({ identity: "provider.dsh", version: "0.1.5-rc.2" }, ["structured-completion"]).adapterKey, "dsh-headless");
});

test("the host gateway persists task edits through the actual installed Execution owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-task-owner-integration-"));
  let gateway;
  try {
    const repository = new execution.TaskRepository(root);
    await repository.create({ id: "task-integration", title: "Original", createdAt: 10 });
    gateway = createTaskQueryGateway(new execution.TaskQuery(repository, async () => []));
    const before = await gateway.handle("list", {});
    assert.equal(before.ok, true);
    const result = await gateway.handle("update", { taskId: "task-integration", expectedRevision: 0, displayTitle: "Renamed", pinned: true });
    assert.equal(result.ok, true);
    const stale = await gateway.handle("update", { taskId: "task-integration", expectedRevision: 0, displayTitle: "Stale" });
    assert.equal(stale.error.code, "TASK_PRESENTATION_CONFLICT");
    await gateway.close();
    gateway = createTaskQueryGateway(new execution.TaskQuery(new execution.TaskRepository(root), async () => []));
    const after = await gateway.handle("list", {});
    assert.notEqual(after.value.revision, before.value.revision);
    assert.equal(after.value.items[0].id, "task-integration");
    assert.equal(after.value.items[0].title, "Renamed");
    assert.equal(after.value.items[0].presentationRevision, 1);
    assert.ok(after.value.items[0].pinnedAt > 0);
    assert.equal((await repository.list())[0].title, "Original");
  } finally {
    await gateway?.close();
    await rm(root, { recursive: true, force: true });
  }
});
