import {
  resourceKinds,
  resourceCatalog,
  resourceReferences,
  resourcePath,
} from "./resource-contract.js";
import path from "node:path";
import {
  readFile,
  writeFile,
  rename,
  unlink,
  lstat,
  mkdir,
} from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import {
  createLocalWorkflowQuery,
  readPackage,
} from "./local-workflow-query.js";
const metadataPath = ".crystra/resources.json";
const metadata = (current) =>
  JSON.parse(
    current.content.get(metadataPath)?.toString("utf8") ||
      '{"schemaVersion":"crystra.workflow-resource-names@1","names":{}}',
  );
const serialize = (value) => JSON.stringify(value, null, 2) + "\n";
async function atomic(root, name, bytes) {
  const target = path.join(root, name);
  await mkdir(path.dirname(target), { recursive: true });
  if (bytes === null) {
    await unlink(target).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    return;
  }
  const temp = target + "." + randomUUID() + ".tmp";
  try {
    let mode;
    try {
      mode = (await lstat(target)).mode;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await writeFile(temp, bytes, { flag: "wx", mode });
    await rename(temp, target);
  } finally {
    await unlink(temp).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
}
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
function locator(value) {
  const result = path.posix.normalize("definition/" + value);
  if (
    result.startsWith("../") ||
    path.isAbsolute(value) ||
    value.includes("\\")
  )
    fail("WORKFLOW_PATH_INVALID", "资源路径无效");
  return result;
}
/** Exact bound source only; no client-provided absolute path is accepted. */
export function createWorkflowStudioSource(bindingFile) {
  const query = createLocalWorkflowQuery(bindingFile);
  let writes = Promise.resolve();
  const journal = path.join(
    path.dirname(bindingFile),
    "workflow-resource-transaction.json",
  );
  async function recover() {
    let entry;
    try {
      entry = JSON.parse(await readFile(journal, "utf8"));
    } catch (e) {
      if (e.code === "ENOENT") return;
      throw e;
    }
    for (const [name, bytes] of entry.before) {
      if (path.isAbsolute(name) || name.split("/").includes(".."))
        fail("WORKFLOW_PATH_INVALID", "事务路径无效");
      await atomic(
        entry.directory,
        name,
        bytes === null ? null : Buffer.from(bytes, "base64"),
      );
    }
    await unlink(journal);
  }
  const recovery = recover();
  async function commit(current, changes) {
    // Recheck the complete source immediately before the transaction, including Agent edits.
    if (
      (await readPackage(current.directory, true)).revision !== current.revision
    )
      fail("WORKFLOW_REVISION_CONFLICT", "工作流版本已变化，请重试");
    const before = [...changes.keys()].map((name) => [
      name,
      current.content.has(name)
        ? current.content.get(name).toString("base64")
        : null,
    ]);
    await mkdir(path.dirname(journal), { recursive: true });
    await writeFile(
      journal,
      JSON.stringify({ directory: current.directory, before }),
      { flag: "wx" },
    );
    try {
      for (const [name, bytes] of changes)
        await atomic(current.directory, name, bytes);
      const next = await readPackage(current.directory, true);
      await unlink(journal);
      return project(next);
    } catch (error) {
      await recover();
      throw error;
    }
  }
  function enqueue(work) {
    const result = writes.then(work);
    writes = result.catch(() => {});
    return result;
  }

  async function source(request) {
    await recovery;
    if (!request || typeof request.definitionId !== "string")
      fail("WORKFLOW_ID_INVALID", "工作流身份无效");
    const item = (await query.snapshot()).items.find(
      (i) => i.definitionId === request.definitionId,
    );
    if (!item) fail("WORKFLOW_NOT_BOUND", "工作流不在绑定目录中");
    const current = await readPackage(item.directory, true);
    if (request.revision && current.revision !== request.revision)
      fail(
        "WORKFLOW_REVISION_CONFLICT",
        "工作流版本已变化，请重新打开当前版本",
      );
    return current;
  }
  function project(current) {
    const pkg = current.packageDocument;
    const documents = Object.fromEntries(
      Object.entries(pkg.documents).map(([name, file]) => [
        name,
        JSON.parse(
          current.content.get(locator(file))?.toString("utf8") || "null",
        ),
      ]),
    );
    const names = metadata(current).names;
    const files = [...current.content]
      .filter(
        ([name]) =>
          !name.startsWith(".crystra/") &&
          !name.startsWith("definition/") &&
          /\.(md|txt|json|ya?ml|py|[cm]?js|ts|sh|csv|toml)$/i.test(name),
      )
      .map(([name, bytes]) => ({
        path: name,
        displayName: names[name],
        content: bytes.toString("utf8").slice(0, 300000),
        truncated: bytes.toString("utf8").length > 300000,
        internal: false,
      }));
    return {
      schemaVersion: "crystra.workflow-studio@2",
      catalog: resourceCatalog(current).map((resource) => ({
        ...resource,
        refs: resourceReferences(current, resource),
      })),
      definitionId: current.definitionId,
      revision: current.revision,
      directory: current.directory,
      title: current.title,
      version: current.version,
      documents,
      resources: pkg.resources,
      files,
    };
  }
  return {
    mutate(request) {
      return enqueue(async () => {
        const current = await source(request);
        if (!request.revision)
          fail("WORKFLOW_REVISION_REQUIRED", "不能在未加载当前版本时修改资源");
        const view = project(current),
          meta = metadata(current),
          pkg = structuredClone(current.packageDocument),
          changes = new Map();
        const catalog = resourceCatalog(current);
        const resource = catalog.find(
          (entry) => entry.id === request.resourceId,
        );
        let selectedPath = resource?.path;
        if (!["add", "rename", "delete"].includes(request.kind))
          fail("WORKFLOW_RESOURCE_INVALID", "资源动作无效");
        if (request.kind !== "add" && !resource)
          fail("WORKFLOW_RESOURCE_INVALID", "资源不存在或不能管理");
        const group =
          request.kind === "add" ? request.resourceKind : resource.resourceKind;
        if (!resourceKinds[group])
          fail("WORKFLOW_RESOURCE_INVALID", "资源类型无效");
        if (request.kind !== "delete") {
          if (
            typeof request.name !== "string" ||
            !request.name.trim() ||
            request.name.trim().length > 120
          )
            fail(
              "WORKFLOW_RESOURCE_INVALID",
              "名称不能为空且不能超过 120 字符",
            );
          request = { ...request, name: request.name.trim() };
          if (
            catalog.some(
              (entry) =>
                entry.id !== resource?.id &&
                entry.resourceKind === group &&
                entry.name === request.name,
            )
          )
            fail("WORKFLOW_RESOURCE_DUPLICATE", "同类型中已存在这个名称");
        }
        if (request.kind === "add") {
          if (
            typeof request.content !== "string" ||
            Buffer.byteLength(request.content) > 300000
          )
            fail("WORKFLOW_RESOURCE_INVALID", "内容无效或过大");
          const { directory, suffix } = resourceKinds[group],
            id = "resource-" + randomUUID();
          selectedPath = directory + "/" + id + suffix;
          changes.set(selectedPath, request.content);
          meta.names[id] = request.name;
          pkg.resources ??= {};
          pkg.resources.owned ??= [];
          pkg.resources.owned.push({
            id,
            kind: group,
            owner: "owned",
            path: "../" + selectedPath,
            contentIdentity:
              "sha256:" +
              createHash("sha256").update(request.content).digest("hex"),
            use: request.name,
          });
          changes.set("definition/package.json", serialize(pkg));
        } else if (request.kind === "rename") {
          meta.names[resource.id] = request.name;
        } else {
          const members = resource.filePaths;
          if (resourceReferences(current, resource).length)
            fail("WORKFLOW_RESOURCE_REFERENCED", "资源仍被引用，不能删除");
          const remaining = structuredClone(pkg);
          if (remaining.resources)
            remaining.resources.owned = (
              remaining.resources.owned || []
            ).filter(
              (entry) =>
                !entry.path || !members.includes(resourcePath(entry.path)),
            );
          delete meta.names[resource.id];
          for (const name of members) {
            changes.set(name, null);
            delete meta.names[name];
          }
          changes.set("definition/package.json", serialize(remaining));
          selectedPath = "";
        }
        changes.set(metadataPath, serialize(meta));
        return { source: await commit(current, changes), path: selectedPath };
      });
    },
    async read(request) {
      await writes;
      return project(await source(request));
    },
    save(request) {
      const result = writes.then(async () => {
        const current = await source(request);
        if (!request.revision)
          fail("WORKFLOW_REVISION_REQUIRED", "不能在未加载当前版本时保存");
        if (
          typeof request.path !== "string" ||
          typeof request.base !== "string" ||
          typeof request.content !== "string" ||
          Buffer.byteLength(request.content) > 300000
        )
          fail("WORKFLOW_RESOURCE_INVALID", "文件请求无效或内容过大");
        const owner = resourceCatalog(current).find(
          (entry) => entry.id === request.resourceId,
        );
        if (!owner || !owner.filePaths.includes(request.path))
          fail("WORKFLOW_RESOURCE_INVALID", "资源身份不匹配，不能保存");
        const allowed = project(current).files.find(
          (f) => f.path === request.path && !f.truncated,
        );
        if (!allowed)
          fail("WORKFLOW_RESOURCE_NOT_EDITABLE", "该文件不能从资源页直接编辑");
        if (allowed.content !== request.base)
          fail(
            "WORKFLOW_RESOURCE_CONFLICT",
            "文件已被其他来源修改，草稿已保留",
          );
        const changes = new Map([[allowed.path, request.content]]),
          pkg = structuredClone(current.packageDocument);
        let declared = false;
        for (const entry of pkg.resources?.owned || []) {
          if (
            typeof entry.path === "string" &&
            locator(entry.path) === allowed.path
          ) {
            entry.contentIdentity =
              "sha256:" +
              createHash("sha256").update(request.content).digest("hex");
            declared = true;
          }
        }
        if (declared && allowed.content !== request.content)
          changes.set("definition/package.json", serialize(pkg));
        return commit(current, changes);
      });
      writes = result.catch(() => {});
      return result;
    },
  };
}
