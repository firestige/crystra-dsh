import { createTemporaryDirectory } from "./support/temporary-directory.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { createLocalWorkflowQuery } from "../modules/studio/src/workflows/local-workflow-query.js";
async function fixture(t) {
  const root = await createTemporaryDirectory("crystra-workflows-");
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function pack(root, id = "workflow-one") {
  await mkdir(join(root, "definition"), { recursive: true });
  await writeFile(
    join(root, "definition/package.json"),
    JSON.stringify({
      kind: "agentops.package",
      schemaVersion: "agentops.workflow-dsl@2.0.0",
      package: { name: "package-one", version: "1.0.0", status: "DRAFT" },
      documents: { workflow: "workflow.json" },
    }),
  );
  await writeFile(
    join(root, "definition/workflow.json"),
    JSON.stringify({
      kind: "agentops.workflow-definition",
      schemaVersion: "agentops.workflow-dsl@2.0.0",
      workflow: { id, name: "One", version: "1.0.0", graph:{nodes:[{id:"action-one",kind:"action"}]} },
    }),
  );
}
async function bind(root, directories) {
  const file = join(root, "bindings.json");
  await writeFile(
    file,
    JSON.stringify({
      schemaVersion: "crystra.workflow-directories@1.0.0",
      directories,
    }),
  );
  return file;
}
test("lists only explicitly bound local packages with stable identity and content revision", async (t) => {
  const root = await fixture(t);
  await pack(join(root, "packages/a"));
  await pack(join(root, "unbound"), "other");
  const query = createLocalWorkflowQuery(
    await bind(root, [{ path: join(root, "packages"), kind: "collection" }]),
  );
  const first = await query.snapshot();
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].definitionId, "workflow-one");
  assert.equal(first.items[0].version, "1.0.0");
  assert.equal(first.items[0].nodeCount,1);
  assert.equal(Number.isFinite(first.items[0].updatedAt),true);
  assert.equal(first.items[0].createdAt,undefined);
  assert.equal((await query.snapshot()).revision, first.revision);
  await writeFile(
    join(root, "packages/a/resource.md"),
    "changed local content",
  );
  const second = await query.snapshot();
  assert.notEqual(second.items[0].revision, first.items[0].revision);
  assert.equal(second.items[0].definitionId, first.items[0].definitionId);
});
test("rejects unbound source, malformed definitions and symlink escape without hiding previous source errors", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    createLocalWorkflowQuery(join(root, "missing.json")).snapshot(),
    /未绑定/,
  );
  await pack(join(root, "package"));
  const query = createLocalWorkflowQuery(
    await bind(root, [{ path: join(root, "package"), kind: "package" }]),
  );
  await symlink("/etc/hosts", join(root, "package/outside"));
  await assert.rejects(query.snapshot(), /SYMLINK/);
  await rm(join(root, "package/outside"));
  await writeFile(join(root, "package/definition/workflow.json"), "{");
  await assert.rejects(query.snapshot());
});
test("rejects ambiguous duplicate definition identities rather than choosing an arbitrary directory", async (t) => {
  const root = await fixture(t);
  await pack(join(root, "a"));
  await pack(join(root, "b"));
  const query = createLocalWorkflowQuery(
    await bind(root, [
      { path: join(root, "a"), kind: "package" },
      { path: join(root, "b"), kind: "package" },
    ]),
  );
  await assert.rejects(query.snapshot(), /DUPLICATE/);
});
