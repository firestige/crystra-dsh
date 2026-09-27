import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowStudioController } from "../src/client/workflows/workflow-studio-controller.js";
test("transport rejection resumes reads, and old in-flight reads cannot overwrite writes", async () => {
  let value = { revision: "1" },
    fail = false,
    reads = 0,
    resolveOld;
  const rpc = {
    async call(c, e, p) {
      if (e === "studio/read") {
        reads++;
        if (reads === 2) return new Promise((r) => (resolveOld = r));
        return { ok: true, value };
      }
      if (fail) throw Error("offline");
      value = { revision: "2" };
      return { ok: true, value };
    },
  };
  const controller = createWorkflowStudioController({
    rpc,
    definitionId: "test",
    interval: 100000,
  });
  await controller.refresh();
  const pending = controller.refresh();
  await controller.save({});
  resolveOld({ ok: true, value: { revision: "old" } });
  await pending;
  assert.equal(controller.getSnapshot().source.revision, "2");
  fail = true;
  await assert.rejects(controller.save({}), /offline/);
  value = { revision: "3" };
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("polling did not recover")),
      1000,
    );
    const stop = controller.subscribe(() => {
      if (controller.getSnapshot().source?.revision === "3") {
        clearTimeout(timer);
        stop();
        resolve();
      }
    });
  });
  assert.equal(controller.getSnapshot().source.revision, "3");
  controller.dispose();
});
