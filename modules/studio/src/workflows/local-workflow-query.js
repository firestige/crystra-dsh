import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
const schema = "agentops.workflow-dsl@2.0.0";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ignored = new Set([".git", "node_modules", ".DS_Store"]);
const text = (value) => typeof value === "string" && value.length > 0;
async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function files(root) {
  const result = [];
  async function visit(directory) {
    for (const name of (await readdir(directory)).sort()) {
      if (ignored.has(name)) continue;
      const file = path.join(directory, name),
        stat = await lstat(file);
      if (stat.isSymbolicLink())
        throw Error("WORKFLOW_SOURCE_SYMLINK_UNSUPPORTED");
      if (stat.isDirectory()) await visit(file);
      else if (stat.isFile()) {
        if (stat.size > 8 * 1024 * 1024 || result.length >= 10000)
          throw Error("WORKFLOW_SOURCE_TOO_LARGE");
        result.push({
          file,
          relative: path.relative(root, file),
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      } else throw Error("WORKFLOW_SOURCE_FILE_UNSUPPORTED");
    }
  }
  await visit(root);
  return result;
}
export async function readPackage(root, includeSource = false) {
  const before = await files(root);
  let size = 0;
  const content = new Map();
  const digest = createHash("sha256");
  for (const entry of before) {
    size += entry.size;
    if (size > 64 * 1024 * 1024) throw Error("WORKFLOW_SOURCE_TOO_LARGE");
    const bytes = await readFile(entry.file);
    if (bytes.length !== entry.size)
      throw Error("WORKFLOW_SOURCE_CHANGED_DURING_READ");
    digest.update(JSON.stringify([entry.relative, bytes.length]));
    digest.update(bytes);
    content.set(entry.relative.split(path.sep).join("/"), bytes);
  }
  if (JSON.stringify(before) !== JSON.stringify(await files(root)))
    throw Error("WORKFLOW_SOURCE_CHANGED_DURING_READ");
  const pkg = JSON.parse(
    content.get("definition/package.json")?.toString("utf8") ?? "null",
  );
  const locator = pkg?.documents?.workflow;
  if (
    pkg?.kind !== "agentops.package" ||
    pkg.schemaVersion !== schema ||
    !text(locator) ||
    path.isAbsolute(locator) ||
    locator.includes("\\") ||
    locator.includes(":") ||
    locator.split("/").some((x) => !x || x === ".." || x === ".") ||
    !text(pkg.package?.name) ||
    !text(pkg.package?.version) ||
    !text(pkg.package?.status)
  )
    throw Error("WORKFLOW_PACKAGE_METADATA_INVALID");
  const document = JSON.parse(
    content.get("definition/" + locator)?.toString("utf8") ?? "null",
  );
  const workflow = document?.workflow;
  if (
    document?.kind !== "agentops.workflow-definition" ||
    document.schemaVersion !== schema ||
    !text(workflow?.id) ||
    !text(workflow.name) ||
    !text(workflow.version)
  )
    throw Error("WORKFLOW_DEFINITION_METADATA_INVALID");
  return Object.freeze({
    ...(includeSource ? { content, packageDocument: pkg, workflowDocument: document } : {}),
    nodeCount: Array.isArray(workflow.graph?.nodes) ? workflow.graph.nodes.length : undefined,
    updatedAt: before.length ? Math.max(...before.map(entry=>entry.mtime)) : undefined,
    definitionId: workflow.id,
    title: workflow.name,
    version: workflow.version,
    revision: "local:sha256:" + digest.digest("hex"),
    packageName: pkg.package.name,
    packageVersion: pkg.package.version,
    packageStatus: pkg.package.status,
    directory: root,
  });
}
/** Read-only authoring catalogue over explicitly bound local directories.
 * This metadata projection is not executable-package validation or publication.
 */
export function createLocalWorkflowQuery(bindingFile) {
  if (!path.isAbsolute(bindingFile))
    throw Error("WORKFLOW_BINDING_PATH_INVALID");
  return {
    async snapshot() {
      let binding;
      try {
        binding = JSON.parse(await readFile(bindingFile, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") throw Error("尚未绑定本地 Workflow 目录");
        throw error;
      }
      if (
        binding?.schemaVersion !== "crystra.workflow-directories@1.0.0" ||
        !Array.isArray(binding.directories) ||
        Object.keys(binding).sort().join(",") !== "directories,schemaVersion"
      )
        throw Error("WORKFLOW_BINDING_INVALID");
      if (!binding.directories.length)
        throw Error("尚未绑定本地 Workflow 目录");
      const roots = new Set();
      for (const entry of binding.directories) {
        if (
          !entry ||
          Object.keys(entry).sort().join(",") !== "kind,path" ||
          !text(entry.path) ||
          !path.isAbsolute(entry.path) ||
          !["package", "collection"].includes(entry.kind)
        )
          throw Error("WORKFLOW_BINDING_INVALID");
        const root = await realpath(entry.path);
        if (entry.kind === "package") roots.add(root);
        else
          for (const name of (await readdir(root)).sort()) {
            if (ignored.has(name)) continue;
            const directory = path.join(root, name),
              stat = await lstat(directory);
            if (stat.isSymbolicLink())
              throw Error("WORKFLOW_SOURCE_SYMLINK_UNSUPPORTED");
            if (
              stat.isDirectory() &&
              (await exists(path.join(directory, "definition/package.json")))
            )
              roots.add(directory);
          }
      }
      const items = [];
      const seen = new Set();
      for (const root of [...roots].sort()) {
        const item = await readPackage(root);
        if (seen.has(item.definitionId))
          throw Error("WORKFLOW_DEFINITION_DUPLICATE");
        seen.add(item.definitionId);
        items.push(item);
      }
      // Binding edits during a scan must not publish a mixed source selection.
      if (
        JSON.stringify(binding) !==
        JSON.stringify(JSON.parse(await readFile(bindingFile, "utf8")))
      )
        throw Error("WORKFLOW_BINDING_CHANGED_DURING_READ");
      return Object.freeze({
        schemaVersion: "crystra.local-workflows@1.0.0",
        revision: hash(JSON.stringify(items)),
        items: Object.freeze(items),
      });
    },
  };
}
