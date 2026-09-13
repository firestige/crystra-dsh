import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { realpath } from "node:fs/promises";

const COPILOT_VERSION = "1.0.78";
const COPILOT_MODEL = "gpt-5.3-codex";

function failure(code) {
  return Object.assign(new Error(code), { code });
}

async function defaultRuntime() {
  const providerModule = resolve(import.meta.dirname, "../node_modules/crystra-execution/dist/providers/copilot/index.js");
  const provider = await import(pathToFileURL(providerModule).href);
  if (typeof provider.resolveInstalledCopilotSdkRuntime !== "function") throw failure("COPILOT_RUNTIME_UNAVAILABLE");
  return provider.resolveInstalledCopilotSdkRuntime();
}

export async function qualifyCopilotLocalAuth({
  resolveRuntime = defaultRuntime,
  workspace,
  homeDirectory = homedir(),
  model = COPILOT_MODEL,
}) {
  const runtime = await resolveRuntime();
  const platformPackage = `@github/copilot-${process.platform}-${process.arch}`;
  if (runtime?.wrapperPackageName !== "@github/copilot"
    || runtime.wrapperPackageVersion !== COPILOT_VERSION
    || runtime.platformPackageName !== platformPackage
    || runtime.platformPackageVersion !== COPILOT_VERSION
    || typeof runtime.createClient !== "function") {
    throw failure("COPILOT_RUNTIME_UNAVAILABLE");
  }
  const client = runtime.createClient({
    mode: "empty",
    useLoggedInUser: true,
    workingDirectory: workspace,
    baseDirectory: join(homeDirectory, ".copilot"),
    logLevel: "error",
  });
  try {
    await client.start();
    const [status, auth, models] = await Promise.all([
      client.getStatus(),
      client.getAuthStatus(),
      client.listModels(),
    ]);
    if (status?.version !== COPILOT_VERSION) throw failure("COPILOT_RUNTIME_UNAVAILABLE");
    if (auth?.isAuthenticated !== true) throw failure("COPILOT_LOCAL_LOGIN_REQUIRED");
    if (!Array.isArray(models) || !models.some((candidate) => candidate?.id === model)) {
      throw failure("COPILOT_ACCEPTANCE_MODEL_UNAVAILABLE");
    }
    return Object.freeze({
      schemaVersion: "crystra.local-provider-auth-qualification@1.0.0",
      provider: "provider.copilot",
      runtimeVersion: COPILOT_VERSION,
      authenticated: true,
      model,
      modelAvailable: true,
      credentialMaterialRead: false,
    });
  } finally {
    try {
      if ((await client.stop()).length > 0) await client.forceStop();
    } catch {
      await client.forceStop().catch(() => undefined);
    }
  }
}

async function main() {
  const workspace = process.argv[2];
  if (typeof workspace !== "string") throw failure("COPILOT_QUALIFICATION_WORKSPACE_REQUIRED");
  process.stdout.write(`${JSON.stringify(await qualifyCopilotLocalAuth({ workspace: await realpath(workspace) }), null, 2)}\n`);
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((cause) => {
    const code = typeof cause?.code === "string" ? cause.code : "COPILOT_LOCAL_AUTH_UNAVAILABLE";
    process.stderr.write(`Copilot local credential qualification failed: ${code}\n`);
    process.exitCode = 1;
  });
}
