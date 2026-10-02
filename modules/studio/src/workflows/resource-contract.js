import path from "node:path";
/** DSL resource kinds are protocol keys; storage locations and labels are values. */
export const resourceKinds = {
  "role-prompt": { directory: "roles", suffix: ".role.md" },
  skill: { directory: "skills", suffix: "/SKILL.md" },
  tool: { directory: "scripts", suffix: ".sh" },
  cli: { directory: "cli", suffix: ".sh" },
  template: { directory: "templates", suffix: ".md" },
  "action-prompt": { directory: "prompts", suffix: ".prompt.md" },
  documentation: { directory: "docs", suffix: ".md" },
};
export function resourcePath(locator) {
  const result = path.posix.normalize("definition/" + locator);
  if (
    path.isAbsolute(locator) ||
    locator.includes("\\") ||
    result === ".." ||
    result.startsWith("../")
  )
    throw Error("WORKFLOW_PATH_INVALID");
  return result;
}
export function resourceCatalog(current) {
  const names = JSON.parse(
    current.content.get(".crystra/resources.json")?.toString("utf8") ||
      '{"names":{}}',
  ).names;
  return (current.packageDocument.resources?.owned || [])
    .filter((r) => r.id && resourceKinds[r.kind] && typeof r.path === "string")
    .map((r) => {
      const file = resourcePath(r.path),
        text = current.content.get(file)?.toString("utf8") || "";
      return {
        id: r.id,
        resourceKind: r.kind,
        path: file,
        name:
          names[r.id] ||
          names[file] ||
          text.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim() ||
          text.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
          path.posix.basename(file),
        filePaths:
          r.kind === "skill"
            ? [...current.content.keys()].filter((p) =>
                p.startsWith(path.posix.dirname(file) + "/"),
              )
            : [file],
      };
    })
    .filter((r) => current.content.has(r.path));
}
export function resourceReferences(current, resource) {
  const files = new Set(resource.filePaths),
    owned = current.packageDocument.resources?.owned || [],
    ids = new Set(
      owned
        .filter((r) => r.path && files.has(resourcePath(r.path)))
        .map((r) => r.id),
    );
  ids.add(resource.id);
  const refs = [];
  const hasReference = (value) =>
    typeof value === "string"
      ? ids.has(value) ||
        [...files].some((p) => value === p || value === "../" + p)
      : Array.isArray(value)
        ? value.some(hasReference)
        : value && typeof value === "object"
          ? Object.values(value).some(hasReference)
          : false;
  const pkg = structuredClone(current.packageDocument);
  if (pkg.resources) pkg.resources.owned = owned.filter((r) => !ids.has(r.id));
  if (hasReference(pkg)) refs.push({ from: "package", label: "资源声明引用" });
  for (const [key, locator] of Object.entries(
    current.packageDocument.documents,
  )) {
    const text = current.content.get(resourcePath(locator))?.toString("utf8");
    if (text && hasReference(JSON.parse(text)))
      refs.push({ from: key, label: "流程定义引用" });
  }
  for (const [file, bytes] of current.content) {
    if (
      files.has(file) ||
      file.startsWith("definition/") ||
      file.startsWith(".crystra/")
    )
      continue;
    for (const match of bytes
      .toString("utf8")
      .matchAll(/\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
      try {
        const url = new URL(match[1], "https://workspace/" + file);
        if (
          url.origin === "https://workspace" &&
          files.has(decodeURIComponent(url.pathname.slice(1)))
        ) {
          refs.push({ from: file, label: "文档链接" });
          break;
        }
      } catch {
        /* malformed links do not resolve to a resource */
      }
    }
  }
  return refs;
}
