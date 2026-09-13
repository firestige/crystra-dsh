import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createDeliveryInventoryController,
  createMemoryCollapseStore,
  projectDeliveryInventory,
} from "./model.js";
import { applyDeliverySidebar } from "./sidebar.js";

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

test("controller replays browser store recovery without commands or mutation", () => {
  let state = { kind: "loading" };
  let listener;
  const inventory = Object.freeze({
    getSnapshot: () => state,
    subscribe(notify) { listener = notify; return () => undefined; },
  });
  const controller = createDeliveryInventoryController(inventory);
  const observed = [];
  controller.subscribe((value) => observed.push(value.kind));
  assert.deepEqual(Object.keys(controller).sort(), ["getSnapshot", "subscribe"]);
  assert.equal(controller.getSnapshot().kind, "loading");
  state = { kind: "ready", snapshot: formal() }; listener();
  state = { kind: "error", message: "Disconnected" }; listener();
  state = { kind: "ready", snapshot: formal(8) }; listener();
  assert.deepEqual(observed, ["ready", "error", "ready"]);
});

test("collapse state is independent and persists with safe defaults", () => {
  const persisted = new Map();
  const store = createMemoryCollapseStore({ read: (key) => persisted.get(key), write: (key, value) => persisted.set(key, value) });
  store.setWorkspaceExpanded(false);
  assert.deepEqual(store.getSnapshot(), { workspaceExpanded: false, deliveryExpanded: true });
  store.setDeliveryExpanded(false);
  assert.deepEqual(store.getSnapshot(), { workspaceExpanded: false, deliveryExpanded: false });
  assert.equal(persisted.get("crystra.sidebar.workspace.expanded.v1"), "false");
  assert.equal(persisted.get("crystra.sidebar.delivery.expanded.v1"), "false");
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

test("Harness composition owns the single slot and renders Workspace as a child without DOM reparenting", async () => {
  const registrations = [];
  const stateUpdates = [];
  const React = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children }; },
    useMemo(factory) { return factory(); },
    useState(initial) { return [typeof initial === "function" ? initial() : initial, (value) => stateUpdates.push(value)]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  function WorkspaceBrowser() { return null; }
  const workspaceUi = { apply(forked) {
    forked.slots.inject("sidebar.workspaces", () => forked.slots.register({ name: "sidebar.workspaces" }, WorkspaceBrowser));
  } };
  const ctx = { slots: {
    inject(_name, factory) { return factory(); },
    register(definition, component) { registrations.push({ definition, component }); return () => undefined; },
  } };
  applyDeliverySidebar(ctx, {
    React, workspaceUi,
    inventory: { getSnapshot: () => ({ kind: "ready", snapshot: formal() }), subscribe: () => () => undefined },
  });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].component.name, "CrystraSidebarResources");
  const tree = registrations[0].component({ useSessions: (select) => select({ current: "session-b" }), open() {} });
  assert.equal(tree.children[0].props["aria-label"], "Workspace");
  assert.equal(tree.children[0].props["data-expanded"], true);
  assert.equal(tree.children[1].props["aria-label"], "Delivery");
  assert.equal(tree.children[1].props["data-expanded"], true);
  assert.equal(tree.children[0].children[1].props.className, "crystra-sidebar-resource-content");
  assert.equal(tree.children[1].children[1].props.className, "crystra-sidebar-resource-content");
  assert.equal(tree.children[0].children[1].children[0].type, WorkspaceBrowser);
  const deliveryHeader = tree.children[1].children[0];
  assert.equal(deliveryHeader.props["aria-controls"], "crystra-sidebar-delivery");
  assert.equal(deliveryHeader.props["aria-expanded"], true);
  let prevented = false;
  deliveryHeader.props.onKeyDown({ key: "Enter", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(stateUpdates, [false]);

  const source = await readFile(new URL("./sidebar.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /querySelector|appendChild|insertBefore|\/crystra list|\.command\(/u);
});

test("sidebar resources negotiate bounded height and keep overflow inside each expanded content region", async () => {
  const source = await readFile(new URL("./sidebar.js", import.meta.url), "utf8");

  assert.match(source, /\.crystra-sidebar-resources\{[^}]*height:100%[^}]*overflow:hidden/u);
  assert.match(source, /\.crystra-sidebar-resource\{[^}]*flex:0 0 auto[^}]*overflow:hidden/u);
  assert.match(source, /\.crystra-sidebar-resource\[data-expanded=true\]\{[^}]*flex:1 1 0/u);
  assert.match(source, /\.crystra-sidebar-resource-content\{[^}]*min-height:0[^}]*flex:1 1 auto[^}]*overflow:auto/u);
  assert.match(source, /\.crystra-sidebar-resource-header\{[^}]*flex:0 0 36px/u);
  assert.doesNotMatch(source, /\.crystra-sidebar-resource:first-child/u);
});

test("fixed upstream Workspace UI coordinate and MIT attribution are exact", async () => {
  const attribution = await readFile(new URL("./UPSTREAM.md", import.meta.url), "utf8");
  const license = await readFile(new URL("./LICENSE.upstream", import.meta.url), "utf8");
  assert.match(attribution, /@deepseek-ai\/dsh-client-ui-workspace@0\.1\.1-rc\.2/u);
  assert.match(attribution, /sha512-k\/jB5ke2e\+oNyNKzu4\/PBlriwCHKVg5bY3kn7Co3MtWZdqbJ42hfwZkRNMnn\+nmziQXCVXWRzuiHZt0xNTAveA==/u);
  assert.match(license, /Copyright \(c\) 2026 DeepSeek/u);
});
