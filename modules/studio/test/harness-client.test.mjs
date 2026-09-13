import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createBiTheme as createCoreBiTheme } from "crystra-ui-core";

import {
  createDefaultStudioLayout,
  createStudioClientPlugin,
  createStudioGatewayPort,
  createStudioTheme,
  createStudioDashboardState,
  createStudioLayoutStore,
  reduceSingleTaskSelection,
  reduceStudioDashboardState,
  STUDIO_PAGES,
  STUDIO_TRACE_VIEWS,
  studioAccessibilityModel,
} from "../src/client/studio.js";

function textOf(element) {
  if (element === null || element === undefined || typeof element === "boolean") return "";
  if (typeof element === "string" || typeof element === "number") return String(element);
  if (Array.isArray(element)) return element.map(textOf).join("");
  return textOf(element.children);
}

function elementsOf(element) {
  if (element === null || element === undefined || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(elementsOf);
  return [element, ...elementsOf(element.children)];
}

const Bi = Object.freeze({
  Button: "crystra-button",
  ButtonGroup: "crystra-button-group",
  Surface: "crystra-surface",
  TextInput: "crystra-input",
  StatusBadge: "crystra-status-badge",
  Typography: "crystra-typography",
  BiCard: "crystra-bi-card",
  BiSection: "crystra-bi-section",
  BiSurface: "crystra-bi-surface",
  CompareResultFrame: "crystra-compare-result",
  DashboardMetricPanel: "crystra-dashboard-metric-panel",
  EvidenceConsoleFoundation: "crystra-evidence-console",
  MetricPanel: "crystra-metric-panel",
  ReceiptView: "crystra-receipt-view",
  TraceTree: "crystra-trace-tree",
  TraceStatistics: "crystra-trace-statistics",
  TraceWaterfall: "crystra-trace-waterfall",
  ScopedError: "crystra-scoped-error",
  createBiTheme: (theme) => Object.freeze({ ...theme }),
  compileTraceView: () => ({
    schemaVersion: "crystra.trace-view@1",
    status: "READY",
    traceId: "trace-1",
    nodes: [],
    parentEdges: [],
    links: [],
    errors: [],
  }),
  selectDefaultVisualizer: (result) => result.slices[0]?.value?.kind === "RATIO" ? "ratio-bar@1" : "numeric-card@1",
});

test("the Host accepts memoized Core components from the packaged browser bundle", () => {
  const memoizedBi = Object.freeze({
    ...Bi,
    TraceTree: Object.freeze({
      $$typeof: Symbol.for("react.memo"),
      type: () => null,
    }),
  });

  assert.doesNotThrow(() => createStudioClientPlugin({ React: {}, Bi: memoizedBi }));
});

test("the Host owns a versioned responsive dashboard layout and creates the platform theme through the public Core palette", () => {
  const layout = createDefaultStudioLayout();
  assert.equal(layout.schemaVersion, "crystra-dsh.studio-layout@1");
  assert.deepEqual(layout.columns, { desktop: 12, tablet: 6, mobile: 1 });
  assert.deepEqual(layout.panels.map(({ id, desktop, tablet, mobile }) => ({ id, desktop, tablet, mobile })), [
    { id: "operational-latency-ms", desktop: { w: 3, h: 2 }, tablet: { w: 3, h: 2 }, mobile: { w: 1, h: 2 } },
    { id: "delivery-cycle-time-ms", desktop: { w: 3, h: 2 }, tablet: { w: 3, h: 2 }, mobile: { w: 1, h: 2 } },
    { id: "operational-usage-availability", desktop: { w: 3, h: 2 }, tablet: { w: 3, h: 2 }, mobile: { w: 1, h: 2 } },
    { id: "task-cohort-comparison-eligibility", desktop: { w: 3, h: 2 }, tablet: { w: 3, h: 2 }, mobile: { w: 1, h: 2 } },
    { id: "role-template-rework-rate", desktop: { w: 6, h: 3 }, tablet: { w: 3, h: 3 }, mobile: { w: 1, h: 3 } },
    { id: "role-model-task-outcome-rate", desktop: { w: 6, h: 3 }, tablet: { w: 3, h: 3 }, mobile: { w: 1, h: 3 } },
    { id: "role-template-trajectory-partial-cost", desktop: { w: 3, h: 2 }, tablet: { w: 3, h: 2 }, mobile: { w: 1, h: 2 } },
    { id: "trajectory-partial-cost", desktop: { w: 3, h: 2 }, tablet: { w: 3, h: 2 }, mobile: { w: 1, h: 2 } },
    { id: "operational-attributable-cost", desktop: { w: 3, h: 2 }, tablet: { w: 3, h: 2 }, mobile: { w: 1, h: 2 } },
    { id: "delivery-stage-reach", desktop: { w: 12, h: 4 }, tablet: { w: 6, h: 4 }, mobile: { w: 1, h: 4 } },
    { id: "delivery-terminal-outcome-rate", desktop: { w: 12, h: 4 }, tablet: { w: 6, h: 4 }, mobile: { w: 1, h: 4 } },
    { id: "operational-token-usage", desktop: { w: 12, h: 4 }, tablet: { w: 6, h: 4 }, mobile: { w: 1, h: 4 } },
  ]);
  const theme = createCoreBiTheme(createStudioTheme("dark"));
  assert.deepEqual(theme, {
    mode: "dark",
    density: "compact",
    containerBorderStyle: "solid",
    palette: {
      surface: {
        section: "var(--dsw-specific-sidebar-fill)",
        panel: "var(--dsw-alias-bg-layer-1)",
        raised: "var(--dsw-alias-bg-layer-2)",
        inset: "var(--dsw-alias-bg-base)",
      },
      content: {
        primary: "var(--dsw-alias-label-primary)",
        secondary: "var(--dsw-alias-label-secondary)",
        muted: "var(--dsw-alias-label-dimmed)",
        inverse: "var(--dsw-alias-label-primary-inverted)",
      },
      border: {
        default: "var(--dsw-alias-border-l2)",
        strong: "var(--dsw-alias-border-l3)",
      },
      interaction: {
        accent: "var(--dsw-alias-state-business-primary)",
        selection: "var(--dsw-alias-interactive-bg-active)",
        disabled: "var(--dsw-alias-label-dimmed)",
        focusRing: "var(--dsw-alias-state-business-primary)",
      },
      status: {
        available: "var(--dsw-alias-state-success-primary)",
        attention: "var(--dsw-alias-state-warning-primary)",
        unavailable: "var(--dsw-alias-label-dimmed)",
        expired: "var(--dsw-alias-state-warn-label)",
        incompatible: "var(--dsw-alias-state-error-secondary)",
        error: "var(--dsw-alias-state-error-primary)",
      },
      data: [
        "var(--dsw-alias-state-business-primary)",
        "var(--dsw-alias-state-success-primary)",
        "var(--dsw-alias-state-warning-primary)",
        "var(--dsw-alias-state-error-primary)",
      ],
    },
    typography: {
      fontFamily: "var(--dsw-font-family)",
      codeFontFamily: "var(--dsw-font-family-mono)",
      h1: "18px",
      h2: "13px",
      subtitle1: "13px",
      body1: "11px",
      body2: "10px",
      caption: "9px",
      overline: "8px",
    },
  });
});

test("the Host owns dashboard add, remove, resize, and reorder state", () => {
  const initial = createStudioDashboardState(["latency", "rework", "reach"]);
  const resized = reduceStudioDashboardState(initial, {
    type: "RESIZE",
    panelId: "rework",
    size: "wide",
  });
  const moved = reduceStudioDashboardState(resized, {
    type: "MOVE",
    panelId: "reach",
    beforePanelId: "latency",
  });
  const removed = reduceStudioDashboardState(moved, {
    type: "REMOVE",
    panelId: "rework",
  });
  const restored = reduceStudioDashboardState(removed, {
    type: "ADD",
    panelId: "rework",
  });

  assert.deepEqual(restored.order, ["reach", "latency", "rework"]);
  assert.deepEqual(restored.hidden, []);
  assert.equal(restored.sizes.rework, "wide");
  assert.throws(
    () => reduceStudioDashboardState(restored, { type: "RESIZE", panelId: "missing", size: "wide" }),
    /UNKNOWN_STUDIO_PANEL/,
  );
});

test("dashboard edit state supports preset, reset, save, and fail-closed restore", () => {
  const writes = new Map();
  const storage = {
    getItem(key) { return writes.get(key) ?? null; },
    setItem(key, value) { writes.set(key, value); },
  };
  const initial = createStudioDashboardState(["latency", "rework"]);
  const changed = reduceStudioDashboardState(
    reduceStudioDashboardState(initial, { type: "REMOVE", panelId: "rework" }),
    { type: "RESIZE", panelId: "latency", size: "full" },
  );
  const store = createStudioLayoutStore(storage);
  store.save(changed);
  assert.deepEqual(store.load(initial), changed);
  assert.deepEqual(
    reduceStudioDashboardState(changed, { type: "PRESET", preset: "default" }),
    initial,
  );
  assert.deepEqual(reduceStudioDashboardState(changed, { type: "RESET" }), initial);

  writes.set("crystra.studio.dashboard-layout@1", "{malformed");
  assert.deepEqual(store.load(initial), initial);
});

test("the browser port uses only the DSH Host channel and exposes no downstream URL or credentials", async () => {
  const calls = [];
  const port = createStudioGatewayPort({
    connection: {
      rpc: {
        async call(channel, endpoint, payload, signal) {
          calls.push({ channel, endpoint, payload, signal });
          return { ok: true, value: { items: [] } };
        },
      },
    },
  });
  await port.call("tasks/list", { limit: 1 });
  assert.deepEqual(calls.map(({ channel, endpoint, payload }) => ({ channel, endpoint, payload })), [
    { channel: "/crystra-studio", endpoint: "tasks/list", payload: { limit: 1 } },
  ]);
  assert.doesNotMatch(JSON.stringify(port), /127\.0\.0\.1|Authorization|cookie/i);
});

test("Harness registration adds CRYSTRA Studio as the native conversation tab immediately after Delivery", () => {
  const registrations = [];
  const injected = [];
  const ctx = {
    connection: { rpc: { call: async () => ({ ok: true, value: {} }) } },
    slots: {
      inject(name, factory) {
        injected.push(name);
        factory();
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => undefined;
      },
    },
  };
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useEffect() {},
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const runtime = createStudioClientPlugin({ React, Bi }).apply(ctx);
  assert.deepEqual(injected, ["conversation.view"]);
  assert.deepEqual(registrations.map(({ options }) => options), [{
    name: "conversation.view", id: "crystra-studio", order: 30, label: "CRYSTRA Studio",
  }]);
  assert.equal(typeof runtime.controller.getSnapshot, "function");
  assert.ok(registrations.every(({ options }) => !["sidebar.footer.action", "shell.overlay", "sidebar.workspaces"].includes(options.name)));
});

test("the Studio shell advertises one Evaluate route and complete keyboard/screen-reader landmarks", () => {
  const model = studioAccessibilityModel();
  assert.deepEqual(model.routes, ["Evaluate"]);
  assert.deepEqual(STUDIO_PAGES, [{ id: "evaluate", label: "Evaluate", routePrefix: "/evaluate" }]);
  assert.deepEqual(model.landmarks, ["region", "navigation", "main"]);
  assert.equal(model.surface, "conversation-view");
  assert.equal(model.modal, false);
  assert.equal("closeKey" in model, false);
  assert.equal("focusReturnsToTrigger" in model, false);
  assert.equal(model.liveRegions.loading, "polite");
  assert.equal(model.liveRegions.error, "assertive");
  assert.equal(model.minimumTargetPixels, 44);
  assert.equal(JSON.stringify(model).includes("Builder"), false);
  assert.equal(JSON.stringify(model).includes("improvement"), false);
  assert.deepEqual(STUDIO_TRACE_VIEWS, [
    { id: "waterfall", label: "Waterfall", renderer: "TraceWaterfall", note: "Exact span timing" },
    { id: "tree", label: "Tree", renderer: "TraceTree", note: "Deterministic geometry · depth → recorded start/end → Span ID" },
    { id: "statistics", label: "Statistics", renderer: "TraceStatistics", note: "Exact inventory · recorded-time aggregates · no inferred causality" },
  ]);
});

test("the native Studio tab exposes a non-modal Evidence view without Session repository context", () => {
  const components = new Map();
  const ctx = {
    connection: { rpc: { call: async () => ({ ok: true, value: {} }) } },
    slots: {
      inject(_name, factory) { factory(); },
      register(options, component) {
        components.set(options.name, component);
        return () => components.delete(options.name);
      },
    },
  };
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useEffect() {},
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const Primitives = { Button: "dsh-button", Input: "dsh-input", DisclosureRow: "dsh-disclosure", JsonTree: "dsh-json-tree", Pill: "dsh-pill", StateDot: "dsh-state-dot" };
  const runtime = createStudioClientPlugin({ React, Primitives, Bi, sharedStyles: ".crystra-bi{}", initialContext: { taskId: "task-a" } }).apply(ctx);
  assert.equal(typeof runtime, "function");
  const rendered = components.get("conversation.view")({ sessionId: "session-a" });
  const text = textOf(rendered);
  const inputs = elementsOf(rendered).filter((element) => element.type === "input" || element.type === "dsh-input");
  assert.match(text, /Evaluate/);
  assert.match(text, /Single/);
  assert.match(text, /Compare/);
  assert.match(text, /Use recent selection/);
  assert.match(text, /Load tasks/);
  assert.match(text, /Evaluate selection/);
  assert.match(text, /Filters/);
  assert.match(text, /Clear/);
  assert.equal(inputs.some(({ props }) => props["aria-label"] === "Repository"), false);
  assert.equal(inputs.some(({ props }) => props.type === "radio"), false);
  const modeButtons = elementsOf(rendered).filter((element) =>
    ["Single", "Compare"].includes(textOf(element)) && element.props?.appearance === "segment");
  assert.deepEqual(modeButtons.map((element) => textOf(element)), ["Single", "Compare"]);
  assert.equal(modeButtons.every((element) => element.props.type === "button"), true);
  assert.doesNotMatch(text, /Builder|improvement/i);
  const view = elementsOf(rendered).find((element) => element.props?.["data-crystra-studio-view"] === "evaluate");
  assert.equal(view.props.role, "region");
  assert.equal(view.props["aria-modal"], undefined);
  assert.equal(view.props.id, "crystra-studio-view");
  const elements = elementsOf(rendered);
  const coreStyles = elements.filter((element) => element.props?.["data-crystra-bi-styles"] === "crystra-ui-core@0.1.0");
  assert.equal(coreStyles.length, 1);
  assert.equal(textOf(coreStyles[0]), ".crystra-bi{}");
  const main = elements.find((element) => element.props?.["data-crystra-studio-region"] === "main");
  assert.equal(main.props["data-crystra-studio-page"], "selection");
  assert.equal(elements.some((element) => element.props?.["data-crystra-studio-region"] === "footer"), false);
  assert.equal(elements.some((element) => element.props?.["data-crystra-selection-browser"] === "task-population"), true);
  assert.equal(elements.some((element) => element.type === "fieldset"), false);
  assert.equal(elements.some((element) => element.type === "nav" && element.props?.["aria-label"] === "Studio views"), true);
  assert.match(text, /Select.*Dashboard.*Evidence.*Recorded Trace/s);
  assert.equal(Object.hasOwn(runtime.controller.getSnapshot(), "repository"), false);
  assert.equal(Object.hasOwn(runtime.controller.getSnapshot(), "workspaceId"), false);
  assert.ok(elements.some((element) => element.type === "crystra-button"));
  assert.equal(view.props.onKeyDown, undefined);
  assert.equal(components.has("shell.overlay"), false);
  assert.equal(components.has("sidebar.footer.action"), false);
});

test("AVAILABLE and UNAVAILABLE results use focused dashboard panels without raw JSON", async () => {
  const components = new Map();
  const result = {
    api_version: 1,
    mode: "SINGLE",
    result: {
      tag: "SIDE_RESULT",
      receipt: { selection: { selection_version: 1, task_ids: ["task-a"] } },
      metric_results: [
        {
          metric_id: "delivery-success-rate",
          metric_version: "2.0.0",
          slices: [{ slice_key: {}, state: "AVAILABLE", value: { kind: "RATIO", value: "3/4", unit: "ratio" }, measures: {}, coverage: null, compatibility: {}, exclusions: [], missing_inputs: [], provenance_refs: [] }],
        },
        {
          metric_id: "workflow-resolution-rate",
          metric_version: "2.0.0",
          slices: [{ slice_key: {}, state: "UNAVAILABLE", withholding_reason: "MISSING_INPUT", measures: {}, coverage: null, compatibility: {}, exclusions: [], missing_inputs: ["workflow_snapshot"], provenance_refs: [] }],
        },
      ],
    },
  };
  const ctx = {
    connection: { rpc: { call: async () => ({ ok: true, value: result }) } },
    slots: {
      inject(_name, factory) { factory(); },
      register(options, component) {
        components.set(options.name, component);
        return () => components.delete(options.name);
      },
    },
  };
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useEffect() {},
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const Primitives = { Button: "dsh-button", JsonTree: "dsh-json-tree" };
  const runtime = createStudioClientPlugin({ React, Primitives, Bi, initialContext: { taskId: "task-a" } }).apply(ctx);
  await runtime.controller.evaluate();

  const rendered = components.get("conversation.view")();
  const elements = elementsOf(rendered);
  const panels = elements.filter((element) => element.type === "crystra-dashboard-metric-panel");
  assert.equal(elements.some((element) => element.type === "crystra-bi-surface"), true);
  assert.deepEqual(panels.map((panel) => panel.props.visualizer), [undefined, undefined]);
  assert.deepEqual(panels.map((panel) => panel.props.result.metric_id), [
    "delivery-success-rate",
    "workflow-resolution-rate",
  ]);
  assert.equal(elements.some((element) => element.type === "dsh-json-tree"), false);
  assert.doesNotMatch(textOf(rendered), /Technical JSON details/);
  assert.equal(elements.some((element) => element.props?.["data-crystra-studio-page"] === "dashboard"), true);
  assert.equal(elements.some((element) => element.props?.["data-crystra-studio-page"] === "selection"), false);
  assert.equal(elements.some((element) => element.type === "details" && textOf(element).includes("Change evaluation")), false);
  assert.equal(elements.some((element) => element.type === "crystra-button" && textOf(element) === "Change evaluation"), true);
  assert.equal(elements.some((element) => element.type === "nav" && element.props["aria-label"] === "Studio views"), true);
  assert.match(textOf(rendered), /Dashboard/);
  assert.match(textOf(rendered), /Evidence/);
  assert.match(textOf(rendered), /Recorded Trace/);
  const regions = elements.filter((element) => element.props?.["data-crystra-studio-region"]);
  assert.deepEqual(regions.map((element) => element.props["data-crystra-studio-region"]), ["header", "main", "footer"]);
  const surface = elements.find((element) => element.type === "crystra-bi-surface");
  assert.deepEqual(surface.props.theme, createStudioTheme("light"));
  assert.equal(elements.some((element) => element.props?.["data-crystra-dashboard-layout"] === "crystra-dsh.studio-layout@1"), true);
});

test("all four Studio navigation items expose real handlers and exact-target availability", async () => {
  const components = new Map();
  const result = {
    api_version: 1,
    mode: "SINGLE",
    result: {
      tag: "SIDE_RESULT",
      receipt: { selection: { selection_version: 1, task_ids: ["task-a"] } },
      metric_results: [{ metric_id: "delivery-cycle-time-ms", metric_version: "2.0.0", slices: [] }],
    },
  };
  const ctx = {
    connection: { rpc: { call: async (_channel, endpoint) => endpoint === "evaluations/compute"
      ? { ok: true, value: result }
      : { ok: true, value: { items: [] } } } },
    slots: {
      inject(_name, factory) { factory(); },
      register(options, component) { components.set(options.name, component); return () => undefined; },
    },
  };
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useEffect() {},
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const runtime = createStudioClientPlugin({ React, Primitives: { Button: "button" }, Bi, initialContext: { taskId: "task-a" } }).apply(ctx);
  await runtime.controller.evaluate();

  const navigation = () => elementsOf(components.get("conversation.view")())
    .filter((element) => element.type === "crystra-button" && ["Select", "Dashboard", "Evidence", "Recorded Trace"].includes(textOf(element)));
  let buttons = Object.fromEntries(navigation().map((button) => [textOf(button), button]));
  assert.deepEqual(Object.keys(buttons), ["Select", "Dashboard", "Evidence", "Recorded Trace"]);
  assert.equal(buttons.Select.props.disabled, false);
  assert.equal(buttons.Dashboard.props.disabled, false);
  assert.equal(typeof buttons.Select.props.onClick, "function");
  assert.equal(typeof buttons.Dashboard.props.onClick, "function");
  assert.equal(buttons.Evidence.props.disabled, true);
  assert.equal(buttons.Evidence.props["data-unavailable-reason"], "EXACT_EVIDENCE_TARGET_NOT_ESTABLISHED");
  assert.equal(buttons["Recorded Trace"].props.disabled, true);
  assert.equal(buttons["Recorded Trace"].props["data-unavailable-reason"], "EXACT_TRACE_TARGET_NOT_ESTABLISHED");

  runtime.controller.openFacts("delivery-cycle-time-ms@2.0.0", "result");
  buttons = Object.fromEntries(navigation().map((button) => [textOf(button), button]));
  assert.equal(buttons.Evidence.props.disabled, false);
  assert.equal(typeof buttons.Evidence.props.onClick, "function");
  buttons.Dashboard.props.onClick();
  buttons = Object.fromEntries(navigation().map((button) => [textOf(button), button]));
  buttons.Evidence.props.onClick();
  assert.deepEqual(runtime.controller.getSnapshot().route, {
    page: "facts",
    selection: { mode: "single", taskIds: ["task-a"] },
    metric: "delivery-cycle-time-ms@2.0.0",
    scope: "result",
  });

  const traceId = "a".repeat(32);
  const spanId = "b".repeat(16);
  runtime.controller.openTrace(traceId, spanId);
  runtime.controller.backToResults();
  buttons = Object.fromEntries(navigation().map((button) => [textOf(button), button]));
  assert.equal(buttons["Recorded Trace"].props.disabled, false);
  assert.equal(typeof buttons["Recorded Trace"].props.onClick, "function");
  buttons["Recorded Trace"].props.onClick();
  assert.deepEqual(runtime.controller.getSnapshot().route, {
    page: "trace",
    selection: { mode: "single", taskIds: ["task-a"] },
    traceId,
    spanId,
  });
});

test("failed exact drill-down remains typed unavailable and does not guess another target", async () => {
  const components = new Map();
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useEffect() {},
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const ctx = {
    connection: { rpc: { call: async () => ({ ok: false, error: { code: "downstream-unavailable", message: "Trace unavailable" } }) } },
    slots: {
      inject(_name, factory) { factory(); },
      register(options, component) { components.set(options.name, component); return () => undefined; },
    },
  };
  const runtime = createStudioClientPlugin({ React, Primitives: { Button: "button" }, Bi, initialContext: { taskId: "task-a" } }).apply(ctx);
  const exactTraceId = "c".repeat(32);
  runtime.controller.openTrace(exactTraceId);
  await runtime.controller.loadTrace({ trace_id: exactTraceId, limit: 200 });
  runtime.controller.backToResults();
  const traceButton = elementsOf(components.get("conversation.view")())
    .find((element) => element.type === "crystra-button" && textOf(element) === "Recorded Trace");
  assert.equal(traceButton.props.disabled, true);
  assert.equal(traceButton.props["data-unavailable-reason"], "EXACT_TRACE_TARGET_UNAVAILABLE");
  assert.equal(runtime.controller.getSnapshot().exactTargets.trace.traceId, exactTraceId);
});

test("compare, receipt, Fact and recorded Trace routes use shared BI foundations", async () => {
  const components = new Map();
  const traceId = "a".repeat(32);
  const spanId = "b".repeat(16);
  const slice = { slice_key: {}, state: "AVAILABLE", value: { kind: "DURATION_MS", value: "12", unit: "ms" }, measures: {}, coverage: null, compatibility: {}, exclusions: [], missing_inputs: [], provenance_refs: [] };
  const side = (taskId) => ({
    tag: "SIDE_RESULT",
    receipt: { selection: { selection_version: 1, task_ids: [taskId] } },
    metric_results: [{ metric_id: "delivery-cycle-time-ms", metric_version: "2.0.0", slices: [slice] }],
  });
  const comparison = {
    api_version: 1,
    mode: "COMPARE",
    status: "FULL_COMPARE",
    left: side("task-a"),
    right: side("task-b"),
    deltas: [{
      metric_coordinate: "delivery-cycle-time-ms@2.0.0",
      slice_key: {},
      state: "AVAILABLE",
      direction: "NO_CHANGE",
      value: { kind: "DURATION_MS", value: "0", unit: "ms" },
    }],
  };
  const fact = {
    id: "fact-1",
    kind: "EVENT_CONTRIBUTION",
    source: { kind: "SPAN", trace_id: traceId, span_id: spanId },
    provenance: { accepted_digest: "sha256:fact" },
    compatibility: { dimensions: [], event_name: null, family_schema: null },
    truth: { completeness: "FINAL", availability: "AVAILABLE", expiry: "ACTIVE", expires_at: null },
  };
  const traceItem = {
    id: "trace-node-1",
    kind: "NODE",
    trace_id: traceId,
    node: { span_id: spanId, span_name: "Evaluate", span_kind: "INTERNAL", span_status: "OK" },
  };
  const ctx = {
    connection: { rpc: { call: async (_channel, endpoint) => ({
      ok: true,
      value: endpoint === "evaluations/compute" ? comparison
        : endpoint === "facts/read" ? { items: [fact] }
          : { items: [traceItem] },
    }) } },
    slots: {
      inject(_name, factory) { factory(); },
      register(options, component) { components.set(options.name, component); return () => undefined; },
    },
  };
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useEffect() {},
    useState(initial) { return [typeof initial === "function" ? initial() : initial, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const runtime = createStudioClientPlugin({ React, Primitives: { Button: "button" }, Bi }).apply(ctx);
  runtime.controller.setSelection({ mode: "compare", leftTaskIds: ["task-a"], rightTaskIds: ["task-b"] });
  await runtime.controller.evaluate();

  let rendered = components.get("conversation.view")();
  assert.equal(elementsOf(rendered).some((element) => element.type === "crystra-compare-result"), true);

  runtime.controller.openReceipt();
  rendered = components.get("conversation.view")();
  assert.equal(elementsOf(rendered).filter((element) => element.type === "crystra-receipt-view").length, 2);

  runtime.controller.openFacts("delivery-cycle-time-ms@2.0.0");
  await runtime.controller.loadFacts({ delivery_id: "delivery-a", limit: 200 });
  rendered = components.get("conversation.view")();
  const evidence = elementsOf(rendered).find((element) => element.type === "crystra-evidence-console");
  assert.equal(evidence.props.rows[0].factId, "fact-1");
  assert.equal(evidence.props.rows[0].trace.traceId, traceId);

  runtime.controller.openTrace(traceId, spanId);
  await runtime.controller.loadTrace({ trace_id: traceId, limit: 200 });
  rendered = components.get("conversation.view")();
  const traceRenderer = elementsOf(rendered).find((element) => element.type === "crystra-trace-waterfall");
  assert.equal(traceRenderer !== undefined, true);
  assert.equal(elementsOf(rendered).some((element) => element.type === "crystra-metric-panel"), false);
  assert.equal(elementsOf(rendered).some((element) => element.type === "crystra-compare-result"), false);
  const hierarchy = elementsOf(rendered).find((element) => element.props?.["data-studio-trace-hierarchy"] === "navigation-header-content");
  assert.match(textOf(hierarchy.children[1]), /Waterfall/);
  assert.match(textOf(hierarchy.children[1]), /Tree/);
  assert.match(textOf(hierarchy.children[1]), /Statistics/);
  assert.equal(hierarchy.children[2], traceRenderer);
  assert.equal(traceRenderer.props.viewNavigation, undefined);
});

test("the browser source has no direct downstream transport, credential, or mutation escape hatch", async () => {
  const root = resolve(import.meta.dirname, "../src/client");
  const source = `${await readFile(resolve(root, "studio.js"), "utf8")}\n${await readFile(resolve(root, "evaluate-model.js"), "utf8")}`;
  assert.doesNotMatch(source, /\bfetch\s*\(/u);
  assert.doesNotMatch(source, /127\.0\.0\.1|localhost|\/v1\/evidence|evaluations:compute/u);
  assert.doesNotMatch(source, /Authorization|Cookie|credentials/u);
  assert.doesNotMatch(source, /facts\/(?:write|delete)|traces\/(?:write|delete)|repository\/(?:write|commit)/u);
  assert.doesNotMatch(source, /function\s+(?:visualizerFor|metricResultCompatible|traceViewModel)\b/u);
  assert.doesNotMatch(source, /projectRecordedStructure/u);
  assert.doesNotMatch(source, /\.crystra-bi\s+[.#[]/u);
});

test("the Host trace assembly preserves the frozen page-family action and segmented navigation grammar", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../src/client/studio.js"), "utf8");
  assert.match(source, /className:\s*"studio-trace-view-switcher"/u);
  assert.match(source, /className:\s*"studio-trace-view-navigation"/u);
  assert.match(source, /className:\s*"studio-trace-view-note"/u);
  assert.match(source, /"Open Evidence"/u);
  assert.match(source, /"Copy trace identity"/u);
  assert.match(source, /appearance:\s*"outline"[\s\S]{0,300}"Back to Dashboard"/u);
  assert.match(source, /appearance:\s*"outline"[\s\S]{0,500}"Open Evidence"/u);
  assert.match(source, /appearance:\s*"solid",\s*tone:\s*"primary"[\s\S]{0,300}"Copy trace identity"/u);
  assert.match(source, /aria-label":\s*"Trace renderer views"/u);
  assert.match(source, /\.studio-product-row \.studio-controls > button \{ flex:1 1 0; min-width:0/u);
  assert.match(source, /\.studio-page-copy p \{[^}]*overflow-wrap:anywhere;[^}]*white-space:normal/u);
});

test("the Host theme maps Core surfaces directly to DSH semantic background aliases", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../src/client/studio.js"), "utf8");
  assert.match(source, /section:\s*"var\(--dsw-specific-sidebar-fill\)"/u);
  assert.match(source, /panel:\s*"var\(--dsw-alias-bg-layer-1\)"/u);
  assert.match(source, /raised:\s*"var\(--dsw-alias-bg-layer-2\)"/u);
  assert.match(source, /inset:\s*"var\(--dsw-alias-bg-base\)"/u);
  assert.doesNotMatch(source, /#crystra-studio-view \{[^}]*--crystra-surface-/u);
  assert.doesNotMatch(source, /--studio-(?:surface|raised|filter-surface):color-mix/u);
});

test("the packaged browser entry wires every Core design-system asset consumed by the Host", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../src/client/browser-entry.js"), "utf8");
  for (const asset of ["Button", "ButtonGroup", "DashboardMetricPanel", "StatusBadge", "Surface", "TextInput", "Typography"]) {
    assert.match(source, new RegExp(`\\b${asset}\\b`, "u"));
  }
});

test("Dashboard uses focused business panels and does not render result JSON or duplicate delta prose", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../src/client/studio.js"), "utf8");
  assert.match(source, /React\.createElement\(Bi\.DashboardMetricPanel/u);
  assert.doesNotMatch(source, /Evaluation result JSON/u);
  assert.doesNotMatch(source, /presentation\.deltas\.map\(\(delta\) => React\.createElement\("p"/u);
});

test("the Select page composes Core semantic assets and keeps only Host layout grammar", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../src/client/studio.js"), "utf8");
  assert.match(source, /\.studio-selection-filter \{ display:grid; grid-template-columns:minmax\(0,1fr\) auto/u);
  assert.doesNotMatch(source, /\.studio-selection-filter input \{/u);
  assert.doesNotMatch(source, /\.studio-task-state \{/u);
  assert.match(source, /\.studio-task-row:last-child \{ border-bottom:0; \}/u);
  assert.match(source, /React\.createElement\(ButtonGroup, \{ segmented: true, className: "studio-mode"/u);
  assert.match(source, /React\.createElement\(TextInput, \{[^}]*inputKind: "search"/u);
  assert.match(source, /React\.createElement\(StatusBadge, \{ status: current\.includes\(task\.task_id\) \? "selected" : "available"/u);
  assert.match(source, /h2:\s*"13px"/u);
  assert.match(source, /caption:\s*"9px"/u);
  assert.match(source, /--crystra-shape-panel:10px/u);
  assert.match(source, /panel:\s*"var\(--dsw-alias-bg-layer-1\)"/u);
});

test("Single mode replaces the selected Task instead of accumulating a population", () => {
  assert.deepEqual(reduceSingleTaskSelection([], "task-a", true), { mode: "single", taskIds: ["task-a"] });
  assert.deepEqual(reduceSingleTaskSelection(["task-a"], "task-b", true), { mode: "single", taskIds: ["task-b"] });
  assert.equal(reduceSingleTaskSelection(["task-a"], "task-a", false), undefined);
});
