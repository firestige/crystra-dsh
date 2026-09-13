export const DSH_ACTION_PRESENTATION_COMPATIBILITY = Object.freeze({
  dsh: "0.1.1-rc.2",
  uiPrimitives: "@deepseek-ai/dsh-client-ui-primitives@0.1.1-rc.2",
  presentation: "crystra.presentation@1.0.0",
});

const ROOT_KEYS = "correlation,data,kind,schemaVersion";
const KINDS = new Set([
  "command-accepted",
  "delivery-running",
  "delivery-list",
  "delivery-status",
  "action-output",
  "action-input-request",
  "terminal-result",
  "error",
]);
const ACTION_STATES = new Set(["running", "completed", "failed", "cancelled", "waiting", "recovering", "uncertain", "unresolved"]);
const TERMINAL_OUTCOMES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
const DELIVERY_STATES = new Set([
  "BOUND", "START_UNCERTAIN", "RUNNING_CORRELATED", "START_FAILED", "RESULT_UNRESOLVED", "TERMINAL_HANDLING",
  "RUNNING", "RECOVERING", "WAITING", "AWAITING_INPUT", "COMPLETED", "SUCCEEDED", "FAILED", "CANCELLED",
]);
const MAX_PRESENTATION_BYTES = 4096;

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function invalidPresentation() {
  return deepFreeze({
    schemaVersion: DSH_ACTION_PRESENTATION_COMPATIBILITY.presentation,
    correlation: "presentation-invalid",
    kind: "error",
    data: { code: "CRYSTRA_PRESENTATION_INVALID", message: "CRYSTRA presentation unavailable" },
  });
}

function plainJson(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((item) => plainJson(item, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(value).every((key) => typeof key === "string"
    && descriptors[key] !== undefined
    && "value" in descriptors[key]
    && plainJson(descriptors[key].value, seen));
}

function hasValidTypedData(value) {
  if (value.kind === "action-output") {
    const state = value.data.state === undefined ? "completed" : value.data.state;
    const channel = value.data.channel === undefined ? "action" : value.data.channel;
    return typeof state === "string" && ACTION_STATES.has(state)
      && (channel === "action" || channel === "tool");
  }
  if (value.kind === "terminal-result") {
    const hasFinalOutput = Object.hasOwn(value.data, "finalOutput");
    const hasSummary = Object.hasOwn(value.data, "summary");
    const outputValid = hasFinalOutput
      ? typeof value.data.finalOutput === "string" && value.data.finalOutput.length > 0
      : hasSummary ? typeof value.data.summary === "string" && value.data.summary.length > 0
        : value.data.outcome === "SUCCEEDED";
    return typeof value.data.outcome === "string" && TERMINAL_OUTCOMES.has(value.data.outcome) && outputValid;
  }
  if (value.kind === "delivery-running" || value.kind === "delivery-status") {
    const diagnostic = value.data.diagnostic;
    const diagnosticValid = diagnostic === undefined || (diagnostic !== null && typeof diagnostic === "object" && !Array.isArray(diagnostic)
      && Object.keys(diagnostic).sort().join(",") === "causeCode,stage"
      && typeof diagnostic.stage === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(diagnostic.stage)
      && typeof diagnostic.causeCode === "string" && /^[A-Z][A-Z0-9_]{0,127}$/u.test(diagnostic.causeCode));
    return diagnosticValid && (value.data.state === undefined
      || (typeof value.data.state === "string" && DELIVERY_STATES.has(value.data.state)));
  }
  return true;
}

/**
 * Admit one durable Execution presentation fact. Unsupported revisions and
 * shapes become a bounded generic error; rejected bytes are never echoed.
 */
export function parseExecutionPresentation(input) {
  let value = input;
  if (typeof input === "string") {
    if (input.length === 0 || new TextEncoder().encode(input).byteLength > MAX_PRESENTATION_BYTES) return invalidPresentation();
    try { value = JSON.parse(input); } catch { return invalidPresentation(); }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== ROOT_KEYS
    || value.schemaVersion !== DSH_ACTION_PRESENTATION_COMPATIBILITY.presentation
    || typeof value.correlation !== "string" || value.correlation.length === 0
    || !KINDS.has(value.kind)
    || value.data === null || typeof value.data !== "object" || Array.isArray(value.data)
    || !plainJson(value.data)
    || !hasValidTypedData(value)) return invalidPresentation();
  return deepFreeze(structuredClone(value));
}

function text(value, keys = ["text", "message", "question", "summary", "result"]) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const lines = value.map((item) => text(item, keys)).filter((item) => typeof item === "string" && item.length > 0);
    return lines.length === 0 ? undefined : lines.join("\n\n");
  }
  if (value === null || typeof value !== "object") return undefined;
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) continue;
    const nested = text(value[key], keys);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function normalizedLifecycle(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase().replaceAll("_", "-");
  if (["succeeded", "success", "done", "terminal"].includes(normalized)) return "completed";
  if (["failed", "error"].includes(normalized)) return "failed";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  if (["waiting", "awaiting-input"].includes(normalized)) return "waiting";
  if (["start-failed"].includes(normalized)) return "failed";
  if (normalized === "start-uncertain") return "uncertain";
  if (normalized === "result-unresolved") return "unresolved";
  if (["recovering", "recovery", "terminal-handling"].includes(normalized)) return "recovering";
  if (["running", "accepted", "running-correlated", "bound"].includes(normalized)) return "running";
  return fallback;
}

const STATE_LABELS = Object.freeze({
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  waiting: "Waiting for input",
  recovering: "Recovering",
  uncertain: "Start uncertain",
  unresolved: "Result unresolved",
});

function model(input) {
  return deepFreeze(input);
}

/** Convert a typed owner fact into the browser-only CRYSTRA presentation model. */
export function projectExecutionPresentation(event) {
  const { correlation, data } = event;
  if (event.kind === "delivery-list") throw new TypeError("CRYSTRA_PRESENTATION_OUT_OF_SCOPE");
  if (event.kind === "terminal-result") {
    const state = normalizedLifecycle(data.outcome, "failed");
    const body = typeof data.finalOutput === "string" ? data.finalOutput : data.summary;
    return model({
      correlation, layer: "final", state, title: "Final result",
      summary: data.outcome[0] + data.outcome.slice(1).toLowerCase(), body,
      defaultOpen: false, focusPolicy: "none", role: "article",
      compatibility: typeof data.finalOutput === "string" ? "current" : "legacy-summary",
    });
  }
  if (event.kind === "action-input-request") {
    return model({
      correlation, layer: "action", state: "waiting",
      title: typeof data.label === "string" ? data.label : "Workflow Action",
      summary: STATE_LABELS.waiting, body: text(data.prompt) ?? "Input required",
      defaultOpen: true, focusPolicy: "preserve", role: "status", compatibility: "current",
    });
  }
  if (event.kind === "action-output") {
    const state = data.state ?? "completed";
    return model({
      correlation, layer: data.channel === "tool" ? "tool" : "action", state,
      title: typeof data.label === "string" ? data.label : "Workflow Action",
      summary: STATE_LABELS[state], body: text(data.content) ?? "CRYSTRA content unavailable",
      defaultOpen: false, focusPolicy: "none", role: "status", compatibility: "current",
    });
  }
  if (event.kind === "error") {
    return model({
      correlation, layer: "progress", state: "failed", title: "Workflow presentation",
      summary: typeof data.code === "string" ? data.code : "CRYSTRA_ERROR",
      body: typeof data.message === "string" ? data.message : "CRYSTRA presentation unavailable",
      defaultOpen: false, focusPolicy: "none", role: "alert", compatibility: "current",
    });
  }

  const state = event.kind === "delivery-running"
    ? normalizedLifecycle(data.state, "running")
    : normalizedLifecycle(data.state, event.kind === "command-accepted" ? "running" : "running");
  const deliveryId = typeof data.deliveryId === "string" ? data.deliveryId : undefined;
  const diagnostic = data.diagnostic;
  return model({
    correlation, layer: "progress", state, title: "Workflow delivery",
    summary: `${STATE_LABELS[state]}${deliveryId === undefined ? "" : ` · ${deliveryId}`}`,
    body: diagnostic === undefined ? undefined : `${diagnostic.stage} · ${diagnostic.causeCode}`,
    defaultOpen: false, focusPolicy: "none", role: "status", compatibility: "current",
  });
}

/** Lifecycle-driven disclosure policy that never destroys the active focus target. */
export function resolveDisclosureOpen({ current, previousState, nextState, containsFocus }) {
  if (nextState === "waiting") return true;
  if (nextState === "completed" && previousState !== "completed") return containsFocus ? true : false;
  return current;
}

/** Durable Harness conversation-event adapter. It creates only CRYSTRA nodes. */
export function createExecutionPresentationDefinition() {
  return Object.freeze({
    kind: "crystra-execution-presentation",
    target: "chat",
    match(event) {
      if (event?.type === "command/run" && event.data?.name === "crystra"
        && event.data?.source?.kind === "plugin" && event.data?.source?.plugin === "workflow-execution"
        && typeof event.data?.commandId === "string") {
        return { id: event.data.commandId, role: "start" };
      }
      return event?.type === "command/done" && typeof event.data?.commandId === "string"
        ? { id: event.data.commandId, role: "update" }
        : null;
    },
    start(_context, match) {
      return Object.freeze({ seq: match.event.seq, presentation: undefined });
    },
    update(context, match) {
      const event = parseExecutionPresentation(match.event?.data?.text);
      if (event.kind === "delivery-list") {
        return Object.freeze({ ...context.state, presentation: undefined });
      }
      if (event.kind === "terminal-result" && event.data.outcome === "SUCCEEDED"
        && !Object.hasOwn(event.data, "finalOutput") && !Object.hasOwn(event.data, "summary")) {
        return Object.freeze({ ...context.state, presentation: undefined });
      }
      return Object.freeze({ ...context.state, presentation: projectExecutionPresentation(event) });
    },
    buildViewNode(context) {
      if (context.state?.presentation === undefined) return null;
      return Object.freeze({
        key: context.key,
        kind: "crystra-execution-presentation",
        id: context.id,
        target: "chat",
        anchorSeq: context.state.seq,
        location: context.start?.location ?? { kind: "unresolved" },
        visibility: "visible",
        data: context.state.presentation,
      });
    },
  });
}
