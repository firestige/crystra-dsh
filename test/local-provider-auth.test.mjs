import assert from "node:assert/strict";
import test from "node:test";

import { qualifyCopilotLocalAuth } from "../scripts/qualify-local-provider-auth.mjs";

function fixture({ authenticated = true, models = ["gpt-5.3-codex"] } = {}) {
  const observed = {};
  const client = {
    async start() { observed.started = true; },
    async getStatus() { return { version: "1.0.78", protocolVersion: 1 }; },
    async getAuthStatus() { return { isAuthenticated: authenticated, authType: "user" }; },
    async listModels() { return models.map((id) => ({ id })); },
    async stop() { observed.stopped = true; return []; },
    async forceStop() { observed.forceStopped = true; },
  };
  const runtime = {
    wrapperPackageName: "@github/copilot",
    wrapperPackageVersion: "1.0.78",
    platformPackageName: `@github/copilot-${process.platform}-${process.arch}`,
    platformPackageVersion: "1.0.78",
    createClient(options) { observed.options = options; return client; },
  };
  return { observed, resolveRuntime: async () => runtime };
}

test("qualifies the host Copilot login without exposing credential material", async () => {
  const prepared = fixture();
  const result = await qualifyCopilotLocalAuth({
    resolveRuntime: prepared.resolveRuntime,
    workspace: "/canonical/workspace",
    homeDirectory: "/host/home",
  });

  assert.deepEqual(prepared.observed.options, {
    mode: "empty",
    useLoggedInUser: true,
    workingDirectory: "/canonical/workspace",
    baseDirectory: "/host/home/.copilot",
    logLevel: "error",
  });
  assert.equal(prepared.observed.started, true);
  assert.equal(prepared.observed.stopped, true);
  assert.deepEqual(result, {
    schemaVersion: "crystra.local-provider-auth-qualification@1.0.0",
    provider: "provider.copilot",
    runtimeVersion: "1.0.78",
    authenticated: true,
    model: "gpt-5.3-codex",
    modelAvailable: true,
    credentialMaterialRead: false,
  });
  assert.doesNotMatch(JSON.stringify(result), /token|secret|authType/u);
});

test("rejects an unavailable host login and always stops the SDK client", async () => {
  const prepared = fixture({ authenticated: false });

  await assert.rejects(
    qualifyCopilotLocalAuth({ resolveRuntime: prepared.resolveRuntime, workspace: "/canonical/workspace", homeDirectory: "/host/home" }),
    /COPILOT_LOCAL_LOGIN_REQUIRED/u,
  );
  assert.equal(prepared.observed.stopped, true);
});

test("rejects when the acceptance model is unavailable", async () => {
  const prepared = fixture({ models: ["different-model"] });

  await assert.rejects(
    qualifyCopilotLocalAuth({ resolveRuntime: prepared.resolveRuntime, workspace: "/canonical/workspace", homeDirectory: "/host/home" }),
    /COPILOT_ACCEPTANCE_MODEL_UNAVAILABLE/u,
  );
  assert.equal(prepared.observed.stopped, true);
});
