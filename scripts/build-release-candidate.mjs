#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { createProvenanceStatement, validateReleaseRequest, validateRepository } from "./lib/foundation-policy.mjs";
import { packWorkspaces } from "./lib/package-artifacts.mjs";
import { assertCandidateTag } from "./lib/release-policy.mjs";

const root = new URL("../", import.meta.url).pathname;
const output = resolve(process.argv[2] ?? resolve(root, "artifacts/candidate"));

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

async function digest(path) {
  return `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`;
}

try {
  const repository = await validateRepository(root);
  const commit = git("rev-parse", "HEAD");
  const clean = git("status", "--porcelain").length === 0;
  const candidateTag = process.env.CRYSTRA_CANDIDATE_TAG;
  validateReleaseRequest({ channel: process.env.CRYSTRA_RELEASE_CHANNEL, clean, commit, version: repository.version });
  assertCandidateTag(candidateTag, repository.version);
  const compatibilityFile = resolve(root, "config/dsh-compatibility.json");
  const manifest = JSON.parse(await readFile(resolve(root,"package.json"),"utf8"));
  const componentInputs = JSON.parse(await readFile(resolve(root,"config/development-inputs.json"),"utf8")).inputs;
  for (const input of Object.values(componentInputs)) {
    const coordinate = manifest.dependencies[input.package];
    if (!coordinate.startsWith("https://github.com/")) throw new Error("PUBLISHED_COMPONENT_DEPENDENCIES_REQUIRED");
    const response=await fetch(coordinate);
    if (!response.ok) throw new Error(`COMPONENT_DOWNLOAD_FAILED: ${input.package}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex")!==input.sha256) throw new Error(`COMPONENT_DIGEST_MISMATCH: ${input.package}`);
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const archives = await packWorkspaces({ root, output });
  const order = ["dsh-crystra"];
  const packages = [];
  for (const file of archives) {
    const name = "dsh-crystra";
    packages.push({ package: name, version: repository.packageVersions[name], file: basename(file), sha256: await digest(file) });
  }
  packages.sort((left, right) => order.indexOf(left.package) - order.indexOf(right.package));
  const provenance = await createProvenanceStatement({ artifacts: archives, commit, version: repository.version });
  await writeFile(resolve(output, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`, { flag: "wx" });
  const frozen = JSON.parse(await readFile(compatibilityFile, "utf8"));

  const compatibility = {
    schemaVersion: "crystra.dsh.release-compatibility@1.0.0", packageVersion: repository.version,
    dsh: repository.dshVersion, node: "24.12.0", npm: "11.6.2",
    components: componentInputs, packageVersions: repository.packageVersions,
    packages: packages.map(({ package: name }) => name),
  };
  await writeFile(resolve(output, "compatibility-matrix.json"), `${JSON.stringify(compatibility, null, 2)}\n`, { flag: "wx" });
  const sbom = {
    spdxVersion: "SPDX-2.3", dataLicense: "CC0-1.0", SPDXID: "SPDXRef-DOCUMENT", name: `crystra-dsh-${repository.version}`,
    documentNamespace: `https://github.com/firestige/crystra-dsh/releases/${candidateTag}/sbom`,
    creationInfo: { created: new Date().toISOString(), creators: ["Tool: crystra-dsh-release"] },
    packages: packages.map(({ package: name, version }) => ({ name, SPDXID: `SPDXRef-Package-${name}`, versionInfo: version, downloadLocation: "NOASSERTION", filesAnalyzed: false, licenseConcluded: "Apache-2.0", licenseDeclared: "Apache-2.0", copyrightText: "NOASSERTION" })),
  };
  await writeFile(resolve(output, "sbom.spdx.json"), `${JSON.stringify(sbom, null, 2)}\n`, { flag: "wx" });
  const metadata = {
    schemaVersion: "crystra.dsh.release-metadata@1.0.0", repository: "firestige/crystra-dsh", commit,
    candidateTag, packageVersion: repository.version, packages,
    supportFiles: ["provenance.json", "compatibility-matrix.json", "sbom.spdx.json"],
  };
  await writeFile(resolve(output, "release-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" });
  const checksummed = [...packages.map(({ file }) => file), ...metadata.supportFiles, "release-metadata.json"];
  const checksums = [];
  for (const file of checksummed.sort()) checksums.push(`${(await digest(resolve(output, file))).slice(7)}  ${file}`);
  await writeFile(resolve(output, "SHA256SUMS"), `${checksums.join("\n")}\n`, { flag: "wx" });
  process.stdout.write(`qualified candidate inputs written to ${output}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
