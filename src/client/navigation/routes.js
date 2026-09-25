function resolveRoute(location) {
  const url = new URL(location, "http://localhost");
  if(url.pathname === "/" && url.hash.startsWith("#/"))return resolveRoute(url.hash.slice(1));
  const path = url.pathname.replace(/\/$/, "") || "/";
  if (path === "/") return { page: "tasks" };
  if (path === "/tasks") return { page: "tasks" };
  if (path === "/tasks/new") return { page: "new-task" };
  if (path === "/workflows") return { page: "workflows" };
  if (path === "/analysis") {
    const view = url.searchParams.get("view") || "dashboard";
    return view === "dashboard" || view === "traces" || view === "reports" ? { page: "analysis", view } : { page: "not-found" };
  }
  try {
    const task = path.match(/^\/tasks\/([^/]+)$/);
    if (task) return { page: "task", taskId: decodeURIComponent(task[1]) };
    const workflow = path.match(/^\/workflows\/([^/]+)$/);
    if (workflow)
      return {
        page: "workflow",
        definitionId: decodeURIComponent(workflow[1]),
        revision: url.searchParams.get("revision"),
        fromTaskId: url.searchParams.get("from_task_id")
      };
  } catch {
    return { page: "not-found" };
  }
  return { page: "not-found" };
}
export {
  resolveRoute
};
