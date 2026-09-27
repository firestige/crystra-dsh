import type { WorkflowMapIR, WorkflowResourceWorkspace } from "crystra-ui-core";
export interface WorkflowStudioSource {
  schemaVersion: string;
  definitionId: string;
  revision: string;
  directory: string;
  title: string;
  version: string;
  documents: Record<string, any>;
  resources?: { owned?: any[]; referenced?: any[] };
  files: WorkflowResourceWorkspace["files"];
  catalog?: NonNullable<WorkflowResourceWorkspace["catalog"]>;
}
/** Project executable DSL identities, including routing cases and parallel joins. No sample substitution. */
export function projectWorkflowStudio(source: WorkflowStudioSource) {
  const definition = source.documents.workflow;
  const graph = definition?.graph;
  if (!graph || !Array.isArray(graph.nodes))
    throw Error("工作流缺少可展示的 graph");
  const actions = new Map<string, any>(
    (source.documents.actions?.actions || []).map((a: any) => [a.id, a]),
  );
  const routes = source.documents.routes?.routes || [];
  const resources = (action: any) =>
    routes
      .filter((r: any) => action?.allowedRoutes?.includes(r.id))
      .flatMap((r: any) => [
        r.resources?.rolePrompt?.id,
        ...(r.resources?.actionPrompts || [])
          .filter((p: any) => p.action === action?.id)
          .map((p: any) => p.prompt?.id),
        ...(r.resources?.skills || []).map((s: any) => s.id),
      ])
      .filter(Boolean);
  const node = (id: string, actionId?: string) => {
    const a = actions.get(actionId || "");
    return {
      id,
      kind: "activity" as const,
      title: a?.name || actionId || id,
      description: a?.purpose,
      inputs: Object.keys(a?.inputSchema?.properties || {}),
      outputs: Object.keys(a?.resultSchema?.properties || {}),
      resources: resources(a),
    };
  };
  const nodes: WorkflowMapIR["nodes"] = [
    { id: "$start", kind: "start", title: "开始" },
  ];
  const edges: WorkflowMapIR["edges"] = [];
  const endOf = (id: string) =>
    graph.nodes.some((n: any) => n.id === id && n.kind === "parallel")
      ? "$join:" + id
      : id;
  for (const n of graph.nodes) {
    if (n.kind === "parallel") {
      nodes.push({ id: n.id, kind: "fork", title: n.name || "并行活动" });
      nodes.push({
        id: "$join:" + n.id,
        kind: "join",
        join: "all",
        title: actions.get(n.join?.action)?.name || "汇合",
        resources: resources(actions.get(n.join?.action)),
      });
      for (const branch of n.branches || []) {
        nodes.push(node(branch.id, branch.action));
        edges.push(
          { id: "$fork:" + branch.id, from: n.id, to: branch.id },
          { id: "$join:" + branch.id, from: branch.id, to: "$join:" + n.id },
        );
      }
    } else
      nodes.push({
        ...node(n.id, n.action),
        description: actions.get(n.action)?.purpose || n.kind,
      });
    for (const [index, c] of (n.routing?.cases || []).entries())
      edges.push({
        id: `$route:${n.id}:${index}`,
        from: endOf(n.id),
        to: c.target,
        label: String(c.value),
        intent: "expected",
      });
  }
  for (const t of graph.terminals || [])
    nodes.push({
      id: "terminal:" + t.id,
      kind: "end",
      title: t.id,
      description: t.meaning,
      outcome: t.kind === "success" ? "completed" : "terminated",
    });
  if (graph.start)
    edges.push({ id: "$start-edge", from: "$start", to: graph.start });
  for (const e of graph.edges || [])
    edges.push({
      id: e.id,
      from: endOf(e.from),
      to: e.to,
      label: e.label || e.condition,
      kind: "control",
    });
  for (const e of graph.eventEdges || [])
    edges.push({
      id: e.id,
      from: endOf(e.from),
      to: e.to,
      label: e.event,
      intent: "recovery",
      trigger: e.event,
    });
  if (
    edges.some(
      (e) =>
        !nodes.some((n) => n.id === e.from) ||
        !nodes.some((n) => n.id === e.to),
    )
  )
    throw Error("工作流包含尚未支持的目标引用，未展示不完整流程");
  const workflow: WorkflowMapIR = {
    version: "0.2",
    title: source.title,
    description: definition.workflow?.purpose,
    nodes,
    edges,
  };
  const resourceNodes: WorkflowResourceWorkspace["nodes"] = nodes.map((n) => ({
    id: n.id,
    kind: "activity",
    label: n.title,
  }));
  const refs: WorkflowResourceWorkspace["edges"] = [];
  for (const file of source.files)
    resourceNodes.push({
      id: "file:" + file.path,
      kind: "file",
      label: file.path,
      file: file.path,
    });
  for (const r of source.resources?.owned || []) {
    const file = r.path?.replace(/^\.\.\//, "");
    resourceNodes.push({
      id: r.id,
      kind: "resource",
      label: r.id,
      detail: JSON.stringify(r),
    });
    if (source.files.some((f) => f.path === file))
      refs.push({ from: r.id, to: "file:" + file, label: "资源文件" });
  }
  for (const n of nodes)
    for (const r of n.resources || [])
      if (resourceNodes.some((x) => x.id === r))
        refs.push({ from: n.id, to: r, label: "允许使用" });
  const workspace: WorkflowResourceWorkspace = {
    root: source.directory,
    title: source.title,
    version: source.version,
    files: source.files,
    catalog: source.catalog,
    nodes: resourceNodes,
    edges: refs,
  };
  return { workflow, workspace };
}
