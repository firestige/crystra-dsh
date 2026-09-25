import type { PlanProjection } from "crystra-ui-core";
import type { PlanGraphProjection } from "crystra-ui-core";
/** Temporary draft.1 input boundary. Not an execution validator or public contract. */
export interface PlanDraft {
  format: string;
  identity: { taskId: string; planId: string; revision: string };
  document: {
    sections: {
      id: string;
      parentId: string | null;
      title: string;
      markdown: string;
      entityRefs: string[];
    }[];
  };
  criteria: {
    id: string;
    statement: string;
    verificationRequirement: string;
  }[];
  conditions: {
    id: string;
    expression: {
      op: string;
      criterionRef?: string;
      gateRef?: string;
      outcome?: string;
    };
  }[];
  graph: {
    entryNodeIds: string[];
    nodes: {
      id: string;
      kind: string;
      title: string;
      gateRef?: string;
      methodRef?: string;
      exitConditionRef?: string;
      conditionRef?: string;
      input?: { instruction: string };
      join?: string;
    }[];
    edges: { id: string; from: string; to: string; conditionRef: string }[];
  };
  gates: {
    id: string;
    title: string;
    question: string;
    documentAnchor: string;
    scopeRefs: string[];
    evidenceRequirements: {
      kind: string;
      description?: string;
      criterionRefs?: string[];
    }[];
    outcomes: { id: string; description: string }[];
  }[];
}
export function projectPlanDraft(input: PlanDraft): {
  key: string;
  plan: PlanProjection;
  graph: PlanGraphProjection;
} {
  if (input.format !== "crystra.task-plan/draft.1")
    throw Error("不支持的计划格式");
  const unique = <T extends { id: string }>(items: T[]) => {
    const map = new Map(items.map((item) => [item.id, item]));
    if (map.size !== items.length || items.some((item) => !item.id))
      throw Error("计划 ID 重复或为空");
    return map;
  };
  const nodes = unique(input.graph.nodes),
    conditions = unique(input.conditions),
    gates = unique(input.gates),
    criteria = unique(input.criteria),
    sections = unique(input.document.sections);
  unique(input.graph.edges);
  const requireRef = <T>(map: Map<string, T>, id: string): T => {
    const value = map.get(id);
    if (!value) throw Error(`计划引用不存在：${id}`);
    return value;
  };
  const conditionText = (id: string) => {
    const e = requireRef(conditions, id).expression;
    if (e.op === "criterionSatisfied" && e.criterionRef)
      return requireRef(criteria, e.criterionRef).statement;
    if (e.op === "gateDecision" && e.gateRef) {
      const gate = requireRef(gates, e.gateRef),
        outcome = gate.outcomes.find((o) => o.id === e.outcome);
      if (!outcome) throw Error("门禁结果引用不存在");
      return `${gate.title}：${outcome.description}`;
    }
    throw Error(`暂不支持的条件表达式：${e.op}`);
  };
  const rank = new Map<string, number>(),
    indegree = new Map(input.graph.nodes.map((n) => [n.id, 0]));
  input.graph.edges.forEach((e) => {
    requireRef(nodes, e.from);
    requireRef(nodes, e.to);
    conditionText(e.conditionRef);
    indegree.set(e.to, indegree.get(e.to)! + 1);
  });
  const queue = input.graph.nodes
    .filter((n) => indegree.get(n.id) === 0)
    .map((n) => n.id);
  input.graph.entryNodeIds.forEach((id) => {
    requireRef(nodes, id);
  });
  queue.forEach((id) => rank.set(id, 0));
  for (let i = 0; i < queue.length; i++)
    for (const edge of input.graph.edges.filter((e) => e.from === queue[i])) {
      rank.set(
        edge.to,
        Math.max(rank.get(edge.to) ?? 0, rank.get(edge.from)! + 1),
      );
      indegree.set(edge.to, indegree.get(edge.to)! - 1);
      if (indegree.get(edge.to) === 0) queue.push(edge.to);
    }
  if (queue.length !== nodes.size) throw Error("Plan 前驱图必须无环");
  input.graph.entryNodeIds.forEach((id) => {
    if (input.graph.edges.some((e) => e.to === id)) throw Error("入口具有前驱");
  });
  const ordered: NonNullable<PlanProjection["document"]> = [];
  const visitSection = (id: string, depth: number, path: Set<string>) => {
    if (path.has(id)) throw Error("章节层级必须无环");
    const s = requireRef(sections, id);
    path = new Set([...path, id]);
    ordered.push({ id: s.id, title: s.title, content: s.markdown, depth });
    input.document.sections
      .filter((child) => child.parentId === id)
      .forEach((child) => visitSection(child.id, depth + 1, path));
  };
  input.document.sections
    .filter((s) => s.parentId === null)
    .forEach((s) => visitSection(s.id, 0, new Set()));
  if (ordered.length !== sections.size) throw Error("章节父级引用不存在或有环");
  return {
    key: JSON.stringify(input.identity),
    plan: {
      revision: input.identity.revision,
      status: "定义草案",
      source: `${input.identity.taskId} / ${input.identity.planId} / ${input.identity.revision}`,
      criteria: input.criteria.map((c) => c.statement),
      document: ordered,
    },
    graph: {
      nodes: input.graph.nodes.map((n) => {
        const names: Record<string, string> = {
          wave: "工作单元",
          gate: "门禁",
          milestone: "里程碑",
        };
        if (!names[n.kind] || n.join === "any")
          throw Error("不支持的节点类型或前驱汇合规则");
        const gate = n.gateRef ? requireRef(gates, n.gateRef) : undefined;
        const details = [
          n.input?.instruction,
          n.methodRef ? `方法引用：${n.methodRef}` : undefined,
          n.exitConditionRef
            ? `退出条件：${conditionText(n.exitConditionRef)}`
            : undefined,
          n.conditionRef
            ? `判定条件：${conditionText(n.conditionRef)}`
            : undefined,
        ];
        if (gate) {
          requireRef(sections, gate.documentAnchor);
          gate.scopeRefs.forEach((id) => requireRef(nodes, id));
          details.push(
            `门禁标签：${gate.id}`,
            gate.question,
            `授权范围：${gate.scopeRefs.map((id) => nodes.get(id)!.title).join("、")}`,
            ...gate.evidenceRequirements.map(
              (e) =>
                `所需证据：${e.description ?? e.criterionRefs?.map((id) => requireRef(criteria, id).statement).join("、") ?? e.kind}`,
            ),
            ...gate.outcomes.map((o) => `${o.id}：${o.description}`),
          );
        }
        return {
          id: n.id,
          title: n.title,
          kind: names[n.kind],
          shape: n.kind === "gate" ? "decision" : "activity",
          rank: rank.get(n.id)!,
          details: details.filter((s): s is string => !!s),
        };
      }),
      edges: input.graph.edges.map((e) => ({
        ...e,
        label: conditionText(e.conditionRef),
      })),
    },
  };
}
