const CONTROL_PLANE_SCHEMA = "execution.delivery-control-plane@1.0.0";
const LIFECYCLES = new Set([
  "BOUND", "START_UNCERTAIN", "RUNNING_CORRELATED", "START_FAILED",
  "RESULT_UNRESOLVED", "TERMINAL_HANDLING", "TERMINAL",
]);
const WORKSPACE_KEY = "crystra.sidebar.workspace.expanded.v1";
const DELIVERY_KEY = "crystra.sidebar.delivery.expanded.v1";
const ERROR_CODES = new Set([
  "DELIVERY_PROJECTION_CORRUPT",
  "DELIVERY_PROJECTION_STALE_BINDING",
  "DELIVERY_PROJECTION_RECOVERY_MISMATCH",
  "DELIVERY_PROJECTION_UNAVAILABLE",
]);

function errorView(label = "Delivery inventory unavailable") {
  return Object.freeze({ kind: "error", role: "alert", label, rows: Object.freeze([]) });
}

function diagnostic(state, label) {
  return typeof state?.code === "string" && ERROR_CODES.has(state.code) ? `${state.code}: ${label}` : label;
}

function validString(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 512;
}

function lifecycleLabel(delivery) {
  if (delivery.lifecycle === "TERMINAL") return delivery.terminal?.outcome ?? "Terminal";
  return delivery.lifecycle.toLowerCase().replaceAll("_", " ").replace(/^./u, (value) => value.toUpperCase());
}

function rowsFrom(deliveries, selectedSessionId) {
  if (!Array.isArray(deliveries)) return undefined;
  const identities = new Set();
  const rows = [];
  for (const delivery of deliveries) {
    const sessionCorrelation = delivery?.navigation?.sessionCorrelation ?? null;
    if (delivery === null || typeof delivery !== "object" || Array.isArray(delivery)
      || !validString(delivery.deliveryId) || identities.has(delivery.deliveryId)
      || !LIFECYCLES.has(delivery.lifecycle)
      || typeof delivery.detached !== "boolean" || typeof delivery.recoverable !== "boolean"
      || !validString(delivery.task?.identity)
      || !(delivery.task.displayName === null || validString(delivery.task.displayName))
      || !(sessionCorrelation === null || validString(sessionCorrelation))) return undefined;
    identities.add(delivery.deliveryId);
    rows.push(Object.freeze({
      deliveryId: delivery.deliveryId,
      label: delivery.task.displayName ?? delivery.task.identity,
      statusLabel: lifecycleLabel(delivery),
      sessionId: sessionCorrelation,
      availability: sessionCorrelation !== null ? "bound" : delivery.recoverable ? "recoverable" : "detached",
      selected: sessionCorrelation !== null && sessionCorrelation === selectedSessionId,
    }));
  }
  rows.sort((left, right) => left.deliveryId.localeCompare(right.deliveryId));
  return Object.freeze(rows);
}

/** Project only the formal Execution DeliveryControlPlaneSnapshot. */
export function projectDeliveryInventory(state, { selectedSessionId } = {}) {
  if (state?.kind === "loading") return Object.freeze({ kind: "loading", role: "status", label: "Loading Deliveries", rows: Object.freeze([]) });
  if (state?.kind === "error") {
    const label = validString(state.message) ? state.message : "Delivery inventory unavailable";
    return errorView(diagnostic(state, label));
  }
  if (!new Set(["ready", "reconnecting"]).has(state?.kind)) return errorView();
  const snapshot = state.snapshot;
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)
    || snapshot.schemaVersion !== CONTROL_PLANE_SCHEMA
    || !Number.isSafeInteger(snapshot.generation) || snapshot.generation < 1) return errorView();
  const rows = rowsFrom(snapshot.deliveries, selectedSessionId);
  if (rows === undefined) return errorView();
  if (state.kind === "reconnecting") return Object.freeze({
    kind: "reconnecting", role: "status", label: diagnostic(state, "Reconnecting to Delivery inventory"), rows,
  });
  if (rows.length === 0) return Object.freeze({ kind: "empty", role: "status", label: "No Deliveries", rows });
  return Object.freeze({ kind: "ready", role: "list", label: "Deliveries", rows });
}

export function createDeliveryInventoryController(inventory) {
  if (inventory === null || typeof inventory !== "object"
    || typeof inventory.getSnapshot !== "function" || typeof inventory.subscribe !== "function") {
    throw new TypeError("Execution inventory projection must be read-only and subscribable");
  }
  const controller = {
    getSnapshot() {
      try { return projectDeliveryInventory(inventory.getSnapshot()); }
      catch { return errorView(); }
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("inventory listener must be a function");
      const unsubscribe = inventory.subscribe(() => listener(controller.getSnapshot()));
      if (typeof unsubscribe !== "function") throw new TypeError("inventory subscription must return an unsubscribe function");
      return unsubscribe;
    },
  };
  return Object.freeze(controller);
}

function persistedBoolean(value) {
  return value === "false" ? false : true;
}

export function createMemoryCollapseStore(storage = {}) {
  const listeners = new Set();
  const read = typeof storage.read === "function" ? storage.read : () => undefined;
  const write = typeof storage.write === "function" ? storage.write : () => undefined;
  let snapshot;
  try {
    snapshot = Object.freeze({
      workspaceExpanded: persistedBoolean(read(WORKSPACE_KEY)),
      deliveryExpanded: persistedBoolean(read(DELIVERY_KEY)),
    });
  } catch {
    snapshot = Object.freeze({ workspaceExpanded: true, deliveryExpanded: true });
  }
  const update = (name, key, value) => {
    const next = Boolean(value);
    if (snapshot[name] === next) return;
    snapshot = Object.freeze({ ...snapshot, [name]: next });
    try { write(key, String(next)); } catch { /* persistence denial is non-fatal */ }
    for (const listener of listeners) listener();
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setWorkspaceExpanded(value) { update("workspaceExpanded", WORKSPACE_KEY, value); },
    setDeliveryExpanded(value) { update("deliveryExpanded", DELIVERY_KEY, value); },
  });
}
