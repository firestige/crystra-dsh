import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Session, SESSION_FORMAT_VERSION } from "@deepseek-ai/dsh-session";
import { validateStoredEvents } from "@deepseek-ai/dsh-session-persistence";
import { createTaskAdmission } from "../src/host/task-admission.js";
import { createTaskControl, taskSourceMessages } from "../src/host/task-control.js";
test('cold control projection reads only own persisted events and releases its read handle', async () => {
  let closed = 0;
  const ctx = { sessions: { get: () => undefined }, sessionPersistence: {
    open: async (id, access) => {
      assert.equal(id, 'cold-task-session'); assert.equal(access, 'read');
      return { inheritedEventCount: 7, read: async offset => {
        assert.equal(offset, 7);
        return { events: [{type:'user/message',data:{id:'own-message',source:{kind:'user'}}}] };
      }, close: async () => { closed++; } };
    }
  } };
  assert.deepEqual(await taskSourceMessages(ctx, 'cold-task-session'), [{id:'own-message'}]);
  assert.equal(closed, 1);
  ctx.sessionPersistence.open = async () => ({ read: async () => {throw Error('read failed');}, close: async () => {closed++;} });
  await assert.rejects(taskSourceMessages(ctx, 'cold-task-session'), /read failed/);
  assert.equal(closed, 2);
});
import { createExternalChatAdapter } from "../src/host/external-chat.js";
import {
  projectTaskControl,
  markdownSections,
} from "../src/client/task-workbench/task-projection.js";
test("native Chat updates Brief, receives approval, advances Plan and feeds the new panels from the same files", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-chat-control-"));
  try {
    const session = Session.create("session-control", [], {
      id: "session-control",
      version: SESSION_FORMAT_VERSION,
      cwd: root,
      createdAt: 100,
      isSeeded: false,
    });
    let round = 0,
      answer = "确认此版本",
      headers = [],
      questionsAsked = [];
    const ctx = {
      sessions: {
        get: (id) => (id === session.id ? session : undefined),
        flush: async () => true,
      },
      workspaceRegistry: {
        list: () => [{ id: "workspace", path: root, sessionIds: [session.id] }],
      },
      agents: { roots: () => [] },
      userQuestions: {
        ask: async (request) => {
          questionsAsked.push(request);
          return {
            answers: request.questions.map((q) => ({
              id: q.id,
              selected: [answer],
            })),
          };
        },
      },
    };
    const runtime = {
      control: {
        admitTask: async (h) => {
          headers.push(h);
          return h;
        },
        planningCapabilities: async () => ({ providers: [] }),
      },
    };
    const admission = await createTaskAdmission({
      ctx,
      stateRoot: root,
      owner: () => runtime.control,
    });
    const control = createTaskControl({
      ctx,
      stateRoot: root,
      admission,
      runtime: () => runtime,
    });
    ctx.crystraTaskControl = control;
    assert.equal(
      await control.forSession(session.id),
      undefined,
      "native sessions are not silently made Tasks",
    );
    assert.equal(
      (await control.handle("tasks/admit", { sessionId: session.id })).value,
      null,
    );
    const append = (text) =>
      session.append(
        "user/message",
        {
          id: "user-" + ++round,
          role: "user",
          source: { kind: "user" },
          content: [{ type: "text", text }],
        },
        { surfaceOp: "append" },
      );
    let brief;
    const provider = {
      id: "test",
      async *run({ taskContext: c }) {
        assert.ok(
          c?.artifactRoot,
          "Task instructions must reach the native provider",
        );
        if (c.stage === "requirements") {
          brief = {
            schema: "crystra.brief@1",
            taskId: c.taskId,
            goal: "用户目标",
            scope: ["只修改文档"],
            nonGoals: ["发布"],
            assumptions: [],
            questions: round === 1 ? ["文档语言？"] : [],
            acceptance: ["内容完整"],
            requestConfirmation: round > 1,
            grilling: {
              round,
              budget: { initial: 1, remaining: round === 1 ? 1 : 0 },
              topics: [
                { id: "topic", title: "文档要求", estimatedQuestions: 1 },
              ],
              questions: [
                {
                  id: "question",
                  topicId: "topic",
                  text: "文档语言？",
                  status: round === 1 ? "pending" : "answered",
                  origin: "initial",
                  sourceMessageIds: ["user-1"],
                  reason: "确定交付语言",
                  answer: round === 1 ? null : "中文",
                },
              ],
            },
          };
          await writeFile(
            join(c.artifactRoot, "brief.json"),
            JSON.stringify(brief),
          );
        } else if (c.stage === "planning") {
          const plan = {
            ...brief,
            schema: "crystra.plan@1",
            briefDigest: c.brief.digest,
            questions: ["审核范围？"],
            requestConfirmation: false,
            steps: ["编写", "审核"],
            bindings: ["等待审核确定"],
            revision: "v1",
            documentMarkdown:
              "# 非固定章节\n真实计划正文\n## 检查方法\n逐条检查",
            graph: {
              nodes: [
                {
                  id: "wave-1",
                  kind: "wave",
                  title: "文档工作单元",
                  goal: "完成文档",
                  entryConditions: [],
                  exitConditions: ["内容完整"],
                  risks: [],
                  evidence: [],
                },
              ],
              edges: [],
            },
            readiness: Object.fromEntries(
              ["control", "proof", "context"].map((k) => [
                k,
                { status: "待检查", items: ["明确范围"] },
              ]),
            ),
          };
          await writeFile(
            join(c.artifactRoot, "plan.json"),
            JSON.stringify(plan),
          );
        }
        yield { type: "text", text: "已更新当前任务文件" };
      },
    };
    const adapter = createExternalChatAdapter({
      Base: class {},
      ctx,
      providers: [provider],
    });
    const send = async () => {
      for await (const _ of adapter.stream({
        provider: "test",
        model: "test-model",
        sessionId: session.id,
        messages: [],
      })) {
      }
    };
    append("编写文档");
    await send();
    const binding = (await admission.bindings())[0];
    let response = await control.handle("tasks/projection", {
      taskId: binding.taskId,
    });
    assert.equal(response.ok, true);
    let view = projectTaskControl(response.value);
    assert.equal(view.panels.grilling.overview.unanswered, 1);
    assert.equal(view.attention.grilling.messageIds.length, 1);
    assert.equal(view.systemFocus, "grilling");
    assert.equal(response.value.brief.confirmed, false);
    append("中文");
    await send();
    response = await control.handle("tasks/projection", {
      taskId: binding.taskId,
    });
    view = projectTaskControl(response.value);
    assert.equal(response.value.brief.confirmed, true);
    assert.equal(response.value.stage, "planning");
    assert.equal(questionsAsked.length, 1);
    assert.equal(view.systemFocus, "plan");
    assert.equal(view.panels.grilling.overview.resolved, 1);
    assert.equal(view.panels.plan.document[0].title, "非固定章节");
    assert.equal(view.panels.plan.document[1].title, "检查方法");
    assert.equal(view.graph.nodes[0].id, "wave-1");
    assert.equal(new Set(headers.map((h) => h.id)).size, 1);
    assert.doesNotThrow(() => validateStoredEvents(session.header, [...session.ownEvents()]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("markdown headings inside code fences do not become document chapters", () => {
  assert.deepEqual(
    markdownSections("# Real\n```md\n# fake\n```\n## Child\nBody").map(
      (s) => s.title,
    ),
    ["Real", "Child"],
  );
});
test("execution, review and delivery projections retain owner identities and actual call order", () => {
  const definition = (id, kind) => ({
    id,
    kind,
    title: id,
    goal: id,
    entryConditions: [],
    exitConditions: ["verified"],
    risks: [],
    evidence: [],
  });
  const plan = {
    revision: "v2",
    acceptance: ["delivered"],
    graph: {
      nodes: [definition("wave", "wave"), definition("gate", "gate")],
      edges: [
        {
          id: "edge",
          source: "wave",
          target: "gate",
          kind: "normal",
          label: "",
        },
      ],
    },
    questions: [],
    scope: [],
    nonGoals: [],
  };
  const run = {
    id: "run",
    planDigest: "digest",
    plan,
    nodes: {
      wave: {
        state: "completed",
        deliveryId: "delivery",
        workflowRun: {
          state: "available",
          value: {
            taskId: "task",
            deliveryId: "delivery",
            workflowRunId: "workflow-run",
            status: "stopped",
            visits: [
              { id: "visit-1", target: "review" },
              { id: "visit-2", target: "write" },
              { id: "visit-3", target: "review" },
            ],
            control: { nodes: {}, decisions: {}, ordinarySuccessor: {} },
          },
        },
        result: { state: "available", reference: { identity: "result" } },
      },
      gate: { state: "awaiting-decision" },
    },
    selectedGateId: "gate",
    deliveryAssessment: {
      summary: "有条件交付",
      conclusion: "conditional",
      source: "control-plane-agent",
      candidates: [],
      criteria: [{ index: 0, status: "unknown", reason: "待确认" }],
      conditions: ["审核批准"],
      assessedAt: "now",
    },
  };
  const input = {
    taskId: "task",
    stage: "ready",
    brief: { state: "missing" },
    plan: {
      state: "available",
      digest: "digest",
      value: plan,
      confirmed: true,
    },
    run: { current: run, assessmentCurrent: true },
  };
  const p = projectTaskControl(input);
  assert.deepEqual(
    p.panels.execution.waves[0].run.calls.map((c) => c.actionId),
    ["review", "write", "review"],
  );
  assert.deepEqual(p.panels.execution.waves[0].run.calls[2].predecessors, [
    "visit-2",
  ]);
  assert.equal(p.selectedGateId, "gate");
  assert.equal(p.systemFocus, "gate");
  assert.equal(p.attention.gate.messageIds.length, 1);
  assert.equal(p.panels.delivery.acceptance[0].claim, "delivered");
  assert.equal(p.panels.delivery.risks[0].text, "审核批准");
  assert.equal(
    projectTaskControl({ ...input, plan: { ...input.plan, digest: "changed" } })
      .panels.execution,
    undefined,
    "old Plan Run cannot populate a new Plan",
  );
});
import { createTaskFlow } from "../src/host/task-flow.js";
import { createTaskPlanRuns } from "../src/host/task-plan-run.js";
import { createTaskControlRequests } from "../src/host/task-control-request.js";
import { askSelectedGate } from "../src/host/task-gate-question.js";
test("restored control requests preserve selected Gate confirmation and delivery receipts", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-gate-control-"));
  try {
    const task = {
      taskId: "task-gates",
      sessionId: "session-gates",
      workspacePath: root,
    };
    const flow = createTaskFlow({ stateRoot: root }),
      runs = createTaskPlanRuns({
        stateRoot: root,
        flow,
        runtime: () => undefined,
      }),
      requests = createTaskControlRequests({ stateRoot: root, flow, runs });
    const dir = (await flow.prepare(task)).artifactRoot;
    const brief = {
      schema: "crystra.brief@1",
      taskId: task.taskId,
      goal: "Review",
      scope: ["text"],
      nonGoals: [],
      assumptions: [],
      questions: [],
      acceptance: ["approved"],
      requestConfirmation: true,
    };
    await writeFile(join(dir, "brief.json"), JSON.stringify(brief));
    let view = await flow.read(task);
    await flow.confirm(
      task,
      "brief",
      view.brief.digest,
      "session:session-gates:question:brief",
    );
    view = await flow.read(task);
    const node = (id, kind) => ({
      id,
      kind,
      title: id,
      goal: id,
      entryConditions: [],
      exitConditions: ["approved"],
      risks: [],
      evidence: [],
    });
    const plan = {
      ...brief,
      schema: "crystra.plan@1",
      briefDigest: view.brief.digest,
      steps: ["assess", "review"],
      bindings: ["none"],
      revision: "v1",
      graph: {
        nodes: [
          node("prepare", "milestone"),
          {...node("g1", "gate"), entryConditions:["Plan confirmed"]},
          node("g2", "gate"),
        ],
        edges: ["g1", "g2"].map((id) => ({
          id,
          source: "prepare",
          target: id,
          kind: "normal",
          label: "",
        })),
      },
    };
    await writeFile(join(dir, "plan.json"), JSON.stringify(plan));
    view = await flow.read(task);
    await flow.confirm(
      task,
      "plan",
      view.plan.digest,
      "session:session-gates:question:plan",
    );
    await writeFile(
      join(dir, "control.json"),
      JSON.stringify({
        schema: "crystra.control-request@1",
        id: "check",
        operation: "assess-node",
        planDigest: view.plan.digest,
        nodeId: "prepare",
        reason: "ready",
        sourceIdentities: [view.plan.digest, "session:session-gates:question:plan", "session:session-gates:question:brief"],
        conclusion: "satisfied",
      }),
    );
    await assert.rejects(runs.checkEntry(task,{planDigest:view.plan.digest,nodeId:"prepare",reason:"untrusted",sourceIdentities:["session:foreign:question:plan"]}),/NODE_ASSESSMENT_SOURCE_INVALID/);
    assert.equal((await requests.apply(task, {})).kind, "accepted");
    assert.equal((await requests.apply(task, {})).kind, "already-applied");
    await runs.triggerGate(task,{gateId:"g1",planDigest:view.plan.digest,reason:"Plan confirmed",sourceIdentities:["session:session-gates:question:plan"]});
    await runs.selectGate(task, { gateId: "g2", planDigest: view.plan.digest });
    const answer = await askSelectedGate({
      task,
      runs,
      ask: async (question) => {
        assert.equal(question.question, "g2");
        return "确认此版本";
      },
    });
    await runs.confirmGate(task, {
      ...answer,
      answerId: "session:session-gates:question:g2",
    });
    const run = (await runs.read(task)).current;
    assert.equal(run.nodes.g2.state, "completed");
    assert.equal(run.nodes.g1.state, "awaiting-decision");
    await assert.rejects(
      runs.confirmGate(task, {
        ...answer,
        gateId: "g1",
        answerId: "session:session-gates:question:wrong",
      }),
      /GATE_SUBJECT_CHANGED/,
    );
    await runs.assessDelivery(task, {
      planDigest: view.plan.digest,
      conclusion: "conditional",
      summary: "waiting g1",
      resultIdentities: [],
      decisionIds: [run.nodes.g2.decision.answerId],
      criteria: [{ index: 0, status: "unknown", reason: "g1 pending" }],
      conditions: ["g1 confirmation"],
      candidates: [],
    });
    assert.equal(
      (await runs.read(task)).current.deliveryAssessment.summary,
      "waiting g1",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('empty workbench projections never advertise a content revision', () => {
 const view=projectTaskControl({taskId:'task-empty',stage:'requirements',brief:{state:'missing'},plan:{state:'missing'},run:{current:null}});
 assert.deepEqual(view.attention,{});
});

test('UI projection holds a complete snapshot throughout a provider write, then exposes persistent errors', async () => {
 const root=await mkdtemp(join(tmpdir(),'crystra-writing-'));
 try {
  const task={taskId:'task-writing',sessionId:'s',workspacePath:root};
  const control=createTaskControl({stateRoot:root,ctx:{sessions:{get:()=>({ownEvents:()=>[]})}},admission:{bindings:async()=>[task]},runtime:()=>undefined});
  const dir=(await control.flow.prepare(task)).artifactRoot;
  const brief={schema:'crystra.brief@1',taskId:task.taskId,goal:'old',scope:['s'],nonGoals:[],assumptions:[],questions:[],acceptance:['a'],requestConfirmation:false};
  await writeFile(join(dir,'brief.json'),JSON.stringify(brief));
  const before=(await control.handle('tasks/projection',{taskId:task.taskId})).value;
  const end=await control.beginUpdate(task);
  await writeFile(join(dir,'brief.json'),'{');
  const during=(await control.handle('tasks/projection',{taskId:task.taskId})).value;
  assert.equal(during.updating,true);assert.equal(during.brief.digest,before.brief.digest);
  assert.equal((await control.flow.read(task)).brief.state,'invalid','control reads must never accept cached data');
  await writeFile(join(dir,'brief.json'),JSON.stringify({...brief,goal:'new'}));end();
  const after=(await control.handle('tasks/projection',{taskId:task.taskId})).value;
  assert.equal(after.brief.value.goal,'new');assert.equal(after.updating,false);
  const endBad=await control.beginUpdate(task);await writeFile(join(dir,'brief.json'),'{');endBad();
  assert.equal((await control.handle('tasks/projection',{taskId:task.taskId})).value.brief.state,'invalid');
 } finally {await rm(root,{recursive:true,force:true});}
});
