import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const EXPECTED_PACKAGES = Object.freeze([{path: ".", name: "dsh-crystra"}]);
const SOURCE_EXTENSION = /\.(?:[cm]?js|tsx?)$/u;
const IMPORT_SPECIFIER = /(?:\bimport\s*(?:[^'"()]*?\s+from\s*)?|\bexport\s+[^'"()]*?\s+from\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/gu;

export class BoundaryViolation extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "BoundaryViolation";
    this.code = code;
    this.detail = detail;
  }
}

function exactKeys(value, expected, code, subject) {
  const actual = Object.keys(value ?? {}).sort();
  if (actual.join("\0") !== [...expected].sort().join("\0")) {
    throw new BoundaryViolation(code, `${subject} keys are ${actual.join(", ")}`);
  }
}

function within(root, candidate) {
  const path = relative(resolve(root), resolve(candidate));
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

async function json(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    throw new BoundaryViolation("INVALID_JSON", `${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

async function filesUnder(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "artifacts") continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else if (entry.isFile()) output.push(path);
  }
  return output.sort();
}

export function validateSourceFile({ packageRoot, path, source, policy = {} }) {
  const forbiddenSegments = policy.forbiddenDomainSegments ?? [
    "core", "domain", "runner", "workflow-domain",
  ];
  const sourceRelative = relative(resolve(packageRoot), resolve(path)).split(sep);
  if (sourceRelative.some((segment) => forbiddenSegments.includes(segment.toLowerCase()))) {
    throw new BoundaryViolation("COPIED_DOMAIN_IMPLEMENTATION", `${path} occupies a domain-owner path`);
  }

  for (const coordinate of policy.forbiddenSourceCoordinates ?? []) {
    if (source.includes(coordinate)) {
      throw new BoundaryViolation("OWNER_SOURCE_IMPORT", `${path} references ${coordinate}`);
    }
  }

  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const target = resolve(dirname(path), specifier);
    if (!within(packageRoot, target)) {
      throw new BoundaryViolation("SOURCE_RELATIVE_IMPORT", `${path} imports ${specifier}`);
    }
  }
}

export function validateDependencyGraph(manifests, domainOwnerRoles = [
  "domain-owner", "execution-owner", "evidence-owner", "evolution-owner", "contracts-owner", "workflow-package-owner",
]) {
  const dshPackages = new Set(EXPECTED_PACKAGES.map(({ name }) => name));
  for (const manifest of manifests) {
    if (!domainOwnerRoles.includes(manifest.repositoryRole)) continue;
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (dshPackages.has(dependency)) {
          throw new BoundaryViolation("REVERSE_DEPENDENCY", `${manifest.name} ${field} includes ${dependency}`);
        }
      }
    }
  }
}

export function validatePackInventory({ name, files }) {
  const required = ["package/LICENSE", "package/NOTICE.md", "package/README.md", "package/package.json", "package/cordis.patch.yml", "package/src/index.js", "package/lib/client.js", "package/modules/execution/src/index.js", "package/modules/studio/src/index.js"];
  const allowed = /^package\/(?:LICENSE|NOTICE\.md|README\.md|package\.json|cordis\.patch\.yml|lib\/client\.js|src\/.+|modules\/(?:execution|studio|initialization)\/(?:src\/.+|README\.md|NOTICE\.md)|skills\/.+)$/u;
  if (name !== "dsh-crystra" || required.some(file => !files.includes(file))
      || files.some(file => !allowed.test(file) || /(?:^|\/)test(?:s)?\/|\.test\.[cm]?[jt]sx?$/u.test(file))) {
    throw new BoundaryViolation("PACK_INVENTORY", name);
  }
}

export function validateReleaseRequest({ channel, clean, commit, version }) {
  if (channel !== "candidate") throw new BoundaryViolation("RELEASE_CHANNEL", String(channel));
  if (!clean) throw new BoundaryViolation("DIRTY_RELEASE", "candidate artifacts require a clean commit");
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new BoundaryViolation("PROVENANCE_COMMIT", String(commit));
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
    throw new BoundaryViolation("RELEASE_VERSION", String(version));
  }
}

export async function validateRepository(root) {
  const repositoryRoot = resolve(root);
  const manifest = await json(resolve(repositoryRoot, "package.json"));
  const policy = await json(resolve(repositoryRoot, "config/boundary-policy.json"));
  const compatibility = await json(resolve(repositoryRoot, "config/dsh-compatibility.json"));
  if (manifest.name !== "dsh-crystra" || manifest.private === true || manifest.workspaces !== undefined) {
    throw new BoundaryViolation("PACKAGE_IDENTITY", "only the root dsh-crystra plugin may be distributed");
  }
  if (manifest.repository?.url !== "git+https://github.com/firestige/crystra-dsh.git") throw new BoundaryViolation("REPOSITORY_IDENTITY", manifest.name);
  if (manifest.license !== "Apache-2.0") throw new BoundaryViolation("LICENSE_MISSING", manifest.name);
  if (manifest.dsh?.compatibility?.dsh !== compatibility.dsh || manifest.peerDependencies?.["@deepseek-ai/dsh"] !== compatibility.dsh) throw new BoundaryViolation("DSH_VERSION_DRIFT", manifest.name);
  if (manifest.exports?.["./client"] !== "./lib/client.js" || manifest.dsh?.client?.platform !== "web") throw new BoundaryViolation("CLIENT_ACTIVATION_MISSING", manifest.name);
  if (manifest.dsh?.bundle?.patch !== "./cordis.patch.yml") throw new BoundaryViolation("BUNDLE_PATCH_MISSING", manifest.name);
  const patch = await readFile(resolve(repositoryRoot, "cordis.patch.yml"), "utf8");
  const names = [...patch.matchAll(/^\s+name:\s*['"]([^'"]+)['"]/gmu)].map(match => match[1]);
  if (names.join(",") !== "@deepseek-ai/dsh-client-ui-workspace,dsh-crystra") throw new BoundaryViolation("ACTIVATION_GRAPH", names.join(","));
  const inputs = await json(resolve(repositoryRoot, "config/development-inputs.json"));
  for (const input of Object.values(inputs.inputs)) {
    if (manifest.dependencies?.[input.package] === undefined || !/^[0-9a-f]{40}$/u.test(input.revision)) throw new BoundaryViolation("COMPONENT_DEPENDENCY", input.package);
    const coordinate = manifest.dependencies[input.package];
    if (coordinate.startsWith("file:")) {
      const expected = `file:.crystra-inputs/${input.artifact}`;
      if (coordinate !== expected || await sha256(resolve(repositoryRoot, coordinate.slice(5))) !== input.sha256) throw new BoundaryViolation("COMPONENT_DIGEST_MISMATCH", input.package);
    } else if (!/^https:\/\/github\.com\/firestige\/crystra-[^/]+\/releases\/download\/[^/]+\/[^/]+\.tgz$/u.test(coordinate)) throw new BoundaryViolation("COMPONENT_COORDINATE", coordinate);
  }
  if (Object.keys(manifest.dependencies).some(name => name.startsWith("dsh-crystra-") || name.startsWith("dsh-wsr"))) throw new BoundaryViolation("BUNDLE_COUPLING", manifest.name);
  for (const directory of ["src", "modules/execution/src", "modules/studio/src", "modules/initialization/src"]) {
    for (const path of await filesUnder(resolve(repositoryRoot, directory))) {
      if (SOURCE_EXTENSION.test(path)) validateSourceFile({packageRoot: repositoryRoot, path, source: await readFile(path,"utf8"), policy});
    }
  }
  return Object.freeze({dshVersion:compatibility.dsh, version:manifest.version, packages:[{name:manifest.name,path:".",manifest}],packageVersions:{[manifest.name]:manifest.version},displayNames:{[manifest.name]:"Crystra"}});
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function createProvenanceStatement({ artifacts, commit, version }) {
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new BoundaryViolation("PROVENANCE_COMMIT", commit);
  const subjects = [];
  for (const path of [...artifacts].sort((left, right) => basename(left).localeCompare(basename(right)))) {
    subjects.push(Object.freeze({ name: basename(path), sha256: await sha256(path) }));
  }
  if (subjects.length === 0) throw new BoundaryViolation("PROVENANCE_EMPTY", "no artifacts supplied");
  return Object.freeze({
    schemaVersion: "crystra.dsh.provenance@1.0.0",
    repository: "https://github.com/firestige/crystra-dsh",
    commit,
    version,
    subjects: Object.freeze(subjects),
  });
}
