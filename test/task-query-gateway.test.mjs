import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskQueryGateway } from "../modules/execution/src/host/task-query.js";
test("Task queries are independent of runtime and changes wait for a new revision", async () => {
  let snapshot = {
    schemaVersion: "execution.tasks@1.0.0",
    revision: "one",
    items: [],
  };
  const gateway = createTaskQueryGateway(
    { snapshot: async () => snapshot },
    { pollMs: 2, waitMs: 30 },
  );
  assert.deepEqual(await gateway.handle("list", {}), {
    ok: true,
    value: snapshot,
  });
  const pending = gateway.handle("changes", { after: "one" });
  snapshot = { ...snapshot, revision: "two" };
  assert.deepEqual(await pending, { ok: true, value: snapshot });
  await assert.rejects(gateway.handle("list", { anything: 1 }));
  const waiting = gateway.handle("changes", { after: "two" });
  await gateway.close();
  assert.equal((await waiting).ok, false);
});
test("owner failures are explicit and never converted into an empty catalogue", async () => {
  const gateway = createTaskQueryGateway({
    snapshot: async () => {
      throw Error("corrupt");
    },
  });
  assert.equal((await gateway.handle("list", {})).ok, false);
  await gateway.close();
});
