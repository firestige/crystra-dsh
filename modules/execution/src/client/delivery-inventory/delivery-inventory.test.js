import assert from "node:assert/strict";
import test from "node:test";

import {
  projectDeliveryInventory,
} from "./model.js";

const delivery = (deliveryId, overrides = {}) => Object.freeze({
  deliveryId,
  task: Object.freeze({ identity: `task-${deliveryId}`, displayName: deliveryId === "delivery-a" ? "Alpha" : "Beta" }),
  lifecycle: "RUNNING_CORRELATED",
  detached: false,
  recoverable: true,
  navigation: Object.freeze({ sessionCorrelation: `session-${deliveryId.at(-1)}` }),
  terminal: null,
  ...overrides,
});
const formal = (generation = 7, deliveries = [delivery("delivery-b"), delivery("delivery-a", {
  lifecycle: "BOUND", detached: true, navigation: null,
})]) => Object.freeze({
  schemaVersion: "execution.delivery-control-plane@1.0.0",
  generation,
  deliveries: Object.freeze(deliveries),
});

test("projects the formal owner snapshot deterministically without a shadow domain shape", () => {
  const view = projectDeliveryInventory({ kind: "ready", snapshot: formal() }, { selectedSessionId: "session-b" });
  assert.equal(view.kind, "ready");
  assert.deepEqual(view.rows.map(({ deliveryId }) => deliveryId), ["delivery-a", "delivery-b"]);
  assert.deepEqual(view.rows[0], {
    deliveryId: "delivery-a", label: "Alpha", statusLabel: "Bound",
    sessionId: null, availability: "recoverable", selected: false,
  });
  assert.equal(view.rows[1].selected, true);
  assert.ok(Object.isFrozen(view.rows));
});

test("represents loading, empty, error and reconnecting accessibly", () => {
  assert.deepEqual(projectDeliveryInventory({ kind: "loading" }), {
    kind: "loading", role: "status", label: "Loading Deliveries", rows: [],
  });
  assert.deepEqual(projectDeliveryInventory({ kind: "ready", snapshot: formal(1, []) }), {
    kind: "empty", role: "status", label: "No Deliveries", rows: [],
  });
  assert.equal(projectDeliveryInventory({ kind: "reconnecting", snapshot: formal() }).kind, "reconnecting");
  assert.deepEqual(projectDeliveryInventory({ kind: "error", message: "Inventory unavailable" }), {
    kind: "error", role: "alert", label: "Inventory unavailable", rows: [],
  });
  assert.deepEqual(projectDeliveryInventory({ kind: "error", code: "DELIVERY_PROJECTION_STALE_BINDING", message: "Inventory unavailable" }), {
    kind: "error", role: "alert", label: "DELIVERY_PROJECTION_STALE_BINDING: Inventory unavailable", rows: [],
  });
  assert.equal(projectDeliveryInventory({ kind: "reconnecting", code: "DELIVERY_PROJECTION_UNAVAILABLE", snapshot: formal() }).label,
    "DELIVERY_PROJECTION_UNAVAILABLE: Reconnecting to Delivery inventory");
});

test("fails closed for malformed generations, lifecycles and duplicate identities", () => {
  assert.equal(projectDeliveryInventory({ kind: "ready", snapshot: { ...formal(), generation: 0 } }).kind, "error");
  assert.equal(projectDeliveryInventory({ kind: "ready", snapshot: formal(2, [delivery("delivery-a"), delivery("delivery-a")]) }).kind, "error");
  assert.equal(projectDeliveryInventory({ kind: "ready", snapshot: formal(3, [delivery("delivery-a", { lifecycle: "FUTURE" })]) }).kind, "error");
});

test("large owner inventory remains deterministic and detached rows never navigate", () => {
  const deliveries = Array.from({ length: 2000 }, (_, index) => delivery(`delivery-${String(1999 - index).padStart(4, "0")}`, {
    detached: index % 2 === 1,
    recoverable: index % 3 === 0,
    navigation: index % 2 === 0 ? { sessionCorrelation: `session-${index}` } : null,
  }));
  const view = projectDeliveryInventory({ kind: "ready", snapshot: formal(9, deliveries) });
  assert.equal(view.rows.length, 2000);
  assert.equal(view.rows[0].deliveryId, "delivery-0000");
  assert.equal(view.rows.at(-1).deliveryId, "delivery-1999");
  assert.equal(view.rows.find(({ availability }) => availability === "detached").sessionId, null);
});
