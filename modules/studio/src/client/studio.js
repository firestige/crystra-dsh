import { createEvaluateController, projectStudioPresentation } from "./evaluate-model.js";

export const STUDIO_PAGES = Object.freeze([
  Object.freeze({ id: "evaluate", label: "Evaluate", routePrefix: "/evaluate" }),
]);

export const STUDIO_TRACE_VIEWS = Object.freeze([
  Object.freeze({ id: "waterfall", label: "Waterfall", renderer: "TraceWaterfall", note: "Exact span timing" }),
  Object.freeze({ id: "tree", label: "Tree", renderer: "TraceTree", note: "Deterministic geometry · depth → recorded start/end → Span ID" }),
]);

const ACCESSIBILITY = Object.freeze({
  routes: Object.freeze(STUDIO_PAGES.map((page) => page.label)),
  surface: "conversation-view",
  modal: false,
  landmarks: Object.freeze(["region", "navigation", "main"]),
  liveRegions: Object.freeze({ loading: "polite", error: "assertive" }),
  minimumTargetPixels: 44,
});

export function studioAccessibilityModel() {
  return ACCESSIBILITY;
}

export function createStudioGatewayPort(ctx) {
  return Object.freeze({
    call(endpoint, payload, signal) {
      return ctx.connection.rpc.call("/crystra-studio", endpoint, payload, signal);
    },
  });
}

const viewStyle = {
  width: "100%", minHeight: "100%", overflow: "auto",
  color: "var(--dsw-alias-label-primary)", background: "var(--dsw-alias-bg-base)",
  padding: "clamp(11px, 2vw, 24px)", paddingBottom: "clamp(120px, 18vh, 180px)", boxSizing: "border-box",
};
const controlStyle = { minHeight: "44px", minWidth: "44px" };
const listStyle = { maxHeight: "min(42vh, 480px)", overflow: "auto", overflowWrap: "anywhere" };

const DEFAULT_LAYOUT = Object.freeze({
  schemaVersion: "crystra-dsh.studio-layout@1",
  columns: Object.freeze({ desktop: 12, tablet: 6, mobile: 1 }),
  panels: Object.freeze([
    ["operational-latency-ms", 3, 2, 3, 2, 1, 2],
    ["delivery-cycle-time-ms", 3, 2, 3, 2, 1, 2],
    ["operational-usage-availability", 3, 2, 3, 2, 1, 2],
    ["task-cohort-comparison-eligibility", 3, 2, 3, 2, 1, 2],
    ["role-template-rework-rate", 6, 3, 3, 3, 1, 3],
    ["role-model-task-outcome-rate", 6, 3, 3, 3, 1, 3],
    ["role-template-trajectory-partial-cost", 3, 2, 3, 2, 1, 2],
    ["trajectory-partial-cost", 3, 2, 3, 2, 1, 2],
    ["operational-attributable-cost", 3, 2, 3, 2, 1, 2],
    ["delivery-stage-reach", 12, 4, 6, 4, 1, 4],
    ["delivery-terminal-outcome-rate", 12, 4, 6, 4, 1, 4],
    ["operational-token-usage", 12, 4, 6, 4, 1, 4],
  ].map(([id, dw, dh, tw, th, mw, mh]) => Object.freeze({
    id,
    desktop: Object.freeze({ w: dw, h: dh }),
    tablet: Object.freeze({ w: tw, h: th }),
    mobile: Object.freeze({ w: mw, h: mh }),
  }))),
});
const DASHBOARD_STORAGE_KEY = "crystra.studio.dashboard-layout@1";

export function createDefaultStudioLayout() {
  return DEFAULT_LAYOUT;
}

export function createStudioTheme(mode) {
  if (mode !== "light" && mode !== "dark") throw new Error("UNKNOWN_STUDIO_THEME");
  return Object.freeze({
    mode,
    density: "compact",
    containerBorderStyle: "solid",
    palette: Object.freeze({
      surface: Object.freeze({
        section: "var(--dsw-specific-sidebar-fill)",
        panel: "var(--dsw-alias-bg-layer-1)",
        raised: "var(--dsw-alias-bg-layer-2)",
        inset: "var(--dsw-alias-bg-base)",
      }),
      content: Object.freeze({
        primary: "var(--dsw-alias-label-primary)",
        secondary: "var(--dsw-alias-label-secondary)",
        muted: "var(--dsw-alias-label-dimmed)",
        inverse: "var(--dsw-alias-label-primary-inverted)",
      }),
      border: Object.freeze({
        default: "var(--dsw-alias-border-l2)",
        strong: "var(--dsw-alias-border-l3)",
      }),
      interaction: Object.freeze({
        accent: "var(--dsw-alias-state-business-primary)",
        selection: "var(--dsw-alias-interactive-bg-active)",
        disabled: "var(--dsw-alias-label-dimmed)",
        focusRing: "var(--dsw-alias-state-business-primary)",
      }),
      status: Object.freeze({
        available: "var(--dsw-alias-state-success-primary)",
        attention: "var(--dsw-alias-state-warning-primary)",
        unavailable: "var(--dsw-alias-label-dimmed)",
        expired: "var(--dsw-alias-state-warn-label)",
        incompatible: "var(--dsw-alias-state-error-secondary)",
        error: "var(--dsw-alias-state-error-primary)",
      }),
      data: Object.freeze([
        "var(--dsw-alias-state-business-primary)",
        "var(--dsw-alias-state-success-primary)",
        "var(--dsw-alias-state-warning-primary)",
        "var(--dsw-alias-state-error-primary)",
      ]),
    }),
    typography: Object.freeze({
      fontFamily: "var(--dsw-font-family)",
      codeFontFamily: "var(--dsw-font-family-mono)",
      h1: "18px",
      h2: "13px",
      subtitle1: "13px",
      body1: "11px",
      body2: "10px",
      caption: "9px",
      overline: "8px",
    }),
  });
}

export function createStudioDashboardState(panelIds) {
  if (!Array.isArray(panelIds) || new Set(panelIds).size !== panelIds.length ||
      !panelIds.every((id) => typeof id === "string" && id.length > 0)) {
    throw new Error("INVALID_STUDIO_PANELS");
  }
  return Object.freeze({
    defaults: Object.freeze([...panelIds]),
    order: Object.freeze([...panelIds]),
    hidden: Object.freeze([]),
    sizes: Object.freeze({}),
  });
}

export function reduceStudioDashboardState(state, action) {
  if (action.type === "RESET" || action.type === "PRESET") {
    if (action.type === "PRESET" && action.preset !== "default") throw new Error("UNKNOWN_STUDIO_LAYOUT_PRESET");
    return createStudioDashboardState(state.defaults);
  }
  const known = state.order.includes(action.panelId);
  if (!known) throw new Error("UNKNOWN_STUDIO_PANEL");
  if (action.type === "REMOVE") return Object.freeze({
    ...state,
    hidden: Object.freeze([...new Set([...state.hidden, action.panelId])]),
  });
  if (action.type === "ADD") return Object.freeze({
    ...state,
    hidden: Object.freeze(state.hidden.filter((id) => id !== action.panelId)),
  });
  if (action.type === "RESIZE") {
    if (!["compact", "wide", "full"].includes(action.size)) throw new Error("UNKNOWN_STUDIO_PANEL_SIZE");
    return Object.freeze({ ...state, sizes: Object.freeze({ ...state.sizes, [action.panelId]: action.size }) });
  }
  if (action.type === "MOVE") {
    if (!state.order.includes(action.beforePanelId)) throw new Error("UNKNOWN_STUDIO_PANEL");
    const order = state.order.filter((id) => id !== action.panelId);
    order.splice(order.indexOf(action.beforePanelId), 0, action.panelId);
    return Object.freeze({ ...state, order: Object.freeze(order) });
  }
  throw new Error("UNKNOWN_STUDIO_LAYOUT_ACTION");
}

function validDashboardState(value) {
  const uniqueStrings = (items) => Array.isArray(items) &&
    items.every((item) => typeof item === "string" && item.length > 0) &&
    new Set(items).size === items.length;
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    uniqueStrings(value.defaults) && uniqueStrings(value.order) && uniqueStrings(value.hidden) &&
    value.defaults.every((id) => value.order.includes(id)) &&
    value.hidden.every((id) => value.order.includes(id)) &&
    value.sizes !== null && typeof value.sizes === "object" && !Array.isArray(value.sizes) &&
    Object.entries(value.sizes).every(([id, size]) => value.order.includes(id) && ["compact", "wide", "full"].includes(size));
}

export function createStudioLayoutStore(storage) {
  return Object.freeze({
    load(fallback) {
      if (storage === undefined) return fallback;
      try {
        const encoded = storage.getItem(DASHBOARD_STORAGE_KEY);
        if (encoded === null) return fallback;
        const parsed = JSON.parse(encoded);
        if (!validDashboardState(parsed)) return fallback;
        return Object.freeze({
          defaults: Object.freeze([...parsed.defaults]),
          order: Object.freeze([...parsed.order]),
          hidden: Object.freeze([...parsed.hidden]),
          sizes: Object.freeze({ ...parsed.sizes }),
        });
      } catch {
        return fallback;
      }
    },
    save(state) {
      if (!validDashboardState(state)) throw new Error("INVALID_STUDIO_LAYOUT_STATE");
      storage?.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(state));
    },
  });
}

const hostStyles = `
#crystra-studio-view { --crystra-shape-panel:10px; --crystra-shape-control:7px; }
#crystra-studio-view, #crystra-studio-view > *, #crystra-studio-view .studio-page-copy { min-width:0; max-width:100%; }
#crystra-studio-view [data-crystra-studio-region="header"] { overflow:hidden; }
#crystra-studio-view .studio-product-row, #crystra-studio-view .studio-page-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; }
#crystra-studio-view .studio-product-row { min-height:47px; padding-block:0; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-breadcrumbs, #crystra-studio-view .studio-controls { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
#crystra-studio-view .studio-breadcrumbs { color:var(--dsw-alias-label-secondary); font-size:10px; }
#crystra-studio-view .studio-page-copy h1, #crystra-studio-view .studio-page-copy p, #crystra-studio-view .studio-selection-copy { margin:2px 0; }
#crystra-studio-view .studio-page-copy p { max-width:67ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
#crystra-studio-view .studio-eyebrow { display:block; }
#crystra-studio-view .studio-product-row .studio-controls { align-self:stretch; gap:3px; }
#crystra-studio-view .studio-view-link { min-height:47px; padding-inline:11px; border:0; border-bottom:2px solid transparent; border-radius:0; background:transparent; color:var(--dsw-alias-label-secondary); }
#crystra-studio-view .studio-view-link[aria-current="page"] { border-color:var(--dsw-alias-state-business-primary,#79a6ff); background:linear-gradient(transparent,color-mix(in srgb,var(--dsw-alias-state-business-primary,#79a6ff) 7%,transparent)); color:var(--dsw-alias-state-business-primary,#79a6ff); }
#crystra-studio-view .studio-trace-view-switcher { width:fit-content; }
#crystra-studio-view .studio-trace-view-navigation { display:flex; width:100%; min-width:0; align-items:center; justify-content:space-between; gap:12px; }
#crystra-studio-view .studio-trace-view-note { margin-inline-start:auto; text-align:end; }
#crystra-studio-view [data-crystra-studio-region="main"] { margin-top:12px; }
#crystra-studio-view .studio-selection-grid { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(250px,.75fr); gap:12px; }
#crystra-studio-view .studio-selection-card { overflow:hidden; }
#crystra-studio-view .studio-selection-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-selection-filter { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; padding:8px; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-selection-filter .crystra-input { width:100%; }
#crystra-studio-view .studio-filter-options { display:flex; gap:5px; grid-column:1/-1; }
#crystra-studio-view .studio-filter-options button[aria-pressed="true"] { border-color:var(--dsw-alias-state-business-primary,#7199e7); color:var(--dsw-alias-state-business-primary,#7199e7); }
#crystra-studio-view .studio-task-list { display:grid; max-height:min(50vh,520px); margin:0; padding:5px 8px 9px; overflow:auto; list-style:none; }
#crystra-studio-view .studio-task-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; min-height:52px; gap:10px; padding:8px; border-bottom:1px solid var(--dsw-alias-border-l2); }
#crystra-studio-view .studio-task-row:last-child { border-bottom:0; }
#crystra-studio-view .studio-task-row label { display:flex; align-items:center; gap:9px; min-width:0; }
#crystra-studio-view .studio-task-row input[type="checkbox"] { width:17px; height:17px; margin:0; accent-color:var(--dsw-alias-state-business-primary,#7199e7); }
#crystra-studio-view .studio-task-id { display:block; overflow-wrap:anywhere; }
#crystra-studio-view .studio-selected-list { display:grid; gap:8px; padding:12px; }
#crystra-studio-view .studio-selected-item { padding:10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--studio-raised); }
#crystra-studio-view .studio-selected-item .crystra-typography { display:block; }
#crystra-studio-view [data-crystra-dashboard-layout] { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; }
#crystra-studio-view [data-crystra-dashboard-panel] { grid-column:span var(--studio-panel-desktop-columns,3); min-width:0; }
#crystra-studio-view [data-crystra-studio-region="footer"] { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:12px; padding:12px 14px; }
@media (max-width:900px) { #crystra-studio-view [data-crystra-dashboard-layout] { grid-template-columns:repeat(6,minmax(0,1fr)); } #crystra-studio-view [data-crystra-dashboard-panel] { grid-column:span var(--studio-panel-tablet-columns,3); } }
@media (max-width:700px) {
  #crystra-studio-view .studio-selection-grid { grid-template-columns:1fr; }
  #crystra-studio-view .studio-product-row, #crystra-studio-view .studio-page-row { align-items:flex-start; flex-direction:column; }
  #crystra-studio-view .studio-product-row .studio-controls { width:100%; flex-wrap:nowrap; overflow:hidden; }
  #crystra-studio-view .studio-product-row .studio-controls > button { flex:1 1 0; min-width:0; }
  #crystra-studio-view .studio-view-link { min-height:36px; padding-inline:2px; font-size:8px; }
  #crystra-studio-view .studio-page-row { gap:8px; padding:10px 12px; }
  #crystra-studio-view .studio-page-copy p { overflow-wrap:anywhere; white-space:normal; }
  #crystra-studio-view .studio-page-actions { width:100%; flex-wrap:nowrap; gap:5px; }
  #crystra-studio-view .studio-page-actions > button { min-height:32px; padding-inline:8px; font-size:9px; }
  #crystra-studio-view .studio-page-actions > button:nth-child(2) { display:none; }
  #crystra-studio-view .studio-trace-view-note { display:none; }
}
@media (max-width:560px) { #crystra-studio-view [data-crystra-dashboard-layout] { grid-template-columns:1fr; } #crystra-studio-view [data-crystra-dashboard-panel] { grid-column:span 1 !important; } }
`;

function platformThemeMode(explicitMode) {
  if (explicitMode === "light" || explicitMode === "dark") return explicitMode;
  if (typeof document !== "undefined" && document.body?.hasAttribute("data-ds-dark-theme")) return "dark";
  if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function studioPanelPlacement(panelId, size) {
  if (size === "full") return { desktop: 12, tablet: 6, mobile: 1 };
  if (size === "wide") return { desktop: 6, tablet: 6, mobile: 1 };
  if (size === "compact") return { desktop: 3, tablet: 3, mobile: 1 };
  const configured = DEFAULT_LAYOUT.panels.find(({ id }) => id === panelId);
  return configured === undefined
    ? { desktop: 3, tablet: 3, mobile: 1 }
    : { desktop: configured.desktop.w, tablet: configured.tablet.w, mobile: configured.mobile.w };
}

function sliceIdentity(sliceKey) {
  return JSON.stringify(Object.fromEntries(Object.entries(sliceKey ?? {}).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0)));
}

function metricSlice(side, coordinate, sliceKey) {
  if (side?.tag !== "SIDE_RESULT") return undefined;
  const split = coordinate.lastIndexOf("@");
  const metric = side.metric_results?.find((candidate) =>
    candidate.metric_id === coordinate.slice(0, split) &&
    candidate.metric_version === coordinate.slice(split + 1));
  const identity = sliceIdentity(sliceKey);
  return metric?.slices?.find((slice) => sliceIdentity(slice.slice_key) === identity);
}

function factRow(fact) {
  if (typeof fact?.id !== "string" || typeof fact.kind !== "string" ||
      typeof fact.provenance?.accepted_digest !== "string" ||
      !Array.isArray(fact.compatibility?.dimensions) ||
      typeof fact.truth?.availability !== "string") return undefined;
  const coordinates = Object.fromEntries(fact.compatibility.dimensions.map(({ field, value }) => [field, String(value)]));
  if (fact.compatibility.event_name !== null && fact.compatibility.event_name !== undefined) {
    coordinates.event_name = fact.compatibility.event_name;
  }
  if (fact.compatibility.family_schema !== null && fact.compatibility.family_schema !== undefined) {
    coordinates.family_schema = fact.compatibility.family_schema;
  }
  return {
    factId: fact.id,
    factClass: fact.kind,
    coordinates,
    provenance: fact.provenance.accepted_digest,
    truth: fact.truth,
    ...(fact.source?.kind === "SPAN" ? {
      trace: { traceId: fact.source.trace_id, spanId: fact.source.span_id },
    } : {}),
  };
}

export function reduceSingleTaskSelection(_current, taskId, checked) {
  return checked ? Object.freeze({ mode: "single", taskIds: Object.freeze([taskId]) }) : undefined;
}

function StudioView(React, Primitives, Bi, sharedStyles, controller, explicitThemeMode, layoutStorage) {
  const Button = Bi.Button;
  const ButtonGroup = Bi.ButtonGroup;
  const StatusBadge = Bi.StatusBadge;
  const Surface = Bi.Surface;
  const TextInput = Bi.TextInput;
  const Typography = Bi.Typography;
  const DisclosureRow = Primitives.DisclosureRow;
  const JsonTree = Primitives.JsonTree;
  return function StudioConversationView() {
    const [technicalDetailsOpen, setTechnicalDetailsOpen] = React.useState(false);
    const [traceView, setTraceView] = React.useState("waterfall");
    const [taskQuery, setTaskQuery] = React.useState("");
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    const [taskFilter, setTaskFilter] = React.useState("all");
    const [editingDashboard, setEditingDashboard] = React.useState(false);
    const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const [studioPage, setStudioPage] = React.useState(() =>
      snapshot.result !== undefined || ["receipt", "facts", "trace"].includes(snapshot.route.page)
        ? "dashboard"
        : "selection");
    const [selectionRequested, setSelectionRequested] = React.useState(false);
    React.useEffect(() => {
      if (!selectionRequested &&
          (snapshot.result !== undefined || ["receipt", "facts", "trace"].includes(snapshot.route.page)) &&
          studioPage !== "dashboard") {
        setStudioPage("dashboard");
      }
    }, [selectionRequested, snapshot.result, snapshot.route.page, studioPage]);
    React.useEffect(() => {
      if (snapshot.drilldown.phase !== "idle") return;
      if (snapshot.route.page === "facts" && snapshot.result !== undefined) {
        void controller.loadMetricFacts(snapshot.route.metric, snapshot.route.scope, snapshot.route.side);
      }
      if (snapshot.route.page === "trace") void controller.loadTrace({
        trace_id: snapshot.route.traceId,
        limit: 200,
      });
    }, [snapshot.route.page, snapshot.result]);
    const presentation = projectStudioPresentation(snapshot);
    const deltaCoordinates = new Set(presentation.deltas.map((delta) => delta.metric_coordinate));
    const facts = presentation.facts.map(factRow);
    const factsCompatible = facts.every((row) => row !== undefined);
    let recorded;
    if (snapshot.route.page === "trace" && presentation.trace.length > 0) {
      try {
        recorded = Bi.compileTraceView(presentation.trace);
      } catch {
        recorded = undefined;
      }
    }
    const theme = Bi.createBiTheme(createStudioTheme(platformThemeMode(explicitThemeMode)));
    const json = (data, label) => JsonTree === undefined
      ? React.createElement("pre", { "aria-label": label }, JSON.stringify(data, null, 2))
      : React.createElement(JsonTree, { data, label, copyable: true, expandTopLevel: true });
    const taskItems = snapshot.taskList.items ?? [];
    const current = snapshot.selection?.mode === "single" ? snapshot.selection.taskIds : [];
    const before = snapshot.selection?.mode === "compare" ? snapshot.selection.leftTaskIds : [];
    const after = snapshot.selection?.mode === "compare" ? snapshot.selection.rightTaskIds : [];
    const selectedTaskIds = new Set([...current, ...before, ...after]);
    const visibleTaskItems = taskItems.filter((task) => {
      const query = taskQuery.trim().toLocaleLowerCase();
      const matchesQuery = query === "" || task.task_id.toLocaleLowerCase().includes(query) ||
        task.display_name?.toLocaleLowerCase().includes(query);
      const matchesFilter = taskFilter === "all" || (taskFilter === "selected") === selectedTaskIds.has(task.task_id);
      return matchesQuery && matchesFilter;
    });
    const metricPanelIds = presentation.metrics.map((metric) => metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@")));
    const layoutStore = createStudioLayoutStore(layoutStorage);
    const [dashboardState, setDashboardState] = React.useState(() =>
      layoutStore.load(createStudioDashboardState(DEFAULT_LAYOUT.panels.map(({ id }) => id))));
    const [savedDashboardState, setSavedDashboardState] = React.useState(dashboardState);
    const expandedDashboardState = dashboardState.order === undefined ? dashboardState : {
      ...dashboardState,
      order: [...dashboardState.order, ...metricPanelIds.filter((id) => !dashboardState.order.includes(id))],
    };
    const dashboardMetrics = [...presentation.metrics]
      .filter((metric) => !expandedDashboardState.hidden.includes(metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@"))))
      .sort((left, right) => expandedDashboardState.order.indexOf(left.coordinate.slice(0, left.coordinate.lastIndexOf("@"))) -
        expandedDashboardState.order.indexOf(right.coordinate.slice(0, right.coordinate.lastIndexOf("@"))));
    const updateDashboard = (action) => setDashboardState(
      reduceStudioDashboardState(expandedDashboardState, action));
    const setTask = (id, checked) => {
      const selection = reduceSingleTaskSelection(current, id, checked);
      if (selection === undefined) controller.clearSelection();
      else controller.setSelection(selection);
    };
    const setComparedTask = (side, id, checked) => {
      const selected = side === "left" ? before : after;
      const taskIds = checked ? [...new Set([...selected, id])] : selected.filter((value) => value !== id);
      if (taskIds.length === 0) return;
      controller.setSelection({
        mode: "compare",
        leftTaskIds: side === "left" ? taskIds : before,
        rightTaskIds: side === "right" ? taskIds : after,
      });
    };
    const chooseMode = (mode) => {
      if (mode === snapshot.selection?.mode) return;
      const seed = current[0] ?? before[0] ?? after[0] ?? taskItems[0]?.task_id;
      if (seed === undefined) return;
      controller.setSelection(mode === "single"
        ? { mode: "single", taskIds: [seed] }
        : { mode: "compare", leftTaskIds: [seed], rightTaskIds: [seed] });
    };
    const evaluateSelection = async () => {
      await controller.evaluate();
      if (controller.getSnapshot().result !== undefined) {
        setSelectionRequested(false);
        setStudioPage("dashboard");
      }
    };
    const exactEvidenceTarget = snapshot.exactTargets.evidence;
    const exactTraceTarget = snapshot.exactTargets.trace;
    const evidenceUnavailableReason = exactEvidenceTarget === undefined
      ? "EXACT_EVIDENCE_TARGET_NOT_ESTABLISHED"
      : exactEvidenceTarget.status === "unavailable"
        ? "EXACT_EVIDENCE_TARGET_UNAVAILABLE"
        : undefined;
    const traceUnavailableReason = exactTraceTarget === undefined
      ? "EXACT_TRACE_TARGET_NOT_ESTABLISHED"
      : exactTraceTarget.status === "unavailable"
        ? "EXACT_TRACE_TARGET_UNAVAILABLE"
        : undefined;
    const pageIdentity = studioPage === "selection"
      ? { eyebrow: "New evaluation", title: "Select task population", detail: "Choose exact Task identities; display names are recognition only." }
      : snapshot.route.page === "trace"
        ? { eyebrow: "Recorded Evidence · exact identity", title: "Recorded Trace", detail: `${snapshot.route.traceId} · current evaluation · no inferred causality` }
        : snapshot.route.page === "facts"
          ? { eyebrow: "Evaluation Evidence", title: "Evidence", detail: "Exact recorded Facts and provenance for the current evaluation." }
          : snapshot.route.page === "receipt"
            ? { eyebrow: "Resolved evaluation context", title: "Evaluation receipt", detail: "Exact selection and resolved read-set identities." }
            : { eyebrow: `${snapshot.result?.mode === "COMPARE" ? "Compare" : "Single"} evaluation`, title: "Current evaluation", detail: "Current receipt · exact selection" };
    const traceViewDefinition = STUDIO_TRACE_VIEWS.find(({ id }) => id === traceView) ?? STUDIO_TRACE_VIEWS[0];
    const traceViewNavigation = React.createElement("nav", { className: "studio-trace-view-navigation", "aria-label": "Trace renderer navigation" },
      React.createElement(ButtonGroup, { segmented: true, className: "studio-trace-view-switcher", "aria-label": "Trace renderer views" },
        ...STUDIO_TRACE_VIEWS.map((view) => React.createElement(Button, { appearance: "segment", key: view.id, selected: traceView === view.id, type: "button", onClick: () => setTraceView(view.id) }, view.label))),
      React.createElement(Typography, { as: "span", className: "studio-trace-view-note", variant: "caption" }, traceViewDefinition.note));
    return React.createElement(Bi.BiSurface, { className: "studio-theme-root", theme }, React.createElement("section", {
      id: "crystra-studio-view", role: "region", "aria-labelledby": "crystra-studio-title",
      "data-crystra-studio-view": "evaluate", style: viewStyle,
    },
    React.createElement("style", { "data-crystra-studio-host-styles": "crystra-dsh@1" }, hostStyles),
    sharedStyles === undefined ? null : React.createElement("style", { "data-crystra-bi-styles": "crystra-ui-core@0.1.0" }, sharedStyles),
    React.createElement(Surface, { as: "header", level: "section", "data-crystra-studio-region": "header" },
      React.createElement("div", { className: "studio-product-row" },
        React.createElement("div", { className: "studio-breadcrumbs" },
          React.createElement(Typography, { as: "strong", variant: "label" }, "CRYSTRA Studio"),
          React.createElement(Typography, { variant: "caption" }, "/"),
          React.createElement(Typography, { variant: "caption" }, "Evaluation"),
          snapshot.route.page === "trace" ? React.createElement(React.Fragment, null,
            React.createElement(Typography, { variant: "caption" }, "/"), React.createElement(Typography, { variant: "caption" }, "Trace")) : null),
        React.createElement("nav", { className: "studio-controls", "aria-label": "Studio views" },
          React.createElement(Button, { appearance: "ghost", className: "studio-view-link", type: "button", disabled: false, "aria-current": studioPage === "selection" ? "page" : undefined, onClick: () => {
            setSelectionRequested(true);
            setStudioPage("selection");
          } }, "Select"),
          React.createElement(Button, { appearance: "ghost", className: "studio-view-link", type: "button", disabled: snapshot.result === undefined && !["receipt", "facts", "trace"].includes(snapshot.route.page), "aria-current": studioPage === "dashboard" && snapshot.route.page === "results" ? "page" : undefined, onClick: () => {
            controller.backToResults();
            setSelectionRequested(false);
            setStudioPage("dashboard");
          } }, "Dashboard"),
          React.createElement(Button, {
            appearance: "ghost", className: "studio-view-link", type: "button",
            disabled: evidenceUnavailableReason !== undefined,
            "aria-current": snapshot.route.page === "facts" ? "page" : undefined,
            "data-navigation-state": evidenceUnavailableReason === undefined ? "available" : "unavailable",
            "data-unavailable-reason": evidenceUnavailableReason,
            title: evidenceUnavailableReason,
            onClick: () => controller.restoreExactEvidence(),
          }, "Evidence"),
          React.createElement(Button, {
            appearance: "ghost", className: "studio-view-link", type: "button",
            disabled: traceUnavailableReason !== undefined,
            "aria-current": snapshot.route.page === "trace" ? "page" : undefined,
            "data-navigation-state": traceUnavailableReason === undefined ? "available" : "unavailable",
            "data-unavailable-reason": traceUnavailableReason,
            title: traceUnavailableReason,
            onClick: () => controller.restoreExactTrace(),
          }, "Recorded Trace"))),
      React.createElement("div", { className: "studio-page-row" },
        React.createElement("div", { className: "studio-page-copy" },
          React.createElement(Typography, { as: "span", className: "studio-eyebrow", variant: "eyebrow" }, pageIdentity.eyebrow),
          React.createElement(Typography, { as: "h1", id: "crystra-studio-title", variant: "pageTitle" }, pageIdentity.title),
          React.createElement(Typography, { as: "p", variant: snapshot.route.page === "trace" ? "code" : "caption" }, pageIdentity.detail)),
        React.createElement(ButtonGroup, { className: "studio-controls studio-page-actions", "aria-label": "Page actions" },
          studioPage === "selection" ? React.createElement(React.Fragment, null,
            React.createElement(Button, { appearance: "ghost", type: "button", disabled: snapshot.recentSelection === undefined, onClick: () => controller.setSelection(snapshot.recentSelection) }, "Use recent selection"),
            React.createElement(Button, { appearance: "outline", type: "button", disabled: snapshot.taskList.phase === "loading", onClick: () => controller.loadTasks() }, "Load tasks"),
            React.createElement(Button, { appearance: "solid", tone: "primary", type: "button", disabled: snapshot.selection === undefined, onClick: evaluateSelection }, "Evaluate selection")) : null,
          studioPage === "dashboard" && snapshot.route.page === "results" ? React.createElement(React.Fragment, null,
            snapshot.result === undefined ? null : React.createElement(Button, { type: "button", onClick: () => controller.openReceipt() }, "View receipt"),
            React.createElement(Button, { type: "button", onClick: () => setDashboardState(reduceStudioDashboardState(expandedDashboardState, { type: "PRESET", preset: "default" })) }, "Default overview"),
            React.createElement(Button, { type: "button", onClick: () => {
              setSelectionRequested(true);
              setStudioPage("selection");
            } }, "Change evaluation")) : null,
          studioPage === "dashboard" && snapshot.route.page === "trace" ? React.createElement(React.Fragment, null,
            React.createElement(Button, { appearance: "outline", type: "button", onClick: () => controller.backToResults() }, "Back to Dashboard"),
            React.createElement(Button, {
              appearance: "outline", type: "button",
              disabled: evidenceUnavailableReason !== undefined,
              "data-unavailable-reason": evidenceUnavailableReason,
              title: evidenceUnavailableReason,
              onClick: () => controller.restoreExactEvidence(),
            }, "Open Evidence"),
            React.createElement(Button, { appearance: "solid", tone: "primary", type: "button", onClick: () => navigator.clipboard?.writeText(snapshot.route.traceId) }, "Copy trace identity")) : null,
          studioPage === "dashboard" && editingDashboard
            ? React.createElement(React.Fragment, null,
              React.createElement(Button, { type: "button", onClick: () => setDashboardState(reduceStudioDashboardState(expandedDashboardState, { type: "RESET" })) }, "Reset layout"),
              React.createElement(Button, { appearance: "solid", tone: "primary", type: "button", onClick: () => {
                layoutStore.save(expandedDashboardState);
                setSavedDashboardState(expandedDashboardState);
                setEditingDashboard(false);
              } }, "Save layout"),
              React.createElement(Button, { appearance: "ghost", type: "button", onClick: () => {
                setDashboardState(savedDashboardState);
                setEditingDashboard(false);
              } }, "Cancel editing"))
            : studioPage === "dashboard" && snapshot.route.page === "results" ? React.createElement(Button, { appearance: "solid", tone: "primary", type: "button", onClick: () => {
              setSavedDashboardState(expandedDashboardState);
              setEditingDashboard(true);
            } }, "Edit dashboard") : null)),
      studioPage === "dashboard" && editingDashboard && metricPanelIds.some((id) => expandedDashboardState.hidden.includes(id))
        ? React.createElement("div", { className: "studio-controls", "aria-label": "Add dashboard panels" },
          ...metricPanelIds.filter((id) => expandedDashboardState.hidden.includes(id)).map((panelId) =>
            React.createElement(Button, { key: panelId, type: "button", onClick: () => updateDashboard({ type: "ADD", panelId }) }, `Add ${panelId}`)))
        : null,
      ),
    React.createElement("main", {
      tabIndex: -1,
      "data-crystra-studio-region": "main",
      "data-crystra-studio-page": studioPage,
    },
      snapshot.phase === "loading" || snapshot.refreshing
        ? React.createElement("p", { role: "status", "aria-live": "polite" }, snapshot.refreshing ? "Refreshing evaluation…" : "Loading evaluation…") : null,
      snapshot.error === undefined ? null
        : React.createElement("section", { role: "alert", "aria-live": "assertive" },
          React.createElement("h2", null, snapshot.result === undefined ? "Evaluate unavailable" : "Showing the last result"),
          React.createElement("p", null, snapshot.error.message),
          React.createElement(Button, { type: "button", style: controlStyle, onClick: () => controller.refresh() }, "Retry")),
      studioPage === "selection" ? React.createElement("section", {
        "aria-labelledby": "crystra-task-selection",
        className: "studio-selection-grid",
      },
        React.createElement(Surface, { as: "section", level: "section", className: "studio-selection-card", "data-crystra-selection-browser": "task-population" },
          React.createElement("header", { className: "studio-selection-head" },
            React.createElement("div", null,
              React.createElement(Typography, { as: "h2", id: "crystra-task-selection", variant: "sectionTitle" }, "Task population"),
              React.createElement(Typography, { as: "p", className: "studio-selection-copy", variant: "caption" }, `${taskItems.length} Tasks · exact identities retained in the receipt`)),
            React.createElement(ButtonGroup, { segmented: true, className: "studio-mode", "aria-label": "Evaluation mode" },
              React.createElement(Button, { appearance: "segment", selected: snapshot.selection?.mode !== "compare", type: "button", onClick: () => chooseMode("single") }, "Single"),
              React.createElement(Button, { appearance: "segment", selected: snapshot.selection?.mode === "compare", type: "button", onClick: () => chooseMode("compare") }, "Compare"))),
          React.createElement("div", { className: "studio-selection-filter" },
            React.createElement(TextInput, { inputKind: "search", "aria-label": "Search Tasks", placeholder: "Search name or exact Task ID", value: taskQuery, onChange: (event) => setTaskQuery(event.target.value) }),
            React.createElement(Button, { type: "button", "aria-expanded": filtersOpen, onClick: () => setFiltersOpen(!filtersOpen) }, "Filters"),
            filtersOpen ? React.createElement("div", { className: "studio-filter-options", role: "group", "aria-label": "Task filters" },
              ...[["all", "All"], ["selected", "Selected"], ["available", "Available"]].map(([value, label]) => React.createElement(Button, { key: value, type: "button", "aria-pressed": taskFilter === value, onClick: () => setTaskFilter(value) }, label)),
              snapshot.taskList.page?.next_cursor ? React.createElement(Button, { type: "button", onClick: () => controller.loadTasks(snapshot.taskList.page.next_cursor) }, "Load more tasks") : null) : null),
          snapshot.taskList.phase === "error" ? React.createElement("p", { role: "alert" }, "Task list unavailable; the current selection remains usable.") : null,
          snapshot.selection?.mode === "compare"
            ? React.createElement("div", { className: "studio-task-list" }, ...[["Before", "left", before], ["After", "right", after]].flatMap(([label, side, selected]) => [
              React.createElement(Typography, { as: "strong", key: `${side}-label`, variant: "label" }, label),
              ...visibleTaskItems.map((task) => React.createElement("div", { className: "studio-task-row", "data-crystra-selection-side": side, "data-crystra-task-id": task.task_id, key: `${side}-${task.task_id}` },
                React.createElement("label", null,
                  React.createElement("input", { type: "checkbox", checked: selected.includes(task.task_id), onChange: (event) => setComparedTask(side, task.task_id, event.target.checked) }),
                  React.createElement("span", null,
                    React.createElement(Typography, { as: "strong", variant: "label" }, task.display_name ?? task.task_id),
                    React.createElement(Typography, { as: "small", className: "studio-task-id", variant: "code" }, task.task_id))),
                React.createElement(StatusBadge, { status: selected.includes(task.task_id) ? "selected" : "available" }, selected.includes(task.task_id) ? "Selected" : "Available")))]))
            : React.createElement("div", { className: "studio-task-list", role: "list" }, ...visibleTaskItems.map((task) => React.createElement("div", { className: "studio-task-row", "data-crystra-task-id": task.task_id, key: task.task_id, role: "listitem" },
              React.createElement("label", null,
                React.createElement("input", { type: "checkbox", checked: current.includes(task.task_id), onChange: (event) => setTask(task.task_id, event.target.checked) }),
                React.createElement("span", null,
                  React.createElement(Typography, { as: "strong", variant: "label" }, task.display_name ?? task.task_id),
                  React.createElement(Typography, { as: "small", className: "studio-task-id", variant: "code" }, task.task_id))),
              React.createElement(StatusBadge, { status: current.includes(task.task_id) ? "selected" : "available" }, current.includes(task.task_id) ? "Selected" : "Available")))),
          snapshot.taskList.phase === "ready" && taskItems.length === 0 ? React.createElement("p", { role: "status" }, "No Tasks are available in Evidence.") : null),
        React.createElement(Surface, { as: "aside", level: "section", className: "studio-selection-card", "aria-label": "Current selection" },
          React.createElement("header", { className: "studio-selection-head" },
            React.createElement("div", null,
              React.createElement(Typography, { as: "h2", variant: "sectionTitle" }, "Current selection"),
              React.createElement(Typography, { as: "p", className: "studio-selection-copy", variant: "caption" }, snapshot.selection?.mode === "compare" ? `${before.length} Before · ${after.length} After` : `Single evaluation · ${current.length} ${current.length === 1 ? "Task" : "Tasks"}`)),
            React.createElement(Button, { appearance: "ghost", type: "button", disabled: snapshot.selection === undefined, onClick: () => controller.clearSelection() }, "Clear")),
          React.createElement("div", { className: "studio-selected-list" },
            ...(snapshot.selection?.mode === "compare" ? [["Before", before], ["After", after]] : [["Selected", current]]).flatMap(([label, ids]) => [
              React.createElement(Typography, { as: "strong", key: `${label}-heading`, variant: "label" }, label),
              ...ids.map((id) => {
                const task = taskItems.find((candidate) => candidate.task_id === id);
                return React.createElement("div", { className: "studio-selected-item", key: `${label}-${id}` },
                  React.createElement(Typography, { as: "strong", variant: "label" }, task?.display_name ?? id),
                  React.createElement(Typography, { as: "small", className: "studio-task-id", variant: "code" }, id));
              }),
            ]),
            React.createElement(Typography, { as: "p", className: "studio-selection-copy", variant: "caption" }, "Evaluation resolves a current receipt. Layout and display names do not enter evaluation identity.")))) : null,
      studioPage !== "dashboard" || snapshot.route.page !== "results" ? null : snapshot.result === undefined ? React.createElement("p", null, "Choose one or more Tasks to evaluate.")
        : React.createElement("section", { "aria-label": snapshot.result.mode === "COMPARE" ? "Compared Metric Results" : "Metric Results" },
          snapshot.phase === "partial" ? React.createElement("p", { role: "status" }, "Partial comparison: the available side remains visible.") : null,
          React.createElement(Bi.BiSurface, { theme },
            React.createElement("div", {
              "data-crystra-dashboard-layout": DEFAULT_LAYOUT.schemaVersion,
            }, ...dashboardMetrics.filter((metric) => snapshot.result.mode !== "COMPARE" || !deltaCoordinates.has(metric.coordinate))
              .map((metric) => {
                const panelId = metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@"));
                const placement = studioPanelPlacement(panelId, expandedDashboardState.sizes[panelId]);
                return React.createElement("article", {
                  key: metric.coordinate,
                  "data-crystra-bi-metric": metric.coordinate,
                  "data-crystra-dashboard-panel": panelId,
                  style: {
                    "--studio-panel-desktop-columns": placement.desktop,
                    "--studio-panel-tablet-columns": placement.tablet,
                    "--studio-panel-mobile-columns": placement.mobile,
                  },
                },
              editingDashboard ? React.createElement("div", { className: "studio-controls", "aria-label": `${panelId} layout controls` },
                React.createElement(Button, { type: "button", onClick: () => updateDashboard({ type: "RESIZE", panelId, size: placement.desktop >= 12 ? "compact" : placement.desktop >= 6 ? "full" : "wide" }) }, "Resize panel"),
                React.createElement(Button, { type: "button", onClick: () => {
                  const index = expandedDashboardState.order.indexOf(panelId);
                  if (index > 0) updateDashboard({ type: "MOVE", panelId, beforePanelId: expandedDashboardState.order[index - 1] });
                } }, "Move earlier"),
                React.createElement(Button, { type: "button", onClick: () => updateDashboard({ type: "REMOVE", panelId }) }, "Remove panel")) : null,
              snapshot.result.mode === "COMPARE" ? React.createElement("h3", null, metric.coordinate) : null,
              ...metric.sides.map(({ side, slices }) => {
                const result = {
                  metric_id: metric.coordinate.slice(0, metric.coordinate.lastIndexOf("@")),
                  metric_version: metric.coordinate.slice(metric.coordinate.lastIndexOf("@") + 1),
                  slices,
                };
                return React.createElement("section", { key: side, "aria-label": `${side} Metric Result` },
                  snapshot.result.mode === "COMPARE" ? React.createElement("h4", null, `${side} side`) : null,
                  React.createElement(Bi.DashboardMetricPanel, {
                    result,
                    size: placement.desktop >= 12 ? "WIDE" : placement.desktop >= 6 ? "MEDIUM" : "SMALL",
                    onEvidence: () => controller.openFacts(metric.coordinate, "result", side),
                  }));
              }));
              })),
            ...(snapshot.result.mode === "COMPARE" ? presentation.deltas.map((delta) => {
              const before = metricSlice(snapshot.result.left, delta.metric_coordinate, delta.slice_key);
              const after = metricSlice(snapshot.result.right, delta.metric_coordinate, delta.slice_key);
              return React.createElement(Bi.CompareResultFrame, {
                key: `${delta.metric_coordinate}-${sliceIdentity(delta.slice_key)}`,
                coordinate: delta.metric_coordinate,
                before,
                after,
                beforeError: snapshot.result.left?.tag === "SIDE_ERROR" ? snapshot.result.left : undefined,
                afterError: snapshot.result.right?.tag === "SIDE_ERROR" ? snapshot.result.right : undefined,
                delta,
                onRetryFailedSide: () => controller.refresh(),
                onEvidence: (side) => controller.openFacts(delta.metric_coordinate, "result", side),
                visualizer: Bi.selectDefaultVisualizer({
                  metric_id: delta.metric_coordinate.slice(0, delta.metric_coordinate.lastIndexOf("@")),
                  metric_version: delta.metric_coordinate.slice(delta.metric_coordinate.lastIndexOf("@") + 1),
                  slices: [before ?? after].filter(Boolean),
                }),
              });
            }) : []))),
      studioPage === "dashboard" && snapshot.route.page === "receipt"
        ? React.createElement("section", { "aria-label": "Evaluation receipts" },
          React.createElement("h2", null, "Receipts"),
          React.createElement(Button, { type: "button", onClick: () => controller.backToResults() }, "Back to Metric Results"),
          React.createElement(Bi.BiSurface, { theme },
            ...presentation.receipts.map(({ side, receipt }) => React.createElement(Bi.ReceiptView, {
              key: side,
              receipt,
              side,
            }))),
          React.createElement("details", { onToggle: (event) => setTechnicalDetailsOpen(event.currentTarget.open) },
            React.createElement("summary", null, "Technical JSON details"),
            technicalDetailsOpen ? json(snapshot.result, "Evaluation receipt JSON") : null)) : null,
      studioPage === "dashboard" && snapshot.route.page === "facts"
        ? React.createElement("section", { "aria-label": "Fact drill-down" },
          React.createElement(Button, { type: "button", onClick: () => controller.backToResults() }, "Back to Metric Results"),
          React.createElement(Bi.BiSurface, { theme },
            React.createElement(Bi.EvidenceConsoleFoundation, {
              scope: snapshot.route.scope,
              state: presentation.drilldownError !== undefined
                ? { tag: "ERROR", detail: presentation.drilldownError.message }
                : !factsCompatible
                  ? { tag: "ERROR", detail: "Studio received an incompatible formal Fact shape" }
                  : snapshot.drilldown.phase === "loading"
                    ? { tag: "LOADING" }
                    : facts.length === 0
                      ? { tag: "EMPTY" }
                      : facts.every((row) => row.truth.expiry === "EXPIRED")
                        ? { tag: "EXPIRED" }
                        : { tag: "READY" },
              rows: facts.filter(Boolean),
              references: (snapshot.drilldown.references ?? []).map((reference) => ({
                kind: "PUBLISHED_PROVENANCE",
                identity: reference.identity,
                provenance: reference.identity,
                loadedAsFact: reference.loadedAsFact,
              })),
              onScopeChange: (scope) => {
                controller.openFacts(snapshot.route.metric, scope, snapshot.route.side);
                void controller.loadMetricFacts(snapshot.route.metric, scope, snapshot.route.side);
              },
              onOpenTrace: (traceId, spanId) => {
                controller.openTrace(traceId, spanId);
                void controller.loadTrace({ trace_id: traceId, limit: 200 });
              },
            }))) : null,
      studioPage === "dashboard" && snapshot.route.page === "trace"
        ? React.createElement("section", { "aria-label": "Recorded Trace drill-down" },
          presentation.drilldownError === undefined ? null : React.createElement("p", { role: "alert" }, presentation.drilldownError.message),
          recorded === undefined
            ? React.createElement("p", { role: presentation.trace.length > 0 ? "alert" : "status" },
              presentation.trace.length > 0 ? "Studio received an incompatible formal Trace shape" : "No recorded Trace items")
            : React.createElement(Bi.BiSurface, { theme },
              React.createElement("div", { "data-studio-trace-hierarchy": "navigation-header-content" },
                recorded.status === "INVALID" ? React.createElement("p", { role: "alert" }, recorded.errors.join("; ")) : null,
                traceViewNavigation,
                React.createElement(Bi[STUDIO_TRACE_VIEWS.find(({ id }) => id === traceView)?.renderer ?? "TraceWaterfall"], {
                  trace: recorded,
                  showSummary: false,
                })))) : null),
      studioPage === "dashboard" && snapshot.route.page === "results" && snapshot.result !== undefined ? React.createElement(Surface, { as: "footer", border: "dashed", level: "raised", "data-crystra-studio-region": "footer" },
        React.createElement(Typography, { as: "strong", variant: "label" }, presentation.trace.length > 0 ? "Recorded Trace is available" : "Recorded Trace availability follows current Evidence"),
        React.createElement(Typography, { variant: "caption" }, " · exact recorded identities only; no inferred ordering")) : null));
  };
}

export function createStudioClientPlugin({ React, Primitives = {}, Bi, sharedStyles, initialContext, storage, themeMode } = {}) {
  if (React === undefined) throw new Error("STUDIO_REACT_REQUIRED");
  const component = (value) => {
    if (typeof value === "function" || typeof value === "string") return true;
    if (value === null || typeof value !== "object") return false;
    return value.$$typeof === Symbol.for("react.memo") ||
      value.$$typeof === Symbol.for("react.forward_ref") ||
      value.$$typeof === Symbol.for("react.lazy");
  };
  if (Bi === undefined || !component(Bi.BiSurface) || !component(Bi.Button) || !component(Bi.ButtonGroup) ||
      !component(Bi.DashboardMetricPanel) || !component(Bi.StatusBadge) || !component(Bi.Surface) || !component(Bi.TextInput) || !component(Bi.Typography) || !component(Bi.MetricPanel) ||
      !component(Bi.CompareResultFrame) || !component(Bi.ReceiptView) || !component(Bi.ScopedError) ||
      !component(Bi.EvidenceConsoleFoundation) || !component(Bi.TraceWaterfall) || !component(Bi.TraceTree) ||
      typeof Bi.compileTraceView !== "function" || typeof Bi.selectDefaultVisualizer !== "function" ||
      typeof Bi.createBiTheme !== "function") {
    throw new Error("STUDIO_BI_REQUIRED");
  }
  return {
    name: "crystra-studio-client",
    inject: ["connection", "slots"],
    apply(ctx) {
      const resolvedStorage = storage ?? (typeof window === "undefined" ? undefined : window.sessionStorage);
      const controller = createEvaluateController({
        catalogCoordinates: Bi.CATALOG_COORDINATES,
        gateway: createStudioGatewayPort(ctx),
        initialContext,
        storage: resolvedStorage,
      });
      let dispose = () => undefined;
      ctx.slots.inject("conversation.view", () => {
        dispose = ctx.slots.register({
          name: "conversation.view", id: "crystra-studio", order: 30, label: "CRYSTRA Studio",
        }, StudioView(React, Primitives, Bi, sharedStyles, controller, themeMode, resolvedStorage));
      });
      return Object.assign(() => dispose?.(), { controller });
    },
  };
}
