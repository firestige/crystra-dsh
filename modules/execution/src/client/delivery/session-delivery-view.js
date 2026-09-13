export const DELIVERY_VIEW_ID = "delivery";
export const DELIVERY_VIEW_ORDER = 20;

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const LIFECYCLES = new Set([
  "BOUND", "START_UNCERTAIN", "RUNNING_CORRELATED", "START_FAILED",
  "RESULT_UNRESOLVED", "TERMINAL_HANDLING", "TERMINAL",
]);
const DELIVERY_STYLE_ID = "dsh-crystra-execution-delivery-view";
const DELIVERY_CSS = `
.crystra-delivery-view { box-sizing: border-box; width: 100%; max-width: 960px; margin: 0 auto; padding: 20px; color: var(--dsw-alias-label-primary); }
.crystra-delivery-heading { margin: 0 0 16px; font-size: 20px; line-height: 28px; }
.crystra-delivery-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 8px; margin: 0 0 16px; }
.crystra-delivery-summary-item { min-width: 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
.crystra-delivery-summary-item dt, .crystra-delivery-identity dt { margin: 0 0 3px; color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 16px; }
.crystra-delivery-summary-item dd, .crystra-delivery-identity dd { min-width: 0; margin: 0; font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.crystra-delivery-status { display: inline-flex; min-width: 0; align-items: center; gap: 6px; }
.crystra-delivery-status > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crystra-delivery-identities { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 8px 16px; margin: 8px 0 0; }
.crystra-delivery-identity { min-width: 0; margin: 0; }
.crystra-delivery-identity dd { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px; }
.crystra-delivery-identity code { display: block; min-width: 0; max-width: 100%; color: inherit; font-family: var(--dsw-font-family-mono, ui-monospace, monospace); overflow-wrap: anywhere; white-space: normal; }
.crystra-delivery-preview { display: block; min-width: 0; max-width: 100%; margin-inline-start: 8px; overflow: hidden; color: var(--dsw-alias-label-tertiary); text-overflow: ellipsis; white-space: nowrap; }
.crystra-delivery-copy-feedback { min-height: 20px; margin: 8px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 20px; }
.crystra-delivery-condition { margin-top: 12px; padding: 10px 12px; border-left: 3px solid var(--dsw-alias-state-warn-primary); border-radius: 4px; background: var(--dsw-alias-bg-layer-1); }
.crystra-delivery-condition h3 { margin: 0 0 4px; font-size: 13px; line-height: 20px; }
.crystra-delivery-condition code, .crystra-delivery-state code { overflow-wrap: anywhere; }
.crystra-delivery-state { display: grid; gap: 8px; }
.crystra-delivery-state p { margin: 0; }
@media (max-width: 720px) { .crystra-delivery-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 420px) { .crystra-delivery-view { padding: 12px; } .crystra-delivery-summary, .crystra-delivery-identities { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .crystra-delivery-view, .crystra-delivery-view * { scroll-behavior: auto !important; transition: none !important; } }
`;

function ensureDeliveryStyles() {
  if (typeof document === "undefined" || document.getElementById(DELIVERY_STYLE_ID) !== null) return;
  const tag = document.createElement("style");
  tag.id = DELIVERY_STYLE_ID;
  tag.textContent = DELIVERY_CSS;
  document.head.appendChild(tag);
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}
function validDelivery(delivery, sessionCorrelation) {
  return delivery !== null && typeof delivery === "object" && !Array.isArray(delivery)
    && nonEmpty(delivery.deliveryId) && SHA256.test(delivery.deliveryBindingIdentity)
    && nonEmpty(delivery.task?.identity)
    && nonEmpty(delivery.workflow?.identity)
    && nonEmpty(delivery.workflow?.packageName)
    && nonEmpty(delivery.workflow?.exactPackageVersion)
    && SHA256.test(delivery.workflow?.packageDigest)
    && nonEmpty(delivery.workflow?.snapshotIdentity)
    && SHA256.test(delivery.workflow?.snapshotDigest)
    && LIFECYCLES.has(delivery.lifecycle)
    && delivery.navigation?.sessionCorrelation === sessionCorrelation
    && delivery.detached === false
    && typeof delivery.recoverable === "boolean"
    && Number.isSafeInteger(delivery.timing?.startedAt)
    && Number.isSafeInteger(delivery.timing?.updatedAt)
    && Number.isSafeInteger(delivery.timing?.elapsedMs)
    && delivery.timing.elapsedMs >= 0;
}

function duration(value) {
  const seconds = Math.floor(value / 1000);
  if (seconds < 60) return `${seconds}.${String(value % 1000).padStart(3, "0")}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function safeSnapshot(source) {
  try { return source.getSnapshot(); }
  catch { return { kind: "error", code: "DELIVERY_PROJECTION_UNAVAILABLE", message: "Execution projection unavailable" }; }
}

function safeSubscribe(source, notify) {
  try { const dispose = source.subscribe(notify); return typeof dispose === "function" ? dispose : () => undefined; }
  catch { return () => undefined; }
}

function summaryItem(React, label, value, extra = {}) {
  return React.createElement("div", { className: "crystra-delivery-summary-item", ...extra },
    React.createElement("dt", null, label),
    React.createElement("dd", null, value));
}

function statePanel(React, StateDot, role, code, message) {
  return React.createElement("section", {
    className: "crystra-delivery-view crystra-delivery-state",
    "aria-labelledby": "crystra-delivery-view-title", "aria-live": role === "alert" ? "assertive" : "polite",
    "data-crystra-delivery-view": "true", role,
  }, React.createElement("h2", { className: "crystra-delivery-heading", id: "crystra-delivery-view-title" }, "Delivery"),
  React.createElement("p", null,
    React.createElement(StateDot, { state: role === "alert" ? "error" : "ongoing", size: 10 }), " ", message),
  code === undefined ? null : React.createElement("code", null, code));
}

function statusState(delivery, failed) {
  if (failed) return "error";
  if (delivery.terminal?.outcome === "SUCCEEDED") return "done";
  if (delivery.terminal !== null || ["START_UNCERTAIN", "RESULT_UNRESOLVED", "START_FAILED"].includes(delivery.lifecycle)) return "warning";
  return "ongoing";
}

function identityCard(React, primitives, label, value, displayValue = value) {
  const { Button, IconCheckOutline16, IconCopyOutline16, Tooltip, onCopy, copiedLabel } = primitives;
  const exact = React.createElement("code", {
    "aria-label": `${label}: ${value}`,
    "data-crystra-delivery-identity": label,
    title: value,
  }, displayValue);
  const copied = copiedLabel === label;
  const control = React.createElement(Tooltip, { label: copied ? `${label} copied` : `Copy ${label}`, side: "bottom" },
    React.createElement(Button, {
      "aria-label": `Copy ${label}`,
      icon: React.createElement(copied ? IconCheckOutline16 : IconCopyOutline16, null),
      onClick: () => onCopy(label, value),
      size: "sm",
      type: "button",
      variant: "toolbar",
    }, copied ? "Copied" : "Copy"));
  return React.createElement("div", { className: "crystra-delivery-identity", key: label },
    React.createElement("dt", null, label),
    React.createElement("dd", null, exact, control));
}

/** Render the exact owner `SessionDeliveryView` without a shadow projection. */
export function createSessionDeliveryView(React, primitives = {}) {
  if (typeof React?.createElement !== "function" || typeof React?.useSyncExternalStore !== "function") {
    throw new TypeError("DELIVERY_VIEW_REACT_INVALID");
  }
  const DisclosureRow = primitives.DisclosureRow ?? "div";
  const Button = primitives.Button ?? "button";
  const IconCheckOutline16 = primitives.IconCheckOutline16 ?? "span";
  const IconCopyOutline16 = primitives.IconCopyOutline16 ?? "span";
  const Pill = primitives.Pill ?? "span";
  const StateDot = primitives.StateDot ?? "span";
  const Tooltip = primitives.Tooltip ?? "span";
  const writeClipboard = primitives.writeClipboard ?? (async () => false);
  ensureDeliveryStyles();
  return function SessionDeliveryView({ sessionId, source }) {
    const [identitiesOpen, setIdentitiesOpen] = typeof React.useState === "function"
      ? React.useState(false)
      : [false, () => undefined];
    const [copiedLabel, setCopiedLabel] = typeof React.useState === "function"
      ? React.useState("")
      : ["", () => undefined];
    const state = React.useSyncExternalStore(
      (notify) => safeSubscribe(source, notify),
      () => safeSnapshot(source),
      () => safeSnapshot(source),
    );
    if (state.kind === "loading") return statePanel(React, StateDot, "status", undefined, "Loading Delivery…");
    if (state.kind === "error") return statePanel(React, StateDot, "alert", state.code ?? "DELIVERY_PROJECTION_UNAVAILABLE", state.message ?? "Execution projection unavailable");
    const view = state.view;
    if (state.kind !== "ready" || view?.sessionCorrelation !== sessionId) {
      return statePanel(React, StateDot, "alert", "DELIVERY_PROJECTION_CORRUPT", "Delivery projection invalid");
    }
    if (view.kind === "UNBOUND") return statePanel(React, StateDot, "status", undefined, "No Delivery bound to this Session");
    if (view.kind !== "BOUND" || !validDelivery(view.delivery, sessionId)) {
      return statePanel(React, StateDot, "alert", "DELIVERY_PROJECTION_CORRUPT", "Delivery projection invalid");
    }
    const delivery = view.delivery;
    const failed = delivery.terminal?.outcome === "FAILED" || delivery.error !== null;
    const identityRows = [
      ["Delivery", delivery.deliveryId],
      ["Task", delivery.task.identity, delivery.task.displayName === null ? delivery.task.identity : `${delivery.task.displayName} · ${delivery.task.identity}`],
      ["Workflow", delivery.workflow.identity],
      ["Package", `${delivery.workflow.packageName}@${delivery.workflow.exactPackageVersion}`],
      ["Package digest", delivery.workflow.packageDigest],
      ["Snapshot", delivery.workflow.snapshotIdentity],
      ["Snapshot digest", delivery.workflow.snapshotDigest],
      ["Binding", delivery.deliveryBindingIdentity],
      ...(nonEmpty(delivery.worktree) ? [["Worktree", delivery.worktree]] : []),
    ];
    const statusLabel = delivery.terminal?.outcome ?? delivery.lifecycle;
    const workflowLabel = `${delivery.workflow.identity} · ${delivery.workflow.packageName}@${delivery.workflow.exactPackageVersion}`;
    const summary = [
      summaryItem(React, "Status", React.createElement("span", { className: "crystra-delivery-status" },
        React.createElement(StateDot, { state: statusState(delivery, failed), size: 10 }),
        React.createElement(Pill, { "aria-label": `Delivery status ${statusLabel}` }, statusLabel))),
      summaryItem(React, "Workflow", workflowLabel),
      ...(delivery.current === null ? [] : [summaryItem(
        React,
        delivery.current.kind === "ACTION" ? "Current Action" : "Current Intervention",
        delivery.current.identity,
        { "data-crystra-delivery-conditional": "current" },
      )]),
      ...(delivery.terminal === null ? [] : [summaryItem(React, "Outcome", delivery.terminal.outcome, { "data-crystra-delivery-conditional": "terminal" })]),
      summaryItem(React, "Elapsed", duration(delivery.timing.elapsedMs)),
      summaryItem(React, "Started", new Date(delivery.timing.startedAt).toISOString()),
      ...(delivery.terminal === null ? [] : [summaryItem(React, "Ended", new Date(delivery.terminal.finishedAt).toISOString())]),
    ];
    return React.createElement("section", {
      className: "crystra-delivery-view",
      "aria-labelledby": "crystra-delivery-view-title", "aria-live": failed ? "assertive" : "polite",
      "data-crystra-delivery-id": delivery.deliveryId, "data-crystra-delivery-view": "true", role: failed ? "alert" : "region",
    }, React.createElement("h2", { className: "crystra-delivery-heading", id: "crystra-delivery-view-title" }, "Delivery"),
    React.createElement("dl", { "aria-label": "Delivery summary", "data-crystra-delivery-summary": "true", className: "crystra-delivery-summary" }, summary),
    React.createElement(DisclosureRow, {
      title: "Identity details",
      icon: React.createElement(StateDot, { state: statusState(delivery, failed), size: 10 }),
      open: identitiesOpen,
      expandable: true,
      expandOnRowClick: true,
      onToggle: () => setIdentitiesOpen((open) => !open),
      collapsedContent: React.createElement("code", { className: "crystra-delivery-preview" }, delivery.deliveryId),
    }, React.createElement("dl", { "aria-label": "Delivery identity", className: "crystra-delivery-identities" },
      identityRows.map(([label, value, displayValue]) => identityCard(React, {
        Button,
        IconCheckOutline16,
        IconCopyOutline16,
        Tooltip,
        copiedLabel,
        async onCopy(copyLabel, value) {
          setCopiedLabel(await writeClipboard(value) ? copyLabel : `${copyLabel} copy failed`);
        },
      }, label, value, displayValue))),
    React.createElement("p", {
      "aria-live": "polite", className: "crystra-delivery-copy-feedback", role: "status",
    }, copiedLabel === "" ? "" : copiedLabel.endsWith("copy failed") ? copiedLabel : `${copiedLabel} copied`)),
    delivery.error === null ? null : React.createElement("section", {
      className: "crystra-delivery-condition", "data-crystra-delivery-conditional": "error", role: "alert",
    }, React.createElement("h3", null, "Failure diagnostic"), React.createElement("code", null, delivery.error.code)));
  };
}

export function registerSessionDeliveryView(ctx, options) {
  if (typeof ctx?.slots?.inject !== "function" || typeof ctx?.slots?.register !== "function"
    || typeof options?.bindProjection !== "function") throw new TypeError("DELIVERY_VIEW_REGISTRATION_INVALID");
  const View = createSessionDeliveryView(options.React, options);
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view", id: DELIVERY_VIEW_ID, order: DELIVERY_VIEW_ORDER, label: "Delivery",
    inject: (sessionId) => ({ source: options.bindProjection(sessionId) }),
  }, View));
}
