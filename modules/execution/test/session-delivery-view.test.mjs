import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DELIVERY_VIEW_ID,
  DELIVERY_VIEW_ORDER,
  createSessionDeliveryView,
  registerSessionDeliveryView,
} from "../src/client/delivery/session-delivery-view.js";

function harness() {
  let subscribe;
  return {
    React: {
      createElement(type, props, ...children) { return { type, props: props ?? {}, children: children.flat(Infinity).filter((child) => child != null) }; },
      useState(initial) { return [typeof initial === "function" ? initial() : initial, () => undefined]; },
      useSyncExternalStore(nextSubscribe, getSnapshot) { subscribe = nextSubscribe; return getSnapshot(); },
    },
    subscribe: () => subscribe,
  };
}

function primitives() {
  const copied = [];
  return {
    Button(props) { return { type: "Button", props }; },
    DisclosureRow(props) { return { type: "DisclosureRow", props }; },
    HoverCard(props) { return { type: "HoverCard", props }; },
    IconCheckOutline16(props) { return { type: "IconCheckOutline16", props }; },
    IconCopyOutline16(props) { return { type: "IconCopyOutline16", props }; },
    Pill(props) { return { type: "Pill", props }; },
    StateDot(props) { return { type: "StateDot", props }; },
    Tooltip(props) { return { type: "Tooltip", props }; },
    async writeClipboard(value) { copied.push(value); return true; },
    copied,
  };
}

function elements(node) {
  if (node == null || typeof node !== "object") return [];
  const nested = [
    ...(Array.isArray(node.children) ? node.children : []),
    ...(Array.isArray(node.props?.children) ? node.props.children : [node.props?.children]),
    node.props?.anchor,
    node.props?.content,
    node.props?.collapsedContent,
  ].filter((entry) => entry != null);
  return [node, ...nested.flatMap(elements)];
}

function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return [
    ...(node?.children ?? []),
    node?.props?.anchor,
    node?.props?.content,
    node?.props?.collapsedContent,
  ].filter((entry) => entry != null).map(text).join(" ").replace(/\s+/gu, " ").trim();
}

function delivery(overrides = {}) {
  return Object.freeze({
    deliveryId: "delivery-a",
    deliveryBindingIdentity: `sha256:${"a".repeat(64)}`,
    task: Object.freeze({ identity: "task-a", displayName: "Task A" }),
    worktree: "/workspace/a",
    workflow: Object.freeze({
      identity: "workflow-a", packageName: "hello-world", exactPackageVersion: "1.4.2",
      packageDigest: `sha256:${"b".repeat(64)}`, snapshotIdentity: "snapshot-a", snapshotDigest: `sha256:${"c".repeat(64)}`,
    }),
    lifecycle: "RUNNING_CORRELATED",
    detached: false,
    recoverable: true,
    navigation: Object.freeze({ sessionCorrelation: "session-a" }),
    current: Object.freeze({ kind: "ACTION", identity: "action-a" }),
    timing: Object.freeze({ startedAt: Date.parse("2026-08-29T01:00:00.000Z"), updatedAt: Date.parse("2026-08-29T01:00:01.234Z"), elapsedMs: 1234 }),
    terminal: null,
    error: null,
    ...overrides,
  });
}

const bound = (sessionCorrelation = "session-a", value = delivery()) => Object.freeze({
  kind: "ready",
  view: Object.freeze({ kind: "BOUND", sessionCorrelation, delivery: value }),
});
function source(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    publish(value) { snapshot = value; for (const listener of listeners) listener(); },
  };
}

test("registers one native Delivery conversation view after Chat and Trajectory", () => {
  const registrations = [];
  const ctx = { slots: {
    inject(name, callback) { assert.equal(name, "conversation.view"); callback(); },
    register(options, component) { registrations.push({ options, component }); },
  } };
  const sessionSource = source({ kind: "loading" });
  registerSessionDeliveryView(ctx, { React: harness().React, bindProjection: () => sessionSource });
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].options.id, DELIVERY_VIEW_ID);
  assert.equal(registrations[0].options.order, DELIVERY_VIEW_ORDER);
  assert.deepEqual(registrations[0].options.inject("session-a"), { source: sessionSource });
});

test("renders exact formal owner identities and authoritative lifecycle timing", () => {
  const native = primitives();
  const View = createSessionDeliveryView(harness().React, native);
  const tree = View({ sessionId: "session-a", source: source(bound()) });
  const rendered = text(tree);
  for (const expected of [
    /delivery-a/u, /Task A/u, /workflow-a/u, /hello-world@1\.4\.2/u,
    /sha256:b{64}/u, /snapshot-a/u, /sha256:c{64}/u,
    /RUNNING_CORRELATED/u, /action-a/u, /2026-08-29T01:00:00\.000Z/u, /1\.234s/u,
  ]) assert.match(rendered, expected);
  assert.equal(tree.props["data-crystra-delivery-id"], "delivery-a");
  assert.equal(tree.props.role, "region");
  assert.equal(elements(tree).some((entry) => entry.props?.["data-crystra-delivery-summary"] === "true"), true);
  assert.equal(elements(tree).some((entry) => entry.type === native.Pill), true);
  assert.equal(elements(tree).some((entry) => entry.type === native.StateDot), true);
});

test("uses the exact current run position while active and terminal outcome after current clears", () => {
  const native = primitives();
  const View = createSessionDeliveryView(harness().React, native);
  const active = View({ sessionId: "session-a", source: source(bound()) });
  assert.match(text(active), /Current Action action-a/u);
  assert.doesNotMatch(text(active), /Final Action/u);

  const terminal = View({ sessionId: "session-a", source: source(bound("session-a", delivery({
    lifecycle: "TERMINAL", recoverable: false, current: null,
    terminal: Object.freeze({ outcome: "SUCCEEDED", finishedAt: Date.parse("2026-08-29T01:01:00.000Z") }),
  }))) });
  assert.match(text(terminal), /Outcome SUCCEEDED/u);
  assert.doesNotMatch(text(terminal), /Action/u);
  assert.equal(elements(terminal).some((entry) => entry.props?.["data-crystra-delivery-conditional"] === "current"), false);
});

test("groups exact long identities in a native disclosure with keyboard copy affordances", async () => {
  const native = primitives();
  const View = createSessionDeliveryView(harness().React, native);
  const longDeliveryId = `delivery-${"long".repeat(50)}`;
  const tree = View({ sessionId: "session-a", source: source(bound("session-a", delivery({ deliveryId: longDeliveryId }))) });
  const disclosure = elements(tree).find((entry) => entry.type === native.DisclosureRow);
  const buttons = elements(tree).filter((entry) => entry.type === native.Button);
  const tooltips = elements(tree).filter((entry) => entry.type === native.Tooltip);
  assert.equal(disclosure?.props.title, "Identity details");
  assert.equal(disclosure?.props.expandable, true);
  assert.ok(buttons.length >= 7);
  assert.equal(tooltips.length, buttons.length);
  const deliveryCopy = buttons.find((entry) => entry.props["aria-label"] === "Copy Delivery");
  assert.equal(typeof deliveryCopy?.props.onClick, "function");
  assert.equal(buttons.some((entry) => entry.props["aria-label"] === "Copy Task"), true);
  await deliveryCopy.props.onClick();
  assert.deepEqual(native.copied, [longDeliveryId]);
  assert.equal(elements(tree).some((entry) => entry.props?.role === "status" && entry.props?.["aria-live"] === "polite"), true);
});

test("omits absent optional condition sections instead of reserving empty rows", () => {
  const View = createSessionDeliveryView(harness().React, primitives());
  const active = View({ sessionId: "session-a", source: source(bound("session-a", delivery({ current: null, error: null, terminal: null }))) });
  const conditional = elements(active).filter((entry) => entry.props?.["data-crystra-delivery-conditional"] !== undefined);
  assert.deepEqual(conditional, []);
  assert.doesNotMatch(text(active), /Error|Ended|Outcome|Action|Intervention/u);
});

test("covers running, succeeded, failed, detached, stale, unbound and long localized fixtures", () => {
  const View = createSessionDeliveryView(harness().React, primitives());
  const running = View({ sessionId: "session-a", source: source(bound()) });
  const succeeded = View({ sessionId: "session-a", source: source(bound("session-a", delivery({
    lifecycle: "TERMINAL", recoverable: false, current: null,
    terminal: { outcome: "SUCCEEDED", finishedAt: Date.parse("2026-08-29T01:01:00.000Z") },
  }))) });
  const failed = View({ sessionId: "session-a", source: source(bound("session-a", delivery({
    lifecycle: "TERMINAL", recoverable: false, current: null,
    terminal: { outcome: "FAILED", finishedAt: Date.parse("2026-08-29T01:01:00.000Z") }, error: { code: "ACTION_FAILED" },
  }))) });
  const detached = View({ sessionId: "session-a", source: source(bound("session-a", delivery({ detached: true, navigation: null }))) });
  const stale = View({ sessionId: "session-a", source: source({ kind: "error", code: "DELIVERY_PROJECTION_STALE_BINDING", message: "Delivery control plane unavailable" }) });
  const unbound = View({ sessionId: "session-a", source: source({ kind: "ready", view: { kind: "UNBOUND", sessionCorrelation: "session-a" } }) });
  const localized = "正在等待具有很长本地化名称的执行步骤完成".repeat(8);
  const longCopy = View({ sessionId: "session-a", source: source(bound("session-a", delivery({
    current: { kind: "INTERVENTION", identity: localized },
  }))) });

  assert.equal(running.props.role, "region");
  assert.match(text(succeeded), /Outcome SUCCEEDED/u);
  assert.equal(failed.props.role, "alert");
  assert.match(text(failed), /ACTION_FAILED/u);
  assert.equal(detached.props.role, "alert");
  assert.match(text(stale), /DELIVERY_PROJECTION_STALE_BINDING/u);
  assert.equal(unbound.props.role, "status");
  assert.match(text(longCopy), new RegExp(localized, "u"));
});

test("defines scoped compact, narrow, zoom-safe and reduced-motion layout rules", async () => {
  const sourceText = await readFile(new URL("../src/client/delivery/session-delivery-view.js", import.meta.url), "utf8");
  assert.match(sourceText, /\.crystra-delivery-summary\s*\{[^}]*display:\s*grid/su);
  assert.match(sourceText, /\.crystra-delivery-identities\s*\{[^}]*display:\s*grid/su);
  assert.match(sourceText, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*180px\),\s*1fr\)\)/u);
  assert.match(sourceText, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*260px\),\s*1fr\)\)/u);
  assert.match(sourceText, /\.crystra-delivery-identity dd\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/su);
  assert.match(sourceText, /\.crystra-delivery-preview\s*\{[^}]*margin-inline-start:\s*8px/su);
  assert.match(sourceText, /minmax\(0,\s*1fr\)/u);
  assert.match(sourceText, /text-overflow:\s*ellipsis/u);
  assert.match(sourceText, /overflow-wrap:\s*anywhere/u);
  assert.match(sourceText, /@media\s*\(max-width:\s*420px\)/u);
  assert.match(sourceText, /@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
  assert.match(sourceText, /var\(--dsw-alias-border-l2\)/u);
  assert.match(sourceText, /var\(--dsw-alias-bg-layer-1\)/u);
  assert.doesNotMatch(sourceText, /--dsw-alias-(?:border-subtle|background-secondary|state-warning-primary)/u);
});

test("isolates session switches and rejects a view scoped to another Session", () => {
  const View = createSessionDeliveryView(harness().React);
  const first = View({ sessionId: "session-a", source: source(bound()) });
  const stale = View({ sessionId: "session-b", source: source(bound()) });
  assert.match(text(first), /delivery-a/u);
  assert.equal(stale.props.role, "alert");
  assert.match(text(stale), /projection invalid/u);
});

test("subscribes to replay and recovery without executing a command", () => {
  const hooks = harness();
  const View = createSessionDeliveryView(hooks.React);
  const sessionSource = source({ kind: "loading" });
  assert.match(text(View({ sessionId: "session-a", source: sessionSource })), /Loading Delivery/u);
  let notified = false;
  hooks.subscribe()(() => { notified = true; });
  sessionSource.publish(bound("session-a", delivery({ lifecycle: "RESULT_UNRESOLVED" })));
  assert.equal(notified, true);
  assert.match(text(View({ sessionId: "session-a", source: sessionSource })), /RESULT_UNRESOLVED/u);
});

test("renders unbound, terminal and owner errors accessibly", () => {
  const View = createSessionDeliveryView(harness().React);
  const empty = View({ sessionId: "session-a", source: source({ kind: "ready", view: { kind: "UNBOUND", sessionCorrelation: "session-a" } }) });
  const unavailable = View({ sessionId: "session-a", source: source({ kind: "error", code: "DELIVERY_PROJECTION_UNAVAILABLE", message: "Execution projection unavailable" }) });
  const failed = View({ sessionId: "session-a", source: source(bound("session-a", delivery({
    lifecycle: "TERMINAL", recoverable: false, current: null,
    terminal: Object.freeze({ outcome: "FAILED", finishedAt: Date.parse("2026-08-29T01:01:00.000Z") }),
    error: Object.freeze({ code: "ACTION_FAILED" }),
  }))) });
  assert.equal(empty.props.role, "status");
  assert.match(text(empty), /No Delivery bound/u);
  assert.equal(unavailable.props.role, "alert");
  assert.match(text(unavailable), /DELIVERY_PROJECTION_UNAVAILABLE/u);
  assert.equal(failed.props.role, "alert");
  assert.match(text(failed), /FAILED/u);
  assert.match(text(failed), /ACTION_FAILED/u);
});

test("fails closed for malformed, unknown lifecycle and binding identity drift", () => {
  const View = createSessionDeliveryView(harness().React);
  for (const state of [
    { kind: "ready", view: null },
    bound("session-a", delivery({ lifecycle: "FUTURE" })),
    bound("session-a", delivery({ deliveryBindingIdentity: `sha256:${"d".repeat(63)}` })),
    bound("session-a", delivery({ navigation: { sessionCorrelation: "session-other" } })),
  ]) {
    const tree = View({ sessionId: "session-a", source: source(state) });
    assert.equal(tree.props.role, "alert");
    assert.match(text(tree), /projection invalid/u);
  }
});
