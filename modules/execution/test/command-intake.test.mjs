import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parseCrystraCommand, promptDiagnostic } from "../src/intake/command.js";
import {
  consumeCrystraCommandBeforeModel,
  ensureGitWorktree,
  mapIntakeToolOperation,
  presentToDshSession,
  recordCrystraCommandInput,
} from "../src/intake/plugin.js";

const execute = promisify(execFile);

test("accepts no-ID abandon and returns a typed usage diagnostic for invalid command input", () => {
  assert.deepEqual(parseCrystraCommand("abandon"), { operation: "abandon" });
  assert.deepEqual(mapIntakeToolOperation({ operation: "abandon" }), { operation: "abandon" });
  assert.throws(
    () => parseCrystraCommand("abandon\nunexpected"),
    (error) => error?.code === "CRYSTRA_COMMAND_INVALID"
      && /Usage: \/crystra abandon \[delivery-id\]/u.test(error.message),
  );
});

test("selector-only create returns an actionable safe Task diagnostic before Core admission", () => {
  const operation = parseCrystraCommand("create hello-world-workflow@0.2.0");
  assert.deepEqual(promptDiagnostic(operation, []), {
    code: "TASK_PROMPT_REQUIRED",
    message: "Add a Task instruction after the Workflow selector or attach a file.",
  });
  assert.equal(promptDiagnostic(parseCrystraCommand("create hello-world-workflow@0.2.0\nReview the greeting."), []), undefined);
  assert.equal(promptDiagnostic(operation, [{ type: "image" }]), undefined);
});

test("the handler emits an ordered presentation while the earlier native row remains hidden", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../src/intake/plugin.js"), "utf8");
  const handler = source.split("async handler(invocation)", 2)[1].split("const { defineTool }", 1)[0];
  assert.match(handler, /presentToDshSession/u);
  assert.ok(handler.indexOf("recordCrystraCommandInput") < handler.indexOf("parseCrystraCommand"));
});

test("records each CRYSTRA command through a host-owned turn before its presentation without invoking the model", async () => {
  const events = [];
  const inbox = [];
  let modelCalls = 0;
  const agent = {
    session: { append(type, data, options) { events.push({ type, data, options }); } },
    followup(message) { inbox.push(message); },
    async whenIdle() {
      const message = inbox.shift();
      assert.ok(message, "Agent inbox must contain the /crystra command");
      agent.session.append("turn/start", { turn: 0 });
      const consumed = consumeCrystraCommandBeforeModel({ agent, messages: [message] });
      if (!consumed) modelCalls += 1;
      agent.session.append("turn/end", { turn: 0, reason: "rejected" });
    },
  };
  await recordCrystraCommandInput(agent, "create hello-world-workflow@0.2.0\nSay hello.", [], () => "message-1");
  presentToDshSession(agent, {
    schemaVersion: "crystra.presentation@1.0.0",
    correlation: "presentation-1",
    kind: "command-accepted",
    data: {},
  }, () => "presentation-command-1");

  assert.deepEqual(events.map(({ type }) => type), ["turn/start", "user/message", "turn/end", "command/run", "command/done"]);
  assert.equal(events[1].data.content[0].text, "/crystra create hello-world-workflow@0.2.0\nSay hello.");
  assert.equal(events[3].data.name, "crystra-presentation");
  assert.deepEqual({
    blank: !events.some(({ type }) => type === "turn/start"),
    turns: events.filter(({ type }) => type === "turn/start").length,
  }, { blank: false, turns: 1 });
  assert.equal(inbox.length, 0);
  assert.equal(modelCalls, 0);
});

test("keeps success, fast-fail, Execution error, and recoverable presentations in non-blank isolated Sessions", async () => {
  const pathways = [
    ["success", "terminal-result"],
    ["usage-fast-fail", "error"],
    ["execution-error", "error"],
    ["recoverable-failure", "delivery-status"],
  ];
  for (const [label, presentationKind] of pathways) {
    const sessions = [];
    let modelCalls = 0;
    const createAgent = (id) => {
      const events = [];
      const inbox = [];
      const agent = {
        id,
        session: { append(type, data, options) { events.push({ type, data, options }); } },
        followup(message) { inbox.push(message); },
        async whenIdle() {
          const message = inbox.shift();
          agent.session.append("turn/start", { turn: 0 });
          if (!consumeCrystraCommandBeforeModel({ agent, messages: [message] })) modelCalls += 1;
          agent.session.append("turn/end", { turn: 0, reason: "rejected" });
        },
      };
      sessions.push({ agent, events });
      return agent;
    };
    const used = createAgent(`session-${label}`);
    await recordCrystraCommandInput(used, label, [], () => `message-${label}`);
    if (label === "success") {
      presentToDshSession(used, {
        schemaVersion: "crystra.presentation@1.0.0", correlation: label, kind: "action-output", data: { content: { text: "Action output" } },
      }, () => `presentation-action-${label}`);
    }
    presentToDshSession(used, {
      schemaVersion: "crystra.presentation@1.0.0", correlation: label, kind: presentationKind, data: { code: label },
    }, () => `presentation-final-${label}`);
    const fresh = createAgent(`session-${label}-new`);

    const usedTypes = sessions[0].events.map(({ type }) => type);
    const presentationKinds = sessions[0].events
      .filter(({ type }) => type === "command/done")
      .map(({ data }) => JSON.parse(data.text).kind);
    assert.equal(usedTypes.filter((type) => type === "user/message").length, 1, label);
    assert.deepEqual(presentationKinds, label === "success" ? ["action-output", "terminal-result"] : [presentationKind], label);
    assert.ok(usedTypes.indexOf("user/message") < usedTypes.indexOf("command/done"), label);
    assert.deepEqual({ blank: !usedTypes.includes("turn/start"), turns: usedTypes.filter((type) => type === "turn/start").length }, { blank: false, turns: 1 }, label);
    assert.deepEqual({ blank: !sessions[1].events.some(({ type }) => type === "turn/start"), turns: 0 }, { blank: true, turns: 0 }, label);
    assert.notEqual(used.id, fresh.id, label);
    assert.equal(modelCalls, 0, label);
  }
});

test("creates a clean Git baseline containing the existing workspace when create first needs a worktree", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-create-worktree-"));
  const workspace = await realpath(root);
  try {
    await writeFile(join(workspace, "README.md"), "# User workspace\n", "utf8");
    assert.deepEqual(await ensureGitWorktree(workspace), { path: workspace, initialized: true });
    assert.equal((await stat(join(workspace, ".git"))).isDirectory(), true);
    assert.match((await execute("git", ["rev-parse", "HEAD^{tree}"], { cwd: workspace })).stdout.trim(), /^[0-9a-f]{40}$/u);
    assert.equal((await execute("git", ["show", "HEAD:README.md"], { cwd: workspace })).stdout, "# User workspace\n");
    assert.equal((await execute("git", ["status", "--porcelain"], { cwd: workspace })).stdout, "");
    const baseline = (await execute("git", ["rev-parse", "HEAD"], { cwd: workspace })).stdout.trim();
    assert.deepEqual(await ensureGitWorktree(workspace), { path: workspace, initialized: false });
    assert.equal((await execute("git", ["rev-parse", "HEAD"], { cwd: workspace })).stdout.trim(), baseline);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repairs an already initialized workspace that has no HEAD", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-create-headless-worktree-"));
  const workspace = await realpath(root);
  try {
    await execute("git", ["init", "--quiet"], { cwd: workspace });
    await writeFile(join(workspace, "README.md"), "# Existing headless workspace\n", "utf8");
    await assert.rejects(execute("git", ["rev-parse", "--verify", "HEAD"], { cwd: workspace }));

    assert.deepEqual(await ensureGitWorktree(workspace), { path: workspace, initialized: false });
    assert.match((await execute("git", ["rev-parse", "HEAD^{tree}"], { cwd: workspace })).stdout.trim(), /^[0-9a-f]{40}$/u);
    assert.equal((await execute("git", ["status", "--porcelain"], { cwd: workspace })).stdout, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("returns a typed failure when Git initialization cannot establish the worktree marker", async () => {
  const root = await mkdtemp(join(tmpdir(), "crystra-create-worktree-failure-"));
  const workspace = await realpath(root);
  try {
    await assert.rejects(
      ensureGitWorktree(workspace, async () => undefined),
      (error) => error?.code === "GIT_INIT_FAILED",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
