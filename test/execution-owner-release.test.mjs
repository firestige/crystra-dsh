import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { validateExecutionOwnerRelease, verifyExecutionOwnerRelease } from "../scripts/lib/execution-owner-release.mjs";

const root = resolve(import.meta.dirname, "..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("the single owner-release record binds version, coordinate, revision and remote bytes", async () => {
  const owner = {schemaVersion:"execution.owner-release@1.0.0",package:"crystra-execution",repository:"firestige/crystra-execution",projection:"execution.delivery-control-plane@1.0.0"};
  const bytes = Buffer.from("published-owner-artifact");
  const record = {
    ...owner,
    version: "0.3.0", release: "0.3.0",
    coordinate: "https://github.com/firestige/crystra-execution/releases/download/0.3.0/crystra-execution-0.3.0.tgz",
    assetSha256: sha256(bytes), revision: "a".repeat(40),
    qualificationCoordinate: "https://github.com/firestige/crystra-execution/releases/download/0.3.0/release-qualification.json",
  };
  await assert.doesNotReject(verifyExecutionOwnerRelease(record, {
    fetchBytes: async (coordinate) => {
      assert.equal(coordinate, record.coordinate);
      return bytes;
    },
    resolveRevision: async (repository, release) => {
      assert.deepEqual([repository, release], ["firestige/crystra-execution", "0.3.0"]);
      return record.revision;
    },
  }));
});

test("same-version local rebuild and coordinate/revision drift fail closed", async () => {
  const published = Buffer.from("published-0.2.1");
  const owner = {
    schemaVersion: "execution.owner-release@1.0.0",
    package: "crystra-execution", repository: "firestige/crystra-execution",
    version: "0.2.1", release: "0.2.1",
    coordinate: "https://github.com/firestige/crystra-execution/releases/download/0.2.1/crystra-execution-0.2.1.tgz",
    assetSha256: sha256(published), revision: "f".repeat(40),
    qualificationCoordinate: "https://github.com/firestige/crystra-execution/releases/download/0.2.1/release-qualification.json",
    projection: "execution.delivery-control-plane@1.0.0",
  };
  await assert.rejects(verifyExecutionOwnerRelease(owner, {
    fetchBytes: async () => Buffer.from("local-rebuild-0.2.1"),
    resolveRevision: async () => owner.revision,
  }), /EXECUTION_OWNER_ARTIFACT_DIGEST_MISMATCH/u);
  await assert.rejects(verifyExecutionOwnerRelease(owner, {
    fetchBytes: async () => published,
    resolveRevision: async () => "b".repeat(40),
  }), /EXECUTION_OWNER_REVISION_MISMATCH/u);
  assert.throws(() => validateExecutionOwnerRelease({ ...owner, coordinate: "/tmp/crystra-execution-0.2.1.tgz" }), /EXECUTION_OWNER_RECORD_INVALID/u);
});
