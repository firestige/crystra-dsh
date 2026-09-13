import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { resolveQualificationExecutionAsset } from "../scripts/lib/qualification-execution-asset.mjs";

const root = resolve(import.meta.dirname, "..");

test("qualification uses an explicit digest-bound local Execution artifact only when both dev inputs are present", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "crystra-dsh-dev-execution-"));
  try {
    const artifact = join(temporary, "crystra-execution-0.2.6.tgz");
    const bytes = Buffer.from("immutable dev artifact");
    await writeFile(artifact, bytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const compatibility = { executionOwner: { coordinate: "https://example.invalid/stable.tgz", assetSha256: "a".repeat(64) } };

    assert.deepEqual(await resolveQualificationExecutionAsset({ compatibility, env: {} }), {
      coordinate: compatibility.executionOwner.coordinate,
      sha256: compatibility.executionOwner.assetSha256,
      source: "stable-owner",
    });
    assert.deepEqual(await resolveQualificationExecutionAsset({
      compatibility,
      env: { CRYSTRA_EXECUTION_DEV_ARTIFACT: artifact, CRYSTRA_EXECUTION_DEV_ARTIFACT_SHA256: digest },
    }), { coordinate: artifact, sha256: digest, source: "dev-local" });

    await assert.rejects(resolveQualificationExecutionAsset({
      compatibility,
      env: { CRYSTRA_EXECUTION_DEV_ARTIFACT: artifact },
    }), /EXECUTION_DEV_ARTIFACT_INPUT_INCOMPLETE/u);
    await assert.rejects(resolveQualificationExecutionAsset({
      compatibility,
      env: { CRYSTRA_EXECUTION_DEV_ARTIFACT: artifact, CRYSTRA_EXECUTION_DEV_ARTIFACT_SHA256: "b".repeat(64) },
    }), /EXECUTION_DEV_ARTIFACT_DIGEST_MISMATCH/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("all owner qualification entry points consume the shared dev-only artifact selector", async () => {
  const profile = await readFile(join(root,"scripts/lib/crystra-profile.mjs"),"utf8");
  assert.match(profile,/validateRepository/);
  for (const file of [
    "scripts/qualify-provider-routing.mjs",
    "scripts/qualify-real-harness.mjs",
  ]) {
    const source = await readFile(join(root, file), "utf8");
    assert.match(source, /resolveQualificationExecutionAsset/u, file);
  }
});

test("real Harness qualifies host-owned Session state and sibling trace navigation in all renderers", async () => {
  const source = await readFile(join(root, "scripts/qualify-real-harness.mjs"), "utf8");
  assert.match(source, /callApi\(origin, "session\.list"/u);
  assert.match(source, /callApi\(origin, "session\.history"/u);
  assert.match(source, /turn\/start/u);
  assert.match(source, /HARNESS_COMMAND_SESSION_STATE_INVALID/u);
  assert.match(source, /HARNESS_NEW_SESSION_ISOLATION_INVALID/u);
  assert.match(source, /data-studio-trace-hierarchy/u);
  assert.match(source, /navigationBeforeHeader/u);
  assert.match(source, /sectionSemanticSurface/u);
});
