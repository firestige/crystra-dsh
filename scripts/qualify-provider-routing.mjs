#!/usr/bin/env node
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { resolveQualificationExecutionAsset } from "./lib/qualification-execution-asset.mjs";

const root = resolve(new URL("../", import.meta.url).pathname);
const compatibility = JSON.parse(await readFile(resolve(root, "config/dsh-compatibility.json"), "utf8"));
const executionAsset = await resolveQualificationExecutionAsset({ compatibility });

async function loadExecution() {
  if (executionAsset.source === "stable-owner") return { module: await import("crystra-execution") };
  const temporary = await mkdtemp(join(tmpdir(), "crystra-dsh-provider-routing-"));
  const extracted = join(temporary, "package");
  const result = spawnSync("tar", ["-xzf", executionAsset.coordinate, "-C", temporary], { encoding: "utf8" });
  if (result.error !== undefined || result.status !== 0) {
    await rm(temporary, { recursive: true, force: true });
    throw new Error(`EXECUTION_DEV_ARTIFACT_EXTRACT_FAILED: ${result.error?.message ?? result.stderr}`);
  }
  await symlink(resolve(root, "node_modules"), join(temporary, "node_modules"), "dir");
  return {
    module: await import(pathToFileURL(join(extracted, "dist/index.js")).href),
    dispose: () => rm(temporary, { recursive: true, force: true }),
  };
}

function factory(identity, version, adapterKey) {
  return Object.freeze({
    descriptor: Object.freeze({
      schemaVersion: "execution.agent-provider-factory@1.0.0",
      identity,
      version,
      adapterKey,
      capabilities: Object.freeze(["structured-completion"]),
    }),
    async acquire() { throw new Error("qualification admission must not open a Provider or read credentials"); },
  });
}

let loaded;
try {
  loaded = await loadExecution();
  const { AgentProviderFactoryRegistry, resolveRoleModelBindings } = loaded.module;
  const registry = new AgentProviderFactoryRegistry([
    factory("provider.copilot", "1.0.78", "copilot-sdk"),
    factory("provider.codex", "0.144.5", "codex-cli"),
  ]);
  const bindings = resolveRoleModelBindings({
    registry,
    repository: {
      schemaVersion: "execution.repository-role-provider-bindings-snapshot@1.0.0",
      documentState: "PRESENT",
      documentDigest: `sha256:${"a".repeat(64)}`,
      bindings: {
        "role.implementation": { agentProvider: { identity: "provider.copilot", version: "1.0.78" }, model: { provider: "github-copilot", model: "gpt-5.3-codex" } },
        "role.review": { agentProvider: { identity: "provider.codex", version: "0.144.5" }, model: { provider: "openai", model: "gpt-5.6-sol" } },
      },
    },
    agentActionRoles: [
      { roleId: "role.implementation", rolePromptIdentity: "prompt.implementation", rolePromptDigest: `sha256:${"b".repeat(64)}`, requiredCapabilities: ["structured-completion"] },
      { roleId: "role.review", rolePromptIdentity: "prompt.review", rolePromptDigest: `sha256:${"c".repeat(64)}`, requiredCapabilities: ["structured-completion"] },
    ],
  });
  const evidence = bindings.resolvedRoles.map(({ roleId, agentProviderId, agentProviderAdapterKey, modelProviderId, modelId }) => ({ roleId, agentProviderId, agentProviderAdapterKey, modelProviderId, modelId }));
  if (new Set(evidence.map(({ agentProviderId }) => agentProviderId)).size !== 2) throw new Error("PROVIDER_ROUTING_COLLAPSED");
  process.stdout.write(`${JSON.stringify({ schemaVersion: "crystra.dsh.provider-routing-qualification@1.0.0", executionAsset, credentialMaterialRead: false, roles: evidence }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await loaded?.dispose?.();
}
