import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

const SHA256 = /^[0-9a-f]{64}$/u;

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

export async function resolveQualificationExecutionAsset({ compatibility, env = process.env }) {
  let artifact = env.CRYSTRA_EXECUTION_DEV_ARTIFACT;
  let expectedDigest = env.CRYSTRA_EXECUTION_DEV_ARTIFACT_SHA256;
  if (artifact === undefined && expectedDigest === undefined && compatibility.executionOwner === undefined) {
    const root = resolve(import.meta.dirname, "../..");
    const input = JSON.parse(await readFile(resolve(root,"config/development-inputs.json"),"utf8")).inputs.execution;
    artifact = resolve(root,".crystra-inputs",input.artifact);
    expectedDigest = input.sha256;
  }
  if ((artifact === undefined) !== (expectedDigest === undefined)) fail("EXECUTION_DEV_ARTIFACT_INPUT_INCOMPLETE");
  if (artifact === undefined) {
    return Object.freeze({
      coordinate: compatibility.executionOwner.coordinate,
      sha256: compatibility.executionOwner.assetSha256,
      source: "stable-owner",
    });
  }
  if (!isAbsolute(artifact) || !artifact.endsWith(".tgz") || !SHA256.test(expectedDigest)) {
    fail("EXECUTION_DEV_ARTIFACT_INPUT_INVALID");
  }
  let bytes;
  try {
    bytes = await readFile(resolve(artifact));
  } catch {
    fail("EXECUTION_DEV_ARTIFACT_UNAVAILABLE");
  }
  const actualDigest = createHash("sha256").update(bytes).digest("hex");
  if (actualDigest !== expectedDigest) fail("EXECUTION_DEV_ARTIFACT_DIGEST_MISMATCH");
  return Object.freeze({ coordinate: resolve(artifact), sha256: actualDigest, source: "dev-local" });
}
