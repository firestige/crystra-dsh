import { createTemporaryDirectory } from "./support/temporary-directory.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cp,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { createWorkflowStudioSource } from "../modules/studio/src/workflows/studio-source.js";
test("bound package read, durable CAS write and path boundary", async (t) => {
  const root = await createTemporaryDirectory("crystra-studio-");
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL("./fixtures/workflow-studio/", import.meta.url), root, {
    recursive: true,
  });
  const binding = path.join(root, "bindings.json");
  await writeFile(
    binding,
    JSON.stringify({
      schemaVersion: "crystra.workflow-directories@1.0.0",
      directories: [{ kind: "package", path: path.join(root, "package") }],
    }),
  );
  const api = createWorkflowStudioSource(binding),
    request = { definitionId: "test" };
  const first = await api.read(request);
  const saved = await api.save({
    ...request,
    revision: first.revision,
    resourceId: "resource.test",
    path: "roles/test.md",
    base: "# Test",
    content: "# Updated",
  });
  assert.notEqual(saved.revision, first.revision);
  assert.equal(
    await readFile(path.join(root, "package/roles/test.md"), "utf8"),
    "# Updated",
  );
  await assert.rejects(
    api.save({
      ...request,
      revision: first.revision,
      resourceId: "resource.test",
      path: "roles/test.md",
      base: "# Test",
      content: "lost",
    }),
    /版本已变化/,
  );
  await assert.rejects(
    api.save({
      ...request,
      path: "../bindings.json",
      base: "",
      content: "bad",
    }),
    /不能/,
  );
  await assert.rejects(api.read({ definitionId: "unbound" }), /绑定/);
  await symlink(binding, path.join(root, "package/roles/link.md"));
  await assert.rejects(api.read(request), /SYMLINK/);
});
test("resource add, rename, delete persist with owner declarations, CAS and reference guards", async (t) => {
  const root = await createTemporaryDirectory("crystra-resources-");
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL("./fixtures/workflow-studio/", import.meta.url), root, {
    recursive: true,
  });
  const binding = path.join(root, "bindings.json");
  await writeFile(
    binding,
    JSON.stringify({
      schemaVersion: "crystra.workflow-directories@1.0.0",
      directories: [{ kind: "package", path: path.join(root, "package") }],
    }),
  );
  let api = createWorkflowStudioSource(binding);
  let current = await api.read({ definitionId: "test" });
  const added = await api.mutate({
    definitionId: "test",
    revision: current.revision,
    kind: "add",
    resourceKind: "documentation",
    name: "Design notes",
    content: "# Notes",
  });
  assert.equal(
    await readFile(path.join(root, "package", added.path), "utf8"),
    "# Notes",
  );
  assert(
    added.source.resources.owned.some((r) => r.path === "../" + added.path),
  );
  await assert.rejects(
    api.mutate({
      definitionId: "test",
      revision: current.revision,
      kind: "delete",
      resourceId: added.source.catalog.find((r) => r.path === added.path).id,
    }),
    /版本已变化/,
  );
  let renamed = await api.mutate({
    definitionId: "test",
    revision: added.source.revision,
    kind: "rename",
    resourceId: added.source.catalog.find((r) => r.path === added.path).id,
    name: "Renamed notes",
  });
  api = createWorkflowStudioSource(binding);
  assert.equal(
    (await api.read({ definitionId: "test" })).catalog.find(
      (r) => r.path === added.path,
    ).name,
    "Renamed notes",
  );
  await assert.rejects(
    api.mutate({
      definitionId: "test",
      revision: renamed.source.revision,
      kind: "add",
      resourceKind: "documentation",
      name: "Renamed notes",
      content: "",
    }),
    /同类型/,
  );
  await writeFile(
    path.join(root, "package/roles/test.md"),
    `[notes](../${added.path})`,
  );
  current = await api.read({ definitionId: "test" });
  await assert.rejects(
    api.mutate({
      definitionId: "test",
      revision: current.revision,
      kind: "delete",
      resourceId: added.source.catalog.find((r) => r.path === added.path).id,
    }),
    /引用/,
  );
  await writeFile(path.join(root, "package/roles/test.md"), "# Test");
  current = await api.read({ definitionId: "test" });
  const removed = await api.mutate({
    definitionId: "test",
    revision: current.revision,
    kind: "delete",
    resourceId: added.source.catalog.find((r) => r.path === added.path).id,
  });
  assert(!removed.source.files.some((f) => f.path === added.path));
  assert(
    !removed.source.resources.owned.some((r) => r.path === "../" + added.path),
  );
  await assert.rejects(
    api.mutate({
      definitionId: "test",
      revision: removed.source.revision,
      kind: "rename",
      path: "../bindings.json",
      name: "escape",
    }),
  );
});
test("interrupted resource transaction is rolled back before the first read", async (t) => {
  const root = await createTemporaryDirectory("crystra-recover-");
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL("./fixtures/workflow-studio/", import.meta.url), root, {
    recursive: true,
  });
  const directory = path.join(root, "package"),
    binding = path.join(root, "bindings.json");
  await writeFile(
    binding,
    JSON.stringify({
      schemaVersion: "crystra.workflow-directories@1.0.0",
      directories: [{ kind: "package", path: directory }],
    }),
  );
  await writeFile(
    path.join(root, "workflow-resource-transaction.json"),
    JSON.stringify({
      directory,
      before: [
        ["roles/test.md", Buffer.from("# Test").toString("base64")],
        ["roles/new.md", null],
      ],
    }),
  );
  await writeFile(path.join(directory, "roles/test.md"), "partial");
  await writeFile(path.join(directory, "roles/new.md"), "partial new");
  const source = await createWorkflowStudioSource(binding).read({
    definitionId: "test",
  });
  assert.equal(
    source.files.find((f) => f.path === "roles/test.md").content,
    "# Test",
  );
  assert(!source.files.some((f) => f.path === "roles/new.md"));
});
test("semantic identity is independent of location and labels; encoded references are authoritative", async (t) => {
  const root = await createTemporaryDirectory("crystra-semantic-");
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL("./fixtures/workflow-studio/", import.meta.url), root, {
    recursive: true,
  });
  const directory = path.join(root, "package"),
    binding = path.join(root, "bindings.json");
  await writeFile(
    binding,
    JSON.stringify({
      schemaVersion: "crystra.workflow-directories@1.0.0",
      directories: [{ kind: "package", path: directory }],
    }),
  );
  const pkg = JSON.parse(
    await readFile(directory + "/definition/package.json", "utf8"),
  );
  pkg.resources.owned.push({
    id: "notes.stable",
    kind: "documentation",
    owner: "owned",
    path: "../roles/a b.md",
  });
  await writeFile(directory + "/definition/package.json", JSON.stringify(pkg));
  await writeFile(directory + "/roles/a b.md", "# 任意标题");
  await writeFile(directory + "/roles/test.md", "[notes](a%20b.md)");
  const api = createWorkflowStudioSource(binding);
  const first = await api.read({ definitionId: "test" });
  const entry = first.catalog.find((r) => r.id === "notes.stable");
  assert.equal(entry.resourceKind, "documentation");
  assert.equal(entry.refs.length, 1);
  await assert.rejects(
    api.mutate({
      definitionId: "test",
      revision: first.revision,
      kind: "delete",
      resourceId: "notes.stable",
    }),
    /引用/,
  );
  await assert.rejects(
    api.mutate({
      definitionId: "test",
      revision: first.revision,
      kind: "rename",
      path: entry.path,
      name: "bad",
    }),
    /不存在/,
  );
  const renamed = await api.mutate({
    definitionId: "test",
    revision: first.revision,
    kind: "rename",
    resourceId: "notes.stable",
    name: "New label",
  });
  assert.equal(
    renamed.source.catalog.find((r) => r.id === "notes.stable").name,
    "New label",
  );
  assert.equal(renamed.path, entry.path);
});
