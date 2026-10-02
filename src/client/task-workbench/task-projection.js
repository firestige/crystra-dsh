import { workflowActivityProjection } from "./workflow-activity-projection.js";
import { fromMarkdown } from "mdast-util-from-markdown";
const status = {
  pending: "尚未开始",
  starting: "正在提交",
  running: "运行中",
  failed: "执行失败",
  "start-failed": "启动失败",
  "start-uncertain": "启动状态待核对",
  "result-unavailable": "结果尚不可读",
  "result-available": "结果已返回，待检查",
  completed: "已完成",
  "needs-attention": "需要处理",
  "awaiting-decision": "待用户决定",
};
const tone = (s) =>
  s === "completed"
    ? "success"
    : ["failed", "start-failed"].includes(s)
      ? "danger"
      : ["needs-attention", "awaiting-decision", "start-uncertain"].includes(s)
        ? "warning"
        : "neutral";
const resource = (id, revision, title, value) => ({
  id,
  revision,
  title,
  ...(value === undefined
    ? {}
    : {
        content:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      }),
});
export function markdownSections(markdown) {
  if (!markdown) return [];
  const tree = fromMarkdown(markdown),
    headings = tree.children.filter((n) => n.type === "heading");
  if (!headings.length)
    return [{ id: "document", title: "完整计划", content: markdown, depth: 0 }];
  const plain = (n) => n.value ?? (n.children ?? []).map(plain).join("");
  const sections = [];
  if (headings[0].position.start.offset > 0)
    sections.push({
      id: "intro",
      title: "概述",
      content: markdown.slice(0, headings[0].position.start.offset),
      depth: 0,
    });
  headings.forEach((h, i) =>
    sections.push({
      id: `section-${i + 1}`,
      title: plain(h),
      content: markdown
        .slice(
          h.position.end.offset,
          headings[i + 1]?.position.start.offset ?? markdown.length,
        )
        .trim(),
      depth: h.depth - 1,
    }),
  );
  return sections;
}
export function projectTaskControl(view) {
  const brief =
    view.brief?.state === "available" ? view.brief.value : undefined;
  const plan = view.plan?.state === "available" ? view.plan.value : undefined;
  const run =
    view.run?.current?.planDigest === view.plan?.digest
      ? view.run.current
      : null;
  const g = brief?.grilling,
    questions = g?.questions ?? [];
  const grilling = brief
    ? {
        revision: view.brief.digest,
        ...(g
          ? {
              overview: {
                round: g.round,
                known: questions.length,
                resolved: questions.filter((q) =>
                  ["answered", "excluded"].includes(q.status),
                ).length,
                unanswered: questions.filter((q) =>
                  ["pending", "disputed"].includes(q.status),
                ).length,
                conditional: questions.filter((q) => q.status === "conditional")
                  .length,
                remainingTopics: g.topics.filter((t) =>
                  questions.some(
                    (q) =>
                      q.topicId === t.id &&
                      !["answered", "excluded"].includes(q.status),
                  ),
                ).length,
                budget: g.budget.remaining,
              },
              topics: g.topics.map((t) => {
                const qs = questions.filter((q) => q.topicId === t.id),
                  resolved = qs.filter((q) =>
                    ["answered", "excluded"].includes(q.status),
                  ).length;
                return {
                  id: t.id,
                  title: t.title,
                  status:
                    qs.length && resolved === qs.length
                      ? "resolved"
                      : qs.some((q) => q.status === "pending")
                        ? "active"
                        : "pending",
                  resolved,
                  total: qs.length,
                  reason: qs
                    .map((q) => `${q.text}${q.answer ? "：" + q.answer : ""}`)
                    .join("\n"),
                  source: [
                    ...new Set(qs.flatMap((q) => q.sourceMessageIds)),
                  ].join(", "),
                };
              }),
            }
          : {}),
        fields: [
          {
            id: "goal",
            title: "目标",
            text: brief.goal,
            status: view.brief.confirmed ? "confirmed" : "inferred",
          },
          ...[
            "scope",
            "nonGoals",
            "assumptions",
            "questions",
            "acceptance",
          ].flatMap((key) =>
            (brief[key] ?? []).map((text, i) => ({
              id: `${key}-${i}`,
              title: {
                scope: "范围",
                nonGoals: "非目标",
                assumptions: "假设",
                questions: "待澄清",
                acceptance: "验收",
              }[key],
              text,
              status:
                key === "questions"
                  ? "unresolved"
                  : key === "assumptions"
                    ? "inferred"
                    : view.brief.confirmed
                      ? "confirmed"
                      : "inferred",
            })),
          ),
        ],
        changes: questions
          .filter((q) => q.origin === "added" || q.status === "disputed")
          .map((q) => ({
            id: q.id,
            kind: q.status === "disputed" ? "conflict" : "added",
            text: q.reason || q.text,
            authority: "inferred",
          })),
      }
    : undefined;
  const graph = plan?.graph
    ? {
        nodes: plan.graph.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          kind: n.kind,
          shape: n.kind === "gate" ? "decision" : "activity",
          rank: 0,
          details: [
            n.goal,
            ...n.entryConditions,
            ...n.exitConditions,
            ...n.risks,
          ],
        })),
        edges: plan.graph.edges.map((e) => ({
          id: e.id,
          from: e.source,
          to: e.target,
          label: e.label,
        })),
      }
    : undefined;
  const projectedPlan = plan
    ? {
        revision: plan.revision ?? view.plan.digest,
        status: view.plan.confirmed
          ? "已确认"
          : plan.requestConfirmation
            ? "等待审核"
            : "编写中",
        summaryTone: view.plan.confirmed ? "success" : "warning",
        source: view.plan.digest,
        goal: plan.goal,
        criteria: plan.acceptance,
        excluded: plan.nonGoals,
        attention: plan.questions,
        document: markdownSections(plan.documentMarkdown),
        readiness: plan.readiness
          ? Object.fromEntries(
              Object.entries(plan.readiness).map(([key, value]) => [
                key,
                {
                  status: value.status,
                  tone: "neutral",
                  items: value.items.map((text, i) => ({
                    label: String(i + 1),
                    value: text,
                  })),
                },
              ]),
            )
          : undefined,
      }
    : undefined;
  const map = run
    ? {
        version: "0.2",
        title: "计划执行",
        nodes: run.plan.graph.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          kind: n.kind === "gate" ? "decision" : "activity",
        })),
        edges: run.plan.graph.edges.map((e) => ({
          id: e.id,
          from: e.source,
          to: e.target,
          kind: "control",
          label: e.label,
        })),
      }
    : undefined;
  const execution = run
    ? {
        planRevision: run.plan.revision ?? run.planDigest,
        planRunId: run.id,
        summary: "当前已确认计划的执行状态",
        facts: [
          {
            label: "已完成节点",
            value: String(
              Object.values(run.nodes).filter((n) => n.state === "completed")
                .length,
            ),
          },
          {
            label: "当前运行",
            value:
              run.plan.graph.nodes
                .filter((n) => run.nodes[n.id].state === "running")
                .map((n) => n.title)
                .join("、") || "无",
          },
        ],
        graph: map,
        waves: run.plan.graph.nodes
          .filter((n) => n.kind === "wave")
          .map((n) => {
            const state = run.nodes[n.id];
            return {
              id: n.id,
              title: n.title,
              status:
                state.observationError ?? status[state.state] ?? state.state,
              tone: tone(state.state),
              outcome:
                state.assessment?.reason ?? state.startError ?? "尚无结果判断",
              ...(projectWaveRun(view.taskId, run, n, state)
                ? { run: projectWaveRun(view.taskId, run, n, state) }
                : {}),
            };
          }),
      }
    : undefined;
  const gates = run
    ? {
        revision: run.planDigest,
        items: run.plan.graph.nodes
          .filter(
            (n) =>
              n.kind === "gate" &&
              (["awaiting-decision", "completed"].includes(
                run.nodes[n.id].state,
              ) ||
                run.nodes[n.id].decisionHistory?.length),
          )
          .map((n) => {
            const state = run.nodes[n.id];
            return {
              id: n.id,
              revision: run.planDigest,
              question: n.goal || n.title,
              location: `${run.plan.revision ?? run.planDigest} / ${n.id}`,
              trigger:
                state.triggerAssessment?.reason ??
                status[state.state] ??
                state.state,
              impact: n.exitConditions.join("；"),
              confirmed: state.decision
                ? [
                    {
                      id: state.decision.answerId,
                      quote: state.decision.answer,
                      scope: (state.decision.scope ?? []).join("；"),
                      receipt: resource(
                        state.decision.answerId,
                        run.planDigest,
                        "确认回执",
                        state.decision,
                      ),
                    },
                  ]
                : [],
              interpretation:
                state.revision?.reason ??
                state.invalidation ??
                "依据当前计划与执行结果",
              delta: state.revision ? [state.revision.reason] : [],
              effects: run.plan.graph.edges
                .filter((e) => e.source === n.id)
                .map(
                  (e) =>
                    run.plan.graph.nodes.find((x) => x.id === e.target)
                      ?.title ?? e.target,
                ),
              boundaries: n.exitConditions,
              evidence: [
                {
                  kind: "计划上下文",
                  resource: resource(
                    "plan",
                    run.planDigest,
                    "本版计划",
                    run.plan.documentMarkdown ?? run.plan,
                  ),
                },
                {
                  kind: "触发事实",
                  resource: resource(n.id, run.planDigest, "审核上下文", state),
                },
              ],
            };
          }),
      }
    : undefined;
  const assessment = run?.deliveryAssessment;
  const delivery = assessment
    ? {
        revision: run.planDigest,
        status: assessment.summary,
        tone: view.run.assessmentCurrent
          ? assessment.conclusion === "deliverable"
            ? "success"
            : "warning"
          : "warning",
        invalidated: !view.run.assessmentCurrent,
        source: assessment.source,
        calculatedAt: assessment.assessedAt,
        artifacts: assessment.candidates.map((c, i) => ({
          resource: resource(
            c.artifactId ?? `candidate-${i}`,
            c.resultIdentity,
            c.name,
            undefined,
          ),
          status: "已绑定正式结果",
        })),
        acceptance: assessment.criteria.map((c) => ({
          id: String(c.index),
          claim: run.plan.acceptance[c.index],
          verdict: c.reason,
          tone:
            c.status === "supported"
              ? "success"
              : c.status === "unsupported"
                ? "danger"
                : "warning",
          evidence: resource(
            c.sourceIdentity ?? c.resultIdentity ?? `criterion-${c.index}`,
            run.planDigest,
            "验收依据",
            c,
          ),
        })),
        risks: assessment.conditions.map((text, i) => ({
          id: `condition-${i}`,
          text,
          blocking: assessment.conclusion === "not-deliverable",
        })),
        economics: [],
      }
    : undefined;
  const systemFocus =
    view.stage === "requirements"
      ? "grilling"
      : view.stage === "planning"
        ? "plan"
        : run &&
            Object.values(run.nodes).some(
              (n) => n.state === "awaiting-decision",
            )
          ? "gate"
          : assessment
            ? "delivery"
            : "execution";
  const panels = {
    grilling,
    plan: projectedPlan,
    execution,
    gate: gates,
    delivery,
  };
  const attention = Object.fromEntries(
    Object.entries(panels).filter(([, data]) => data != null).map(([key, data]) => [
      key,
      {
        revision: JSON.stringify(data ?? null),
        messageIds:
          key === "grilling"
            ? questions
                .filter((q) => ["pending", "disputed"].includes(q.status))
                .map((q) => q.id)
            : key === "plan"
              ? (plan?.questions ?? []).map(
                  (_, i) => `${view.plan.digest}:${i}`,
                )
              : key === "gate" && run
                ? Object.entries(run.nodes)
                    .filter(([, n]) => n.state === "awaiting-decision")
                    .map(([id]) => `${run.planDigest}:${id}`)
                : [],
      },
    ]),
  );
  return {
    panels,
    graph,
    systemFocus,
    attention,
    selectedGateId: run?.selectedGateId,
    planDigest: view.plan?.digest,
  };
}

function projectWaveRun(taskId, planRun, wave, state) {
  const view = state.workflowRun;
  if (
    view?.state !== "available" ||
    view.value.taskId !== taskId ||
    view.value.deliveryId !== state.deliveryId
  )
    return undefined;
  const activity = workflowActivityProjection(view),
    value = view.value;
  if (!activity) return undefined;
  const observed = activity.nodes.filter((n) => !n.id.startsWith("candidate:"));
  const frontier = observed
    .filter((n) => n.status === "当前执行前沿")
    .map((n) => n.id);
  const edges = activity.edges.filter((e) => !e.candidate);
  return {
    identity: {
      taskId,
      planRunId: planRun.id,
      waveId: wave.id,
      deliveryId: state.deliveryId,
      runId: value.workflowRunId,
    },
    graph: {
      version: "0.2",
      title: "Delivery 执行过程",
      nodes: activity.nodes.map((n) => ({
        id: n.id,
        title: n.title,
        kind: n.kind === "gate" ? "decision" : "activity",
      })),
      edges: activity.edges.map((e) => ({
        id: e.id,
        from: e.source,
        to: e.target,
        kind: "control",
        label: e.label,
      })),
    },
    observed: observed.map((n) => n.id),
    frontier,
    candidates: activity.nodes
      .filter((n) => n.id.startsWith("candidate:"))
      .map((n) => n.id),
    traversedEdgeIds: edges.map((e) => e.id),
    calls: observed.map((n, i) => ({
      id: n.id,
      actionId: n.title,
      label: n.title,
      status: n.status,
      predecessors: i ? [observed[i - 1].id] : [],
      sequence: i + 1,
    })),
    nodes: activity.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      status: n.status,
    })),
    ...(frontier.length
      ? {
          motion: {
            nodeId: frontier[0],
            edgeIds: edges
              .filter((e) => e.target === frontier[0])
              .map((e) => e.id),
            pace: "normal",
          },
        }
      : {}),
  };
}
