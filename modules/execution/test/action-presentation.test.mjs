import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  DSH_ACTION_PRESENTATION_COMPATIBILITY,
  createExecutionPresentationDefinition,
  parseExecutionPresentation,
  projectExecutionPresentation,
  resolveDisclosureOpen,
} from "../src/action-presentation/model.js";
import {
  createActionPresentationView,
  createCrystraCommandView,
  registerActionPresentation,
} from "../src/action-presentation/view.js";

const valid = (kind, data = {}, correlation = "delivery-1:action-1") => ({
  schemaVersion: "crystra.presentation@1.0.0",
  correlation,
  kind,
  data,
});

function elementsOf(node) {
  if (node === null || node === undefined || typeof node !== "object") return [];
  const children = Array.isArray(node.props?.children) ? node.props.children : [];
  return [node, ...children.flatMap(elementsOf)];
}

function statefulReact() {
  const state = [];
  const refs = [];
  let stateCursor = 0;
  let refCursor = 0;
  return {
    beginRender() { stateCursor = 0; refCursor = 0; },
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {},
    useRef(value) {
      const index = refCursor++;
      refs[index] ??= { current: value };
      return refs[index];
    },
    useState(initial) {
      const index = stateCursor++;
      state[index] ??= typeof initial === "function" ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
  };
}

test("locks the renderer to the DSH release that formally exports DisclosureRow", () => {
  assert.deepEqual(DSH_ACTION_PRESENTATION_COMPATIBILITY, {
    dsh: "0.1.1-rc.2",
    uiPrimitives: "@deepseek-ai/dsh-client-ui-primitives@0.1.1-rc.2",
    presentation: "crystra.presentation@1.0.0",
  });
});

test("projects durable Execution progress, tool, Action and final facts without changing their domain identity", () => {
  assert.deepEqual(projectExecutionPresentation(parseExecutionPresentation(valid("delivery-running", {
    deliveryId: "delivery-1", state: "RECOVERING",
  }))), {
    correlation: "delivery-1:action-1", layer: "progress", state: "recovering",
    title: "Workflow delivery", summary: "Recovering · delivery-1", body: undefined,
    defaultOpen: false, focusPolicy: "none", role: "status", compatibility: "current",
  });

  assert.deepEqual(projectExecutionPresentation(parseExecutionPresentation(valid("action-output", {
    channel: "tool", state: "running", label: "Inspect repository", content: { text: "Reading files" },
  }))), {
    correlation: "delivery-1:action-1", layer: "tool", state: "running",
    title: "Inspect repository", summary: "Running", body: "Reading files",
    defaultOpen: false, focusPolicy: "none", role: "status", compatibility: "current",
  });

  assert.deepEqual(projectExecutionPresentation(parseExecutionPresentation(valid("action-output", {
    state: "completed", label: "Review change", content: { text: "All checks passed" },
  }))), {
    correlation: "delivery-1:action-1", layer: "action", state: "completed",
    title: "Review change", summary: "Completed", body: "All checks passed",
    defaultOpen: false, focusPolicy: "none", role: "status", compatibility: "current",
  });

  assert.deepEqual(projectExecutionPresentation(parseExecutionPresentation(valid("terminal-result", {
    outcome: "SUCCEEDED", finalOutput: "The delivery is ready.",
  }))), {
    correlation: "delivery-1:action-1", layer: "final", state: "completed",
    title: "Final result", summary: "Succeeded", body: "The delivery is ready.",
    defaultOpen: false, focusPolicy: "none", role: "article", compatibility: "current",
  });
});

test("projects uncertain, correlated, and unresolved Delivery states without an endless recovering spinner", () => {
  const states = [
    ["START_UNCERTAIN", "uncertain", "Start uncertain"],
    ["RUNNING_CORRELATED", "running", "Running"],
    ["RESULT_UNRESOLVED", "unresolved", "Result unresolved"],
  ];
  for (const [input, state, label] of states) {
    assert.deepEqual(projectExecutionPresentation(parseExecutionPresentation(valid("delivery-status", {
      deliveryId: "delivery-1", state: input,
    }))), {
      correlation: "delivery-1:action-1", layer: "progress", state,
      title: "Workflow delivery", summary: `${label} · delivery-1`, body: undefined,
      defaultOpen: false, focusPolicy: "none", role: "status", compatibility: "current",
    });
  }
  assert.deepEqual(projectExecutionPresentation(parseExecutionPresentation(valid("delivery-status", {
    deliveryId: "delivery-1", state: "RESULT_UNRESOLVED",
    diagnostic: { stage: "HOST_START", causeCode: "CHECKPOINT_ORDER_VIOLATION" },
  }))).body, "HOST_START · CHECKPOINT_ORDER_VIOLATION");
});

test("reconciles an initial START_UNCERTAIN command card from the correlated owner projection", () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {}, useRef(value) { return { current: value }; }, useState(value) { return [value, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const inventory = {
    subscribe() { return () => undefined; },
    getSnapshot() {
      return { kind: "ready", snapshot: { deliveries: [{ deliveryId: "delivery-1", lifecycle: "RUNNING_CORRELATED", terminal: null }] } };
    },
  };
  const View = createCrystraCommandView({
    React, inventory,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot: (props) => ({ type: "StateDot", props }),
  });
  const tree = View({ node: {
    commandId: "command-1", name: "crystra",
    outcome: { kind: "success", text: JSON.stringify(valid("delivery-running", {
      deliveryId: "delivery-1", state: "START_UNCERTAIN",
    })) },
  } });
  assert.equal(tree.props.icon.props.state, "ongoing");
  assert.match(JSON.stringify(tree.props.collapsedContent), /Running · delivery-1/u);
  assert.doesNotMatch(JSON.stringify(tree.props.collapsedContent), /uncertain/iu);
});

test("preserves the bounded cause while reconciling an unresolved command card and exposes its semantic state", () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {}, useRef(value) { return { current: value }; }, useState(value) { return [value, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const inventory = {
    subscribe() { return () => undefined; },
    getSnapshot() {
      return { kind: "ready", snapshot: { deliveries: [{ deliveryId: "delivery-1", lifecycle: "RESULT_UNRESOLVED", terminal: null }] } };
    },
  };
  const View = createCrystraCommandView({
    React, inventory,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot: (props) => ({ type: "StateDot", props }),
  });
  const tree = View({ node: {
    commandId: "command-1", name: "crystra",
    outcome: { kind: "success", text: JSON.stringify(valid("delivery-status", {
      deliveryId: "delivery-1", state: "RESULT_UNRESOLVED",
      diagnostic: { stage: "HOST_START", causeCode: "DATAFLOW_BINDING_INVALID" },
    })) },
  } });

  assert.match(JSON.stringify(tree), /HOST_START.*DATAFLOW_BINDING_INVALID/u);
  assert.equal(tree.props.collapsedContent.props["data-crystra-state"], "unresolved");
});

test("keeps Action input visible and focusable instead of hiding it behind a completed disclosure", () => {
  assert.deepEqual(projectExecutionPresentation(parseExecutionPresentation(valid("action-input-request", {
    label: "Choose deployment", prompt: { question: "Promote now?" },
  }))), {
    correlation: "delivery-1:action-1", layer: "action", state: "waiting",
    title: "Choose deployment", summary: "Waiting for input", body: "Promote now?",
    defaultOpen: true, focusPolicy: "preserve", role: "status", compatibility: "current",
  });
});

test("keeps focused content open across completion and otherwise applies lifecycle defaults", () => {
  assert.equal(resolveDisclosureOpen({ current: true, previousState: "running", nextState: "completed", containsFocus: true }), true);
  assert.equal(resolveDisclosureOpen({ current: true, previousState: "running", nextState: "completed", containsFocus: false }), false);
  assert.equal(resolveDisclosureOpen({ current: false, previousState: "completed", nextState: "failed", containsFocus: false }), false);
  assert.equal(resolveDisclosureOpen({ current: false, previousState: "waiting", nextState: "waiting", containsFocus: false }), true);
});

test("keeps non-interactive presentation nodes collapsed until the user opens them", () => {
  for (const event of [
    valid("delivery-running", { deliveryId: "delivery-1", state: "RUNNING_CORRELATED" }),
    valid("action-output", { state: "running", content: { text: "Working" } }),
    valid("action-output", { state: "failed", content: { text: "Failed" } }),
    valid("terminal-result", { outcome: "FAILED", finalOutput: "Failed" }),
    valid("error", { code: "DELIVERY_FAILED", message: "Delivery failed" }),
  ]) {
    assert.equal(projectExecutionPresentation(parseExecutionPresentation(event)).defaultOpen, false);
  }
});

test("supports the previous terminal summary explicitly while never duplicating Action output as a final answer", () => {
  const legacyFinal = projectExecutionPresentation(parseExecutionPresentation(valid("terminal-result", {
    outcome: "SUCCEEDED", summary: "Legacy durable answer",
  })));
  assert.equal(legacyFinal.body, "Legacy durable answer");
  assert.equal(legacyFinal.compatibility, "legacy-summary");

  const action = projectExecutionPresentation(parseExecutionPresentation(valid("action-output", {
    content: { text: "internal Action output" },
  })));
  assert.equal(action.layer, "action");
  assert.notEqual(action.role, "article");
});

test("fails closed for unknown revisions, kinds, states and unusable final results", () => {
  for (const event of [
    { ...valid("action-output", { content: { text: "secret" } }), schemaVersion: "crystra.presentation@2.0.0" },
    valid("future-kind", { content: { text: "secret" } }),
    valid("action-output", { state: "future", content: { text: "secret" } }),
    valid("delivery-status", { state: "FUTURE", message: "secret" }),
    valid("terminal-result", { outcome: "SUCCEEDED", finalOutput: "" }),
    { ...valid("action-output"), extra: true },
  ]) {
    const parsed = parseExecutionPresentation(event);
    assert.equal(parsed.kind, "error");
    assert.equal(parsed.correlation, "presentation-invalid");
    assert.deepEqual(parsed.data, { code: "CRYSTRA_PRESENTATION_INVALID", message: "CRYSTRA presentation unavailable" });
    assert.doesNotMatch(JSON.stringify(parsed), /secret/u);
  }
});

test("parses bounded durable JSON in the browser without relying on Node Buffer", () => {
  const saved = globalThis.Buffer;
  try {
    globalThis.Buffer = undefined;
    assert.equal(parseExecutionPresentation(JSON.stringify(valid("action-output", {
      content: { text: "browser-safe" },
    }))).correlation, "delivery-1:action-1");
  } finally {
    globalThis.Buffer = saved;
  }
});

test("builds a replay-stable CRYSTRA conversation node from durable Harness command facts", () => {
  const definition = createExecutionPresentationDefinition();
  const startEvent = { seq: 41, type: "command/run", data: {
    commandId: "presentation-1", name: "crystra", source: { kind: "plugin", plugin: "workflow-execution" },
  } };
  const doneEvent = { seq: 42, type: "command/done", data: {
    commandId: "presentation-1", kind: "success", text: JSON.stringify(valid("action-output", {
      state: "cancelled", content: { text: "Stopped by user" },
    })),
  } };

  const start = definition.match(startEvent);
  assert.deepEqual(start, { id: "presentation-1", role: "start" });
  const context = { key: "crystra:presentation-1", id: start.id, start: { location: { kind: "turn", turn: 2 } } };
  const initial = definition.start(context, { ...start, event: startEvent });
  const updateMatch = definition.match(doneEvent);
  const state = definition.update({ ...context, state: initial }, { ...updateMatch, event: doneEvent });
  const node = definition.buildViewNode({ ...context, state });

  assert.deepEqual(node, {
    key: "crystra:presentation-1", kind: "crystra-execution-presentation", id: "presentation-1",
    target: "chat", anchorSeq: 41, location: { kind: "turn", turn: 2 }, visibility: "visible",
    data: {
      correlation: "delivery-1:action-1", layer: "action", state: "cancelled",
      title: "Workflow Action", summary: "Cancelled", body: "Stopped by user",
      defaultOpen: false, focusPolicy: "none", role: "status", compatibility: "current",
    },
  });
  assert.deepEqual(definition.buildViewNode({ ...context, state }), node);
});

test("leaves the known delivery-list event to its feature owner instead of rendering a false error", () => {
  const definition = createExecutionPresentationDefinition();
  const context = {
    key: "crystra:list-1", id: "list-1", start: { location: { kind: "turn", turn: 2 } },
    state: { seq: 51, presentation: undefined },
  };
  const state = definition.update(context, { event: { seq: 52, type: "command/done", data: {
    commandId: "list-1", kind: "success", text: JSON.stringify(valid("delivery-list", { items: [] })),
  } } });
  assert.equal(definition.buildViewNode({ ...context, state }), null);
});

test("keeps a successful control-plane terminal without public output out of the chat instead of fabricating an invalid presentation", () => {
  const definition = createExecutionPresentationDefinition();
  const context = {
    key: "crystra:terminal-1", id: "terminal-1", start: { location: { kind: "turn", turn: 2 } },
    state: { seq: 61, presentation: undefined },
  };
  const state = definition.update(context, { event: { seq: 62, type: "command/done", data: {
    commandId: "terminal-1", kind: "success", text: JSON.stringify(valid("terminal-result", { outcome: "SUCCEEDED" })),
  } } });

  assert.equal(definition.buildViewNode({ ...context, state }), null);
});

test("hides the native command row and renders only the later ordered presentation row", () => {
  const calls = [];
  const ctx = {
    slots: {
      inject(name, callback) { calls.push(["inject", name]); callback(); },
      register(specification, view) { calls.push(["register", specification, view]); },
    },
  };
  const View = () => null;
  registerActionPresentation(ctx, View);

  assert.deepEqual(calls[0], ["inject", "conversation.chat.commandview"]);
  assert.deepEqual(calls[1][1], { name: "conversation.chat.commandview", key: "crystra" });
  assert.equal(calls[1][2](), null);
  assert.deepEqual(calls[2][1], { name: "conversation.chat.commandview", key: "crystra-presentation" });
  assert.equal(calls[2][2], View);
  assert.equal(calls.some((entry) => JSON.stringify(entry).includes("conversation.chat.node")), false);
  assert.equal(calls.some((entry) => JSON.stringify(entry).includes("tool.call.toolview")), false);
});

test("renders friendly diagnostics and the complete bounded presentation JSON from a single-line command result", () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {},
    useRef(value) { return { current: value }; },
    useState(value) { return [value, () => undefined]; },
  };
  const DisclosureRow = (props) => ({ type: "DisclosureRow", props });
  const MessageText = (props) => ({ type: "MessageText", props });
  const StateDot = (props) => ({ type: "StateDot", props });
  const JsonTree = (props) => ({ type: "JsonTree", props });
  const View = createCrystraCommandView({ React, DisclosureRow, MessageText, StateDot, JsonTree });
  const presentation = valid("error", {
    code: "TASK_PROMPT_REQUIRED",
    message: "Add a Task instruction after the Workflow selector or attach a file.",
  }, "presentation-error-1");

  const tree = View({ node: {
    commandId: "command-1", name: "crystra", args: " create hello-world-workflow@0.2.0",
    outcome: { kind: "error", text: JSON.stringify(presentation) },
  } });

  assert.equal(tree.type, DisclosureRow);
  assert.equal(tree.props.open, false);
  assert.match(JSON.stringify(tree), /Add a Task instruction/u);
  const detail = tree.props.children[0].props.children.find((child) => child?.type === "details");
  assert.equal(detail.props.children[1].type, JsonTree);
  assert.deepEqual(detail.props.children[1].props.data, presentation);
  assert.equal(detail.props.children[1].props.copyable, true);
});

test("marks a pending CRYSTRA command as command-accepted for browser-visible lifecycle observation", () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {},
    useRef(value) { return { current: value }; },
    useState(value) { return [value, () => undefined]; },
  };
  const View = createCrystraCommandView({
    React,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot: (props) => ({ type: "StateDot", props }),
  });

  const tree = View({ node: { commandId: "command-1", name: "crystra", outcome: null } });

  assert.equal(tree.props.collapsedContent.props["data-crystra-kind"], "command-accepted");
  assert.equal(tree.props.collapsedContent.props["data-crystra-surface"], "chat");
});

test("reconciles the original Delivery command row with its authoritative terminal outcome", () => {
  let outcome = "SUCCEEDED";
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {},
    useRef(value) { return { current: value }; },
    useState(value) { return [value, () => undefined]; },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const inventory = {
    subscribe() { return () => undefined; },
    getSnapshot() {
      return {
        kind: "ready",
        snapshot: {
          schemaVersion: "execution.delivery-control-plane@1.0.0",
          generation: 3,
          deliveries: [{
            deliveryId: "delivery-1",
            lifecycle: "TERMINAL",
            terminal: { outcome },
          }],
        },
      };
    },
  };
  const StateDot = (props) => ({ type: "StateDot", props });
  const View = createCrystraCommandView({
    React,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot,
    JsonTree: (props) => ({ type: "JsonTree", props }),
    inventory,
  });

  const node = {
    commandId: "command-1",
    name: "crystra",
    outcome: { kind: "success", text: JSON.stringify(valid("delivery-running", {
      deliveryId: "delivery-1",
      state: "START_UNCERTAIN",
    }, "presentation-start")) },
  };
  for (const expected of [
    { outcome: "SUCCEEDED", dot: "done", label: "Succeeded" },
    { outcome: "FAILED", dot: "error", label: "Failed" },
    { outcome: "CANCELLED", dot: "error", label: "Cancelled" },
  ]) {
    outcome = expected.outcome;
    const tree = View({ node });
    assert.equal(tree.props.open, false);
    assert.equal(tree.props.icon.type, StateDot);
    assert.equal(tree.props.icon.props.state, expected.dot);
    assert.match(JSON.stringify(tree.props.collapsedContent), new RegExp(`${expected.label} · delivery-1`, "u"));
  }
});

test("never echoes rejected command bytes in technical details", () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {}, useRef(value) { return { current: value }; }, useState(value) { return [value, () => undefined]; },
  };
  const View = createCrystraCommandView({
    React,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot: (props) => ({ type: "StateDot", props }),
    JsonTree: (props) => ({ type: "JsonTree", props }),
  });
  const tree = View({ node: { commandId: "command-1", name: "crystra", args: null, outcome: { kind: "error", text: '{"secret":"must-not-render"}' } } });
  assert.doesNotMatch(JSON.stringify(tree), /must-not-render/u);
  assert.match(JSON.stringify(tree), /CRYSTRA presentation unavailable/u);
});

test("renders process through DisclosureRow and final output as a persistent assistant-style MessageText", () => {
  const calls = [];
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useEffect() {},
    useRef(value) { return { current: value }; },
    useState(value) { return [value, () => undefined]; },
  };
  const DisclosureRow = (props) => ({ type: "DisclosureRow", props });
  const MessageText = (props) => ({ type: "MessageText", props });
  const StateDot = (props) => ({ type: "StateDot", props });
  const View = createActionPresentationView({ React, DisclosureRow, MessageText, StateDot, observe: (value) => calls.push(value) });

  const processTree = View({ node: { data: projectExecutionPresentation(parseExecutionPresentation(valid("action-output", {
    state: "failed", content: { text: "compiler failed" },
  }))) }, technicalDetails: valid("action-output", { state: "failed", content: { text: "compiler failed" } }) });
  assert.equal(processTree.type, DisclosureRow);
  assert.equal(processTree.props.open, false);
  assert.equal(processTree.props.expandOnRowClick, true);
  assert.equal(processTree.props.previewChevron, false);
  assert.equal(processTree.props.collapsedContent.props["data-crystra-presentation"], "true");
  assert.equal(processTree.props.collapsedContent.props["data-crystra-kind"], "action-output");
  assert.equal(processTree.props.collapsedContent.props["data-crystra-surface"], "chat");
  assert.equal(processTree.props.children[0].props["data-crystra-layer"], "action");
  assert.equal(processTree.props.children[0].props.children[0].props.style.maxHeight, "20rem");

  const waitingTree = View({ node: { data: projectExecutionPresentation(parseExecutionPresentation(valid("action-input-request", {
    prompt: { question: "Continue?" },
  }))) } });
  assert.equal(waitingTree.type, DisclosureRow);
  assert.equal(waitingTree.props.open, true);
  assert.equal(waitingTree.props.expandable, false);
  assert.equal(waitingTree.props.children[0].props.tabIndex, 0);
  assert.equal(waitingTree.props.children[0].props["data-crystra-action-input"], "true");

  const finalTree = View({ node: { data: projectExecutionPresentation(parseExecutionPresentation(valid("terminal-result", {
    outcome: "SUCCEEDED", finalOutput: "Ship it",
  }))) } });
  assert.equal(finalTree.type, "article");
  assert.equal(finalTree.props["data-crystra-chat-role"], "assistant");
  assert.equal(finalTree.props.children[0].type, MessageText);
  assert.deepEqual(calls.map(({ layer }) => layer), ["action", "action", "final"]);
});

test("renders one native-shaped copy toolbar for a stable final and omits final technical details", async () => {
  const React = statefulReact();
  const copied = [];
  const MessageText = (props) => ({ type: "MessageText", props });
  const Tooltip = (props) => ({ type: "Tooltip", props });
  const IconCopyOutline16 = (props) => ({ type: "IconCopyOutline16", props });
  const IconCheckOutline16 = (props) => ({ type: "IconCheckOutline16", props });
  const View = createActionPresentationView({
    React,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText,
    StateDot: (props) => ({ type: "StateDot", props }),
    JsonTree: (props) => ({ type: "JsonTree", props }),
    Tooltip,
    IconCopyOutline16,
    IconCheckOutline16,
    async writeClipboard(value) { copied.push(value); return true; },
  });
  const node = { data: projectExecutionPresentation(parseExecutionPresentation(valid("terminal-result", {
    outcome: "SUCCEEDED", finalOutput: "Visible final body",
  }))) };
  const render = () => { React.beginRender(); return View({ node, technicalDetails: valid("terminal-result", { outcome: "SUCCEEDED", finalOutput: "Visible final body" }) }); };

  let tree = render();
  const toolbars = elementsOf(tree).filter((entry) => entry.props?.["data-crystra-answer-actions"] === "true");
  assert.equal(toolbars.length, 1);
  assert.equal(elementsOf(tree).some((entry) => entry.type === "details"), false);
  assert.equal(elementsOf(tree).filter((entry) => entry.type === MessageText).length, 1);
  const buttons = elementsOf(toolbars[0]).filter((entry) => entry.type === "button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props["aria-label"], "Copy");
  assert.equal(elementsOf(buttons[0]).some((entry) => entry.type === IconCopyOutline16), true);
  assert.equal(elementsOf(tree).some((entry) => entry.type === Tooltip && entry.props.side === "bottom"), true);

  await buttons[0].props.onClick();
  assert.deepEqual(copied, ["Visible final body"]);
  tree = render();
  const copiedButton = elementsOf(tree).find((entry) => entry.type === "button");
  assert.equal(copiedButton.props["aria-label"], "Copied");
  assert.equal(copiedButton.props["data-copy-state"], "copied");
  assert.equal(elementsOf(copiedButton).some((entry) => entry.type === IconCheckOutline16), true);
});

test("keeps copy denial local and leaves the final body and toolbar usable", async () => {
  const React = statefulReact();
  const View = createActionPresentationView({
    React,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot: (props) => ({ type: "StateDot", props }),
    Tooltip: (props) => ({ type: "Tooltip", props }),
    IconCopyOutline16: (props) => ({ type: "IconCopyOutline16", props }),
    IconCheckOutline16: (props) => ({ type: "IconCheckOutline16", props }),
    async writeClipboard() { return false; },
  });
  const node = { data: projectExecutionPresentation(parseExecutionPresentation(valid("terminal-result", {
    outcome: "SUCCEEDED", finalOutput: "Still visible",
  }))) };
  const render = () => { React.beginRender(); return View({ node }); };

  let tree = render();
  await elementsOf(tree).find((entry) => entry.type === "button").props.onClick();
  tree = render();
  assert.match(JSON.stringify(tree), /Still visible/u);
  const button = elementsOf(tree).find((entry) => entry.type === "button");
  assert.equal(button.props["aria-label"], "Copy failed");
  assert.equal(button.props["data-copy-state"], "failed");
});

test("never mounts the final toolbar on Action, error, malformed or empty-final diagnostics", () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {}, useRef(value) { return { current: value }; }, useState(value) { return [value, () => undefined]; },
  };
  const options = {
    React,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot: (props) => ({ type: "StateDot", props }),
    JsonTree: (props) => ({ type: "JsonTree", props }),
    Tooltip: (props) => ({ type: "Tooltip", props }),
    IconCopyOutline16: (props) => ({ type: "IconCopyOutline16", props }),
    IconCheckOutline16: (props) => ({ type: "IconCheckOutline16", props }),
    async writeClipboard() { return true; },
  };
  const View = createCrystraCommandView(options);
  for (const presentation of [
    valid("action-output", { state: "completed", content: { text: "Action output" } }),
    valid("error", { code: "FAILED", message: "Failure reason" }),
    valid("terminal-result", { outcome: "FAILED", finalOutput: "Terminal failure reason" }),
    { schemaVersion: "crystra.presentation@9.0.0", correlation: "future", kind: "terminal-result", data: { outcome: "SUCCEEDED", finalOutput: "not admitted" } },
    valid("terminal-result", { outcome: "SUCCEEDED", finalOutput: "" }),
  ]) {
    const tree = View({ node: { commandId: "command-1", name: "crystra", outcome: { kind: "error", text: JSON.stringify(presentation) } } });
    assert.equal(elementsOf(tree).some((entry) => entry.props?.["data-crystra-answer-actions"] === "true"), false);
    assert.equal(elementsOf(tree).some((entry) => entry.type === "details"), true);
  }
});

test("projects exactly one final toolbar on each replay render without persistent copy state", () => {
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } }; },
    useEffect() {}, useRef(value) { return { current: value }; }, useState(value) { return [value, () => undefined]; },
  };
  const View = createActionPresentationView({
    React,
    DisclosureRow: (props) => ({ type: "DisclosureRow", props }),
    MessageText: (props) => ({ type: "MessageText", props }),
    StateDot: (props) => ({ type: "StateDot", props }),
    Tooltip: (props) => ({ type: "Tooltip", props }),
    IconCopyOutline16: (props) => ({ type: "IconCopyOutline16", props }),
    IconCheckOutline16: (props) => ({ type: "IconCheckOutline16", props }),
    async writeClipboard() { return true; },
  });
  const node = { data: projectExecutionPresentation(parseExecutionPresentation(valid("terminal-result", {
    outcome: "SUCCEEDED", finalOutput: "Replay-safe final",
  }))) };

  for (const tree of [View({ node }), View({ node })]) {
    assert.equal(elementsOf(tree).filter((entry) => entry.props?.["data-crystra-answer-actions"] === "true").length, 1);
    assert.equal(elementsOf(tree).find((entry) => entry.type === "button").props["data-copy-state"], "idle");
  }
});

test("the unified Harness binding imports the public primitive root and no private DSH source", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../src/client/browser-entry.js"), "utf8");
  assert.match(source, /import React from ["']react["']/u);
  assert.match(source, /import \{ Button, DisclosureRow, IconCheckOutline16, IconCopyOutline16, JsonTree, MessageText, Pill, StateDot, Tooltip, writeClipboard \} from ["']@deepseek-ai\/dsh-client-ui-primitives["']/u);
  assert.doesNotMatch(source, /\/src\/|tool\.call\.toolview/u);
});
