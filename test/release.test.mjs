import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { assertCandidateTag, assertPromotionEligible } from "../scripts/lib/release-policy.mjs";

const root = path.resolve(import.meta.dirname, "..");
const packages = Object.freeze(["dsh-crystra-execution", "dsh-crystra-studio", "dsh-crystra"]);

test("release policy accepts only an exact qualified candidate for the stable release-set version", () => {
  assert.doesNotThrow(() => assertCandidateTag("crystra-dsh-v0.2.12-rc.1", "0.2.12"));
  assert.throws(() => assertCandidateTag("latest", "0.2.12"), /PRERELEASE_TAG_REQUIRED/u);
  assert.doesNotThrow(() => assertPromotionEligible({
    finalTag: "0.2.12",
    candidateTag: "crystra-dsh-v0.2.12-rc.1",
    commit: "a".repeat(40),
    metadataSha256: `sha256:${"b".repeat(64)}`,
    qualification: {
      schemaVersion: "crystra.dsh.release-qualification@1.0.0",
      packageVersion: "0.2.12",
      candidateTag: "crystra-dsh-v0.2.12-rc.1",
      commit: "a".repeat(40),
      artifactMetadataSha256: `sha256:${"b".repeat(64)}`,
      gates: {
        cleanProfile: "PASS",
        lifecycle: "PASS",
        realHarness: "PASS",
        loopbackOutage: "PASS",
        providerRouting: "PASS",
        remoteArtifacts: "PASS",
      },
    },
  }));
});


test("promotion rejects a candidate whose qualified package bytes were replaced", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "crystra-dsh-promotion-swap-"));
  try {
    const artifact = "dsh-crystra-execution-0.2.9.tgz";
    await writeFile(path.join(directory, artifact), "swapped-package-bytes\n");
    const metadata = {
      schemaVersion: "crystra.dsh.release-metadata@1.0.0",
      repository: "firestige/crystra-dsh",
      commit: "a".repeat(40),
      candidateTag: "crystra-dsh-v0.2.10-rc.1",
      packageVersion: "0.2.10",
      packages: [{
        package: "dsh-crystra-execution",
        version: "0.2.9",
        file: artifact,
        sha256: `sha256:${createHash("sha256").update("qualified-package-bytes\n").digest("hex")}`,
      }],
      supportFiles: [],
    };
    const metadataBytes = `${JSON.stringify(metadata, null, 2)}\n`;
    await writeFile(path.join(directory, "release-metadata.json"), metadataBytes);
    await writeFile(path.join(directory, "release-qualification.json"), `${JSON.stringify({
      schemaVersion: "crystra.dsh.release-qualification@1.0.0",
      packageVersion: metadata.packageVersion,
      candidateTag: metadata.candidateTag,
      commit: metadata.commit,
      artifactMetadataSha256: `sha256:${createHash("sha256").update(metadataBytes).digest("hex")}`,
      gates: {
        cleanProfile: "PASS",
        lifecycle: "PASS",
        realHarness: "PASS",
        loopbackOutage: "PASS",
        providerRouting: "PASS",
        remoteArtifacts: "PASS",
      },
    }, null, 2)}\n`);

    const result = spawnSync(process.execPath, [path.join(root, "scripts/verify-release-set.mjs"), directory], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /RELEASE_ARTIFACT_DIGEST_MISMATCH/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release workflows reuse candidate bytes and the scoped release App without npm publication", async () => {
  const candidate = await readFile(path.join(root, ".github/workflows/release-candidate.yml"), "utf8");
  const promote = await readFile(path.join(root, ".github/workflows/release-promote.yml"), "utf8");
  const verify = await readFile(path.join(root, ".github/workflows/verify.yml"), "utf8");
  assert.match(candidate, /push:\s*\n\s*branches:\s*\n\s*- release\/next/u);
  assert.doesNotMatch(candidate, /workflow_dispatch:|workflow_call:/u);
  assert.match(candidate, /release\/request\.json/u);
  assert.match(candidate, /release-qualification\.json/u);
  assert.match(candidate, /- run: npm test\n\s+env:\n\s+CRYSTRA_CHROME_BINARY: \/usr\/bin\/google-chrome/u);
  assert.match(verify, /- run: npm test\n\s+env:\n\s+CRYSTRA_CHROME_BINARY: \/usr\/bin\/google-chrome/u);
  assert.match(candidate, /qualify:clean-profile/u);
  assert.match(candidate, /qualify:real-harness/u);
  assert.match(candidate, /release:owner:verify/u);
  assert.doesNotMatch(candidate, /crystra-execution-0\.2\.2\.tgz|d07eb0aaa4e0498/u);
  assert.doesNotMatch(promote, /id-token: write/u);
  assert.doesNotMatch(promote, /publish-npm-set\.mjs/u);
  for (const workflow of [candidate, promote]) {
    assert.match(workflow, /actions\/create-github-app-token@v3/u);
    assert.match(workflow, /client-id: \$\{\{ vars\.CRYSTRA_RELEASE_CLIENT_ID \}\}/u);
    assert.doesNotMatch(workflow, /app-id:/u);
  }
  const allWorkflows = await Promise.all([
    "release-candidate.yml", "release-promote.yml", "verify.yml",
  ].map((name) => readFile(path.join(root, ".github/workflows", name), "utf8")));
  const actions = allWorkflows.join("\n");
  assert.doesNotMatch(actions, /actions\/(?:checkout|setup-node|upload-artifact)@v4\b/u);
  assert.match(promote, /repositories: crystra-dsh/u);
  assert.doesNotMatch(promote, /Publishing is not enabled yet|STABLE_PROMOTION_DISABLED/u);
});

test("one plugin version leaves ordinary components independently versioned", async () => {
  const manifest=JSON.parse(await readFile(path.join(root,"package.json"),"utf8"));
  assert.equal(manifest.version,"0.1.0");
  assert.equal(manifest.workspaces,undefined);
  assert.ok(manifest.dependencies["crystra-execution"]);
  assert.ok(manifest.dependencies["crystra-ui-core"]);
});

test("marketplace support metadata covers every package and the shared security lifecycle", async () => {
  const marketplace = JSON.parse(await readFile(path.join(root, "marketplace/packages.json"), "utf8"));
  assert.equal(marketplace.schemaVersion, "crystra.dsh.marketplace@1.0.0");
  assert.deepEqual(marketplace.packages.map(({ name }) => name), ["dsh-crystra"]);
  assert.deepEqual(Object.fromEntries(marketplace.packages.map(({ name, version }) => [name, version])), {
    "dsh-crystra": "0.1.0",
  });
  assert.ok(marketplace.packages.every(({ icon, license, security }) => icon === "./icon.svg"
    && license === "Apache-2.0" && security === "../SECURITY.md"));
  await Promise.all(["marketplace/icon.svg", "CHANGELOG.md", "SECURITY.md", "docs/release-lifecycle.md"]
    .map((file) => readFile(path.join(root, file), "utf8")));
});


test("qualification cannot claim PASS without execution receipts", async () => {
  const directory=await mkdtemp(path.join(os.tmpdir(),"crystra-unexecuted-gates-"));
  try {
    await writeFile(path.join(directory,"release-metadata.json"),JSON.stringify({
      packageVersion:"0.1.0",candidateTag:"crystra-dsh-v0.1.0-rc.1",commit:"a".repeat(40),
    }));
    const result=spawnSync(process.execPath,[path.join(root,"scripts/write-release-qualification.mjs"),directory],{encoding:"utf8"});
    assert.equal(result.status,1,result.stdout);
    assert.match(result.stderr,/QUALIFICATION_RECEIPT_REQUIRED/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
