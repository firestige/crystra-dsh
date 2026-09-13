import { createHash } from "node:crypto";

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const REQUIRED_GATES = Object.freeze([
  "cleanProfile",
  "lifecycle",
  "realHarness",
  "loopbackOutage",
  "providerRouting",
  "remoteArtifacts",
]);

export function assertCandidateTag(candidateTag, packageVersion) {
  if (candidateTag === packageVersion || !new RegExp(`^crystra-dsh-v${packageVersion.replaceAll(".", "\\.")}-rc\\.[1-9][0-9]*$`, "u").test(candidateTag)) {
    throw new Error(`PRERELEASE_TAG_REQUIRED: ${candidateTag}`);
  }
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Json(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

export function assertPromotionEligible({ finalTag, candidateTag, commit, metadataSha256, qualification }) {
  assertCandidateTag(candidateTag, finalTag);
  if (!COMMIT.test(commit)) throw new Error(`PROMOTION_COMMIT_INVALID: ${commit}`);
  if (!SHA256.test(metadataSha256)) throw new Error(`PROMOTION_METADATA_DIGEST_INVALID: ${metadataSha256}`);
  if (qualification?.schemaVersion !== "crystra.dsh.release-qualification@1.0.0"
    || qualification.packageVersion !== finalTag
    || qualification.candidateTag !== candidateTag
    || qualification.commit !== commit
    || qualification.artifactMetadataSha256 !== metadataSha256) {
    throw new Error("PROMOTION_QUALIFICATION_BINDING_MISMATCH");
  }
  for (const gate of REQUIRED_GATES) {
    if (qualification.gates?.[gate] !== "PASS") throw new Error(`PROMOTION_GATE_FAILED: ${gate}`);
  }
}

export const releaseGateNames = REQUIRED_GATES;
