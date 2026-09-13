import assert from "node:assert/strict";
import test from "node:test";

import {
  createEvaluateController,
  parseStudioLocation,
  projectStudioPresentation,
  serializeStudioLocation,
} from "../src/client/evaluate-model.js";

const taskPage = {
  contract: { name: "evidence.query", revision: "1.0.0" },
  observation_profile: "2.0.0",
  read_model_revision: "2.0.0",
  snapshot: "tasks-1",
  items: [
    { task_id: "task-a", display_name: "Alpha" },
    { task_id: "task-b", display_name: "Beta" },
  ],
  next_cursor: null,
};

function singleResult(taskId = "task-a") {
  return {
    api_version: 1,
    mode: "SINGLE",
    result: {
      tag: "SIDE_RESULT",
      receipt: {
        selection: { selection_version: 1, task_ids: [taskId] },
        population_state: "COMPLETE",
        evidence_bindings: [],
        input_refs: [],
      },
      metric_results: [
        {
          metric_id: "delivery-cycle-time-ms",
          metric_version: "2.0.0",
          slices: [{ slice_key: {}, state: "AVAILABLE", value: { kind: "DURATION_MS", value: "12", unit: "ms" } }],
        },
      ],
    },
  };
}

test("deep links round-trip bounded single, compare, receipt, Fact and Trace views", () => {
  const routes = [
    { page: "select" },
    { page: "results", selection: { mode: "single", taskIds: ["task-a"] } },
    { page: "results", selection: { mode: "compare", leftTaskIds: ["task-a"], rightTaskIds: ["task-b"] } },
    { page: "receipt", selection: { mode: "single", taskIds: ["task-a"] } },
    { page: "facts", selection: { mode: "single", taskIds: ["task-a"] }, metric: "delivery-cycle-time-ms@2.0.0", scope: "result" },
    { page: "facts", selection: { mode: "compare", leftTaskIds: ["task-a"], rightTaskIds: ["task-b"] }, metric: "delivery-cycle-time-ms@2.0.0", scope: "result", side: "right" },
    { page: "trace", selection: { mode: "single", taskIds: ["task-a"] }, traceId: "a".repeat(32), spanId: "b".repeat(16) },
  ];
  for (const route of routes) {
    assert.deepEqual(parseStudioLocation(serializeStudioLocation(route)), route);
  }
  assert.deepEqual(parseStudioLocation("/builder"), { page: "invalid", reason: "UNKNOWN_STUDIO_ROUTE" });
  assert.deepEqual(parseStudioLocation(`/evaluate?v=1&task=${"x".repeat(129)}`), { page: "invalid", reason: "INVALID_SELECTION" });
});

test("an exact compare Evidence target preserves side while top navigation restores it", () => {
  const controller = createEvaluateController({
    gateway: { async call() { return { ok: true, value: { items: [] } }; } },
  });
  controller.setSelection({ mode: "compare", leftTaskIds: ["task-a"], rightTaskIds: ["task-b"] });
  controller.openFacts("delivery-cycle-time-ms@2.0.0", "result", "right");
  controller.backToResults();
  controller.restoreExactEvidence();

  assert.deepEqual(controller.getSnapshot().route, {
    page: "facts",
    selection: { mode: "compare", leftTaskIds: ["task-a"], rightTaskIds: ["task-b"] },
    metric: "delivery-cycle-time-ms@2.0.0",
    scope: "result",
    side: "right",
  });
});

test("a newly computed evaluation invalidates prior exact drill-down targets", async () => {
  const controller = createEvaluateController({
    gateway: { async call() { return { ok: true, value: singleResult() }; } },
    initialContext: { taskId: "task-a" },
  });
  await controller.evaluate();
  controller.openFacts("delivery-cycle-time-ms@2.0.0", "result", "single");
  controller.openTrace("a".repeat(32), "b".repeat(16));

  await controller.evaluate();

  assert.deepEqual(controller.getSnapshot().exactTargets, {});
});

test("session storage restores both established exact drill-down targets for the same selection", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
  const first = createEvaluateController({ gateway: { async call() { return { ok: true, value: { items: [] } }; } }, storage });
  first.setSelection({ mode: "single", taskIds: ["task-a"] });
  first.openFacts("delivery-cycle-time-ms@2.0.0", "result", "single");
  first.openTrace("a".repeat(32), "b".repeat(16));

  const restored = createEvaluateController({ gateway: { async call() { return { ok: true, value: { items: [] } }; } }, storage });

  assert.equal(restored.getSnapshot().exactTargets.evidence.metric, "delivery-cycle-time-ms@2.0.0");
  assert.equal(restored.getSnapshot().exactTargets.evidence.side, "single");
  assert.equal(restored.getSnapshot().exactTargets.trace.traceId, "a".repeat(32));
});

test("an explicit formal Task context seeds selection without adding repository or Workspace context", async () => {
  const calls = [];
  const controller = createEvaluateController({
    gateway: {
      async call(endpoint, payload) {
        calls.push([endpoint, payload]);
        if (endpoint === "tasks/list") return { ok: true, value: taskPage };
        return { ok: true, value: singleResult(payload.selection.task_ids[0]) };
      },
    },
    initialContext: { taskId: "task-a", workspaceId: "ignored", repository: "ignored" },
  });
  assert.deepEqual(controller.getSnapshot().selection, { mode: "single", taskIds: ["task-a"] });
  controller.setSelection({ mode: "single", taskIds: ["task-b"] });
  await controller.evaluate();
  assert.equal(Object.hasOwn(controller.getSnapshot(), "repository"), false);
  assert.equal(Object.hasOwn(controller.getSnapshot(), "workspaceId"), false);
  assert.equal(controller.setRepository, undefined);
  assert.deepEqual(controller.getSnapshot().selection, { mode: "single", taskIds: ["task-b"] });
  assert.deepEqual(calls.at(-1)[1].selection.task_ids, ["task-b"]);
});

test("Task discovery appends cursor pages with deterministic de-duplication", async () => {
  const controller = createEvaluateController({
    gateway: { async call(_endpoint, payload) {
      return { ok: true, value: { ...taskPage, items: payload.cursor === undefined
        ? [{ task_id: "task-b" }, { task_id: "task-a" }]
        : [{ task_id: "task-c" }, { task_id: "task-b" }], next_cursor: payload.cursor === undefined ? "next" : null } };
    } },
  });
  await controller.loadTasks();
  await controller.loadTasks("next");
  assert.deepEqual(controller.getSnapshot().taskList.items.map((item) => item.task_id), ["task-a", "task-b", "task-c"]);
  assert.equal(controller.getSnapshot().taskList.page.next_cursor, null);
});

test("clearing the current selection returns to Select without retaining an evaluation identity", () => {
  const storage = new Map();
  const controller = createEvaluateController({
    gateway: { async call() { return { ok: true, value: taskPage }; } },
    initialContext: { taskId: "task-a" },
    storage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); },
    },
  });

  controller.clearSelection();

  assert.equal(controller.getSnapshot().selection, undefined);
  assert.deepEqual(controller.getSnapshot().route, { page: "select" });
  assert.equal([...storage.values()].at(-1), "/evaluate");
});

test("session storage restores the valid evaluate location and refresh recovery retains the last result", async () => {
  const storage = new Map();
  const persisted = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  let fail = false;
  const gateway = {
    async call(endpoint, payload) {
      if (endpoint === "tasks/list") return { ok: true, value: taskPage };
      if (fail) return { ok: false, error: { code: "downstream-unavailable", message: "Evaluate is temporarily unavailable" } };
      return { ok: true, value: singleResult(payload.selection.task_ids[0]) };
    },
  };
  const first = createEvaluateController({ gateway, storage: persisted });
  first.setSelection({ mode: "single", taskIds: ["task-a"] });
  await first.evaluate();
  first.openReceipt();

  const restored = createEvaluateController({ gateway, storage: persisted });
  assert.equal(restored.getSnapshot().route.page, "receipt");
  await restored.evaluate();
  fail = true;
  await restored.refresh();
  const snapshot = restored.getSnapshot();
  assert.equal(snapshot.phase, "degraded");
  assert.equal(snapshot.result.mode, "SINGLE");
  assert.equal(snapshot.error.code, "downstream-unavailable");
});

test("partial compare and unavailable Task discovery are scoped Studio states", async () => {
  const partial = {
    api_version: 1,
    mode: "COMPARE",
    status: "PARTIAL_COMPARE",
    left: singleResult().result,
    right: { tag: "SIDE_ERROR", code: "EVIDENCE_UNAVAILABLE", retryable: true, detail: "Right side unavailable" },
    deltas: [],
  };
  const controller = createEvaluateController({
    gateway: {
      async call(endpoint) {
        return endpoint === "tasks/list"
          ? { ok: false, error: { code: "downstream-unavailable", message: "Tasks unavailable" } }
          : { ok: true, value: partial };
      },
    },
  });
  await controller.loadTasks();
  assert.equal(controller.getSnapshot().taskList.phase, "error");
  controller.setSelection({ mode: "compare", leftTaskIds: ["task-a"], rightTaskIds: ["task-b"] });
  await controller.evaluate();
  assert.equal(controller.getSnapshot().phase, "partial");
  assert.equal(controller.getSnapshot().result.left.tag, "SIDE_RESULT");
});

test("receipt, Metric Result, compare delta, Fact and Trace remain distinct presentation responsibilities", () => {
  const comparison = {
    api_version: 1,
    mode: "COMPARE",
    status: "FULL_COMPARE",
    left: singleResult("task-a").result,
    right: singleResult("task-b").result,
    deltas: [{
      metric_coordinate: "delivery-cycle-time-ms@2.0.0",
      slice_key: {},
      state: "AVAILABLE",
      direction: "DECREASE",
      value: { kind: "DURATION_MS", value: "3", unit: "ms" },
    }],
  };
  const projected = projectStudioPresentation({
    phase: "ready",
    route: { page: "receipt", selection: { mode: "compare", leftTaskIds: ["task-a"], rightTaskIds: ["task-b"] } },
    result: comparison,
    drilldown: {
      phase: "ready",
      facts: [{ id: "fact-1", kind: "EVENT_CONTRIBUTION", truth: { availability: "AVAILABLE" } }],
      trace: [{ id: "node-1", kind: "NODE", trace_id: "a".repeat(32) }],
    },
  });
  assert.equal(projected.mode, "compare");
  assert.equal(projected.metrics[0].coordinate, "delivery-cycle-time-ms@2.0.0");
  assert.deepEqual(projected.metrics[0].sides.map(({ side }) => side), ["left", "right"]);
  assert.equal(projected.metrics[0].sides[0].slices[0].value.value, "12");
  assert.equal(projected.deltas[0].direction, "DECREASE");
  assert.deepEqual(projected.receipts.map((receipt) => receipt.side), ["left", "right"]);
  assert.equal(projected.facts[0].id, "fact-1");
  assert.equal(projected.trace[0].id, "node-1");
});

test("Metric Fact drill-down follows formal receipt delivery membership and exact result lineage", async () => {
  const calls = [];
  const computed = singleResult();
  computed.result.receipt.task_population = [{ task_id: "task-a", memberships: [{ delivery_id: "delivery-a" }] }];
  computed.result.receipt.input_refs = [{ kind: "FACT", identity: "fact-read", provenance_ref: "digest-read" }];
  computed.result.metric_results[0].slices[0].provenance_refs = ["digest-result"];
  const controller = createEvaluateController({ gateway: { async call(endpoint, payload) {
    calls.push([endpoint, payload]);
    if (endpoint === "evaluations/compute") return { ok: true, value: computed };
    return { ok: true, value: { items: [
      { id: "fact-result", provenance: { accepted_digest: "digest-result" } },
      { id: "fact-read", provenance: { accepted_digest: "digest-read" } },
      { id: "fact-unrelated", provenance: { accepted_digest: "digest-other" } },
    ], next_cursor: null } };
  } } });
  controller.setSelection({ mode: "single", taskIds: ["task-a"] });
  await controller.evaluate();
  await controller.loadMetricFacts("delivery-cycle-time-ms@2.0.0", "result");
  assert.deepEqual(calls.at(-1), ["facts/read", { delivery_id: "delivery-a", limit: 200 }]);
  assert.deepEqual(controller.getSnapshot().drilldown.facts.map(({ id }) => id), ["fact-result"]);
  assert.equal(controller.getSnapshot().drilldown.references[0].identity, "digest-result");
});

test("Fact and Trace drill-down use only read endpoints and failures retain the evaluation", async () => {
  const endpoints = [];
  const gateway = {
    async call(endpoint) {
      endpoints.push(endpoint);
      if (endpoint === "evaluations/compute") return { ok: true, value: singleResult() };
      if (endpoint === "facts/read") return { ok: true, value: { items: [{ id: "fact-1" }] } };
      return { ok: false, error: { code: "downstream-unavailable", message: "Trace unavailable" } };
    },
  };
  const controller = createEvaluateController({ gateway });
  controller.setSelection({ mode: "single", taskIds: ["task-a"] });
  await controller.evaluate();
  await controller.loadFacts({ delivery_id: "delivery-1", limit: 50 });
  await controller.loadTrace({ trace_id: "a".repeat(32), limit: 200 });
  const snapshot = controller.getSnapshot();
  assert.deepEqual(endpoints, ["evaluations/compute", "facts/read", "traces/read"]);
  assert.equal(snapshot.result.mode, "SINGLE");
  assert.equal(snapshot.phase, "ready");
  assert.equal(snapshot.drilldown.phase, "error");
  assert.equal(snapshot.drilldown.facts[0].id, "fact-1");
});

test("version-incompatible formal API envelopes degrade Studio without entering rendering", async () => {
  const controller = createEvaluateController({
    gateway: {
      async call(endpoint) {
        if (endpoint === "tasks/list") return { ok: true, value: { items: "not-an-array" } };
        return { ok: true, value: { api_version: 2, mode: "SINGLE" } };
      },
    },
  });
  await controller.loadTasks();
  assert.equal(controller.getSnapshot().taskList.phase, "error");
  assert.equal(controller.getSnapshot().taskList.error.code, "incompatible-response");
  controller.setSelection({ mode: "single", taskIds: ["task-a"] });
  await controller.evaluate();
  assert.equal(controller.getSnapshot().phase, "error");
  assert.equal(controller.getSnapshot().error.code, "incompatible-response");
  assert.equal(controller.getSnapshot().result, undefined);
});

test("a production Catalog contract rejects a partial Metric Result set", async () => {
  const controller = createEvaluateController({
    catalogCoordinates: ["metric-a@2.0.0", "metric-b@2.0.0"],
    gateway: { async call() { return { ok: true, value: singleResult() }; } },
  });
  controller.setSelection({ mode: "single", taskIds: ["task-a"] });
  await controller.evaluate();
  assert.equal(controller.getSnapshot().phase, "error");
  assert.equal(controller.getSnapshot().error.code, "incompatible-response");
  assert.equal(controller.getSnapshot().result, undefined);
});
