import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createWorkflowQueryGateway } from "../modules/studio/src/workflows/gateway.js";
test("persists validated source bindings and rejects stale saves and invalid directories", async (t) => {
  const root = await mkdtemp("/private/tmp/crystra-settings-");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(root + "/collection");
  const gateway = createWorkflowQueryGateway(root + "/bindings.json");
  t.after(() => gateway.close());
  const first = await gateway.handle("settings/read", {});
  assert.equal(first.ok, true);
  assert.deepEqual(first.value.directories, []);
  const saved = await gateway.handle("settings/save", {
    revision: first.value.revision,
    directories: [{ path: root + "/collection", kind: "collection" }],
  });
  assert.equal(saved.ok, true);
  assert.equal(
    JSON.parse(await readFile(root + "/bindings.json", "utf8")).directories[0]
      .path,
    root + "/collection",
  );
  const stale = await gateway.handle("settings/save", {
    revision: first.value.revision,
    directories: [],
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "WORKFLOW_SETTINGS_CONFLICT");
  const invalid = await gateway.handle("settings/save", {
    revision: saved.value.revision,
    directories: [{ path: root + "/missing", kind: "collection" }],
  });
  assert.equal(invalid.ok, false);
  assert.equal(
    (await gateway.handle("settings/read", {})).value.revision,
    saved.value.revision,
  );
  const cleared = await gateway.handle("settings/save", {
    revision: saved.value.revision,
    directories: [],
  });
  assert.equal(cleared.ok, true);
});
