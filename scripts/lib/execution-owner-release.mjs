import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const REVISION = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const KEYS = [
  "assetSha256", "coordinate", "package", "projection", "qualificationCoordinate", "release",
  "repository", "revision", "schemaVersion", "version",
].sort().join(",");

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

function expectedCoordinate(owner, filename) {
  return `https://github.com/${owner.repository}/releases/download/${owner.release}/${filename}`;
}

export function validateExecutionOwnerRelease(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join(",") !== KEYS
    || value.schemaVersion !== "execution.owner-release@1.0.0"
    || value.package !== "crystra-execution"
    || value.repository !== "firestige/crystra-execution"
    || !VERSION.test(value.version) || value.release !== value.version
    || !REVISION.test(value.revision) || !SHA256.test(value.assetSha256)
    || value.projection !== "execution.delivery-control-plane@1.0.0"
    || value.coordinate !== expectedCoordinate(value, `crystra-execution-${value.version}.tgz`)
    || value.qualificationCoordinate !== expectedCoordinate(value, "release-qualification.json")) {
    fail("EXECUTION_OWNER_RECORD_INVALID");
  }
  return Object.freeze(structuredClone(value));
}

export async function verifyExecutionOwnerRelease(value, ports) {
  const owner = validateExecutionOwnerRelease(value);
  if (typeof ports?.fetchBytes !== "function" || typeof ports?.resolveRevision !== "function") {
    fail("EXECUTION_OWNER_VERIFIER_INVALID");
  }
  let bytes;
  let revision;
  try {
    [bytes, revision] = await Promise.all([
      ports.fetchBytes(owner.coordinate),
      ports.resolveRevision(owner.repository, owner.release),
    ]);
  } catch {
    fail("EXECUTION_OWNER_REMOTE_UNAVAILABLE");
  }
  if (!(bytes instanceof Uint8Array)) fail("EXECUTION_OWNER_REMOTE_UNAVAILABLE");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== owner.assetSha256) fail("EXECUTION_OWNER_ARTIFACT_DIGEST_MISMATCH");
  if (revision !== owner.revision) fail("EXECUTION_OWNER_REVISION_MISMATCH");
  return Object.freeze({ owner, bytes: bytes.byteLength });
}

async function fetchBytes(coordinate) {
  const response = await fetch(coordinate, { redirect: "follow" });
  if (!response.ok) fail("EXECUTION_OWNER_REMOTE_UNAVAILABLE");
  return new Uint8Array(await response.arrayBuffer());
}

async function resolveRevision(repository, release) {
  const response = await fetch(`https://api.github.com/repos/${repository}/git/ref/tags/${encodeURIComponent(release)}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "crystra-dsh-owner-release-gate" },
  });
  if (!response.ok) fail("EXECUTION_OWNER_REMOTE_UNAVAILABLE");
  const body = await response.json();
  return body?.object?.type === "commit" && typeof body.object.sha === "string" ? body.object.sha : undefined;
}

export async function verifyConfiguredExecutionOwnerRelease(configurationFile) {
  const compatibility = JSON.parse(await readFile(configurationFile, "utf8"));
  return verifyExecutionOwnerRelease(compatibility.executionOwner, { fetchBytes, resolveRevision });
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (file === undefined) fail("USAGE: verify-execution-owner-release <dsh-compatibility.json>");
  const result = await verifyConfiguredExecutionOwnerRelease(file);
  process.stdout.write(`${JSON.stringify({ status: "PASS", version: result.owner.version, revision: result.owner.revision, bytes: result.bytes })}\n`);
}
