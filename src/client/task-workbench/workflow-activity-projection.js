export function workflowActivityProjection(view) {
  if (view?.state !== "available") return;
  const run = view.value,
    control = run.control,
    visits = run.visits ?? [],
    terminal = ["terminal-proposal", "stopped"].includes(run.status);
  const node = (id, target, status) => ({
    id,
    kind: control.nodes[target]?.kind === "wait" ? "gate" : "action",
    title: target,
    status,
    goal: `Workflow Run ${run.workflowRunId}`,
    entryConditions: [],
    exitConditions: [],
    risks: [],
    evidence: [],
  });
  const nodes = visits.map((v, i) =>
      node(
        v.id,
        v.target,
        i === visits.length - 1 && !terminal ? "当前执行前沿" : "已发生",
      ),
    ),
    edges = visits
      .slice(1)
      .map((v, i) => ({
        id: `observed-${i}`,
        source: visits[i].id,
        target: v.id,
        kind: "normal",
        label: "已发生",
      }));
  if (!terminal && visits.length) {
    const d = control.decisions[run.currentTarget],
      candidates = [];
    if (control.ordinarySuccessor[run.currentTarget])
      candidates.push({
        target: control.ordinarySuccessor[run.currentTarget],
        label: "正常后继",
      });
    for (const c of d?.selector?.cases ?? [])
      candidates.push({ target: c.target, label: String(c.value) });
    for (const target of d?.selector?.allowedTargets ?? [])
      candidates.push({ target, label: "由运行时选择" });
    for (const c of Object.values(control.controls ?? {}))
      if (c.nodeIdentity === run.currentTarget)
        candidates.push({ target: c.resumeDecision, label: "收到对应输入后" });
    for (const [i, c] of candidates.entries()) {
      const id = "candidate:" + c.target;
      if (!nodes.some((n) => n.id === id))
        nodes.push(node(id, c.target, "合法候选，尚未选择"));
      edges.push({
        id: `candidate-edge-${i}`,
        source: visits.at(-1).id,
        target: id,
        kind: "normal",
        candidate: true,
        label: c.label,
      });
    }
  }
  return { nodes, edges };
}
