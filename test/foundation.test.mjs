import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";

import {
  BoundaryViolation,
  createProvenanceStatement,
  validatePackInventory,
  validateDependencyGraph,
  validateRepository,
  validateReleaseRequest,
  validateSourceFile,
} from "../scripts/lib/foundation-policy.mjs";
import { assertCompositionDump, commandFailureDetail, localSuiteOverrideYaml, localSuiteOverrides, reconcileSuiteLayers, suiteOnlyLayers } from "../scripts/lib/clean-profile-policy.mjs";

const root = resolve(import.meta.dirname, "..");

test("one root plugin owns both internal adapters", async () => {
  const report=await validateRepository(root);
  assert.deepEqual(report.packages.map(p=>p.name),["dsh-crystra"]);
  assert.equal(report.version,"0.1.0");
});

test("changed development dependency bytes fail closed", async () => {
  const temporary=await mkdtemp(join(tmpdir(),"crystra-input-drift-"));
  try {
    await cp(root,temporary,{recursive:true,filter:path=>![".git","node_modules","artifacts"].includes(basename(path))});
    const manifest=JSON.parse(await readFile(join(temporary,"package.json"),"utf8"));
    manifest.dependencies["crystra-execution"]="file:.crystra-inputs/crystra-execution-0.1.0.tgz";
    await writeFile(join(temporary,"package.json"),JSON.stringify(manifest));
    await writeFile(join(temporary,".crystra-inputs/crystra-execution-0.1.0.tgz"),"changed");
    await assert.rejects(validateRepository(temporary),/COMPONENT_DIGEST_MISMATCH/);
  } finally {await rm(temporary,{recursive:true,force:true});}
});

test("source-relative imports cannot escape a package boundary", () => {
  assert.throws(
    () => validateSourceFile({
      packageRoot: "/repo/modules/execution",
      path: "/repo/modules/execution/src/adapter.js",
      source: 'import value from "../../../execution-system/src/private.js";',
    }),
    (error) => error instanceof BoundaryViolation && error.code === "SOURCE_RELATIVE_IMPORT",
  );
});

test("copied domain implementation is rejected from DSH adapter packages", () => {
  assert.throws(
    () => validateSourceFile({
      packageRoot: "/repo/modules/studio",
      path: "/repo/modules/studio/src/domain/evidence-store.js",
      source: "export class EvidenceStore {}",
    }),
    (error) => error instanceof BoundaryViolation && error.code === "COPIED_DOMAIN_IMPLEMENTATION",
  );
});

test("DSH-specific Delivery UI and Evidence gateway adapter paths remain available to Wave 7", () => {
  assert.doesNotThrow(() => validateSourceFile({
    packageRoot: "/repo/modules/execution",
    path: "/repo/modules/execution/src/client/delivery/index.js",
    source: "export const registerDeliveryInventory = () => undefined;",
  }));
  assert.doesNotThrow(() => validateSourceFile({
    packageRoot: "/repo/modules/studio",
    path: "/repo/modules/studio/src/host/evidence/index.js",
    source: "export const registerEvidenceGateway = () => undefined;",
  }));
});

test("domain owners cannot acquire a reverse dependency on CRYSTRA DSH packages", () => {
  assert.throws(
    () => validateDependencyGraph([
      { name: "crystra-execution", repositoryRole: "domain-owner", dependencies: { "dsh-crystra": "1.0.0" } },
    ]),
    (error) => error instanceof BoundaryViolation && error.code === "REVERSE_DEPENDENCY",
  );
});

test("provenance binds sorted artifact digests to one repository revision", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "crystra-dsh-provenance-"));
  try {
    const execution = join(temporary, "dsh-crystra-execution-0.0.0-development.tgz");
    const studio = join(temporary, "dsh-crystra-studio-0.0.0-development.tgz");
    await writeFile(execution, "execution\n");
    await writeFile(studio, "studio\n");

    const statement = await createProvenanceStatement({
      artifacts: [studio, execution],
      commit: "199331516bf2a58cf0b09bca5a8d630ec8c5f028",
      version: "0.0.0-development",
    });

    assert.equal(statement.schemaVersion, "crystra.dsh.provenance@1.0.0");
    assert.deepEqual(statement.subjects.map(({ name }) => name), [
      "dsh-crystra-execution-0.0.0-development.tgz",
      "dsh-crystra-studio-0.0.0-development.tgz",
    ]);
    assert.ok(statement.subjects.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256)));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("one archive must include both adapters and exclude tests", () => {
  const files=["LICENSE","NOTICE.md","README.md","cordis.patch.yml","lib/client.js","package.json","src/index.js","modules/execution/src/index.js","modules/studio/src/index.js"].map(p=>`package/${p}`);
  assert.doesNotThrow(()=>validatePackInventory({name:"dsh-crystra",files}));
  assert.throws(()=>validatePackInventory({name:"dsh-crystra",files:[...files,"package/modules/execution/src/private.test.js"]}),/PACK_INVENTORY/);
});

test("candidate construction permits only an exact clean candidate", () => {
  assert.doesNotThrow(() => validateReleaseRequest({
    channel: "candidate",
    clean: true,
    commit: "199331516bf2a58cf0b09bca5a8d630ec8c5f028",
    version: "0.1.1",
  }));
  assert.throws(
    () => validateReleaseRequest({
      channel: "candidate",
      clean: false,
      commit: "199331516bf2a58cf0b09bca5a8d630ec8c5f028",
      version: "0.1.1",
    }),
    (error) => error instanceof BoundaryViolation && error.code === "DIRTY_RELEASE",
  );
});

test("suite qualification removes direct component layers and keeps one suite layer", () => {
  assert.deepEqual(suiteOnlyLayers([
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    "dsh-crystra-execution",
    "dsh-crystra-studio",
    "dsh-crystra",
  ]), [
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    "dsh-crystra",
  ]);
});

test("suite reconcile collapses repeated add layers deterministically", () => {
  assert.deepEqual(reconcileSuiteLayers([
    "@deepseek-ai/dsh-base",
    "dsh-crystra-execution",
    "dsh-crystra-studio",
    "dsh-crystra",
    "dsh-crystra",
  ]), ["@deepseek-ai/dsh-base", "dsh-crystra"]);
});

test("composed config requires each expected activation exactly once", () => {
  assert.doesNotThrow(() => assertCompositionDump(
    "id: crystra-execution\nname: dsh-crystra-execution\nid: crystra-studio\nname: dsh-crystra-studio\n",
    ["crystra-execution", "crystra-studio"],
  ));
  assert.throws(
    () => assertCompositionDump("id: crystra-execution\nid: crystra-execution\n", ["crystra-execution"]),
    /CLEAN_PROFILE_ACTIVATION_COUNT/u,
  );
});

test("clean-profile command failures preserve package-manager stdout and stderr", () => {
  assert.equal(commandFailureDetail({ stdout: "resolution failed\n", stderr: "dsh failed\n" }), "resolution failed\ndsh failed");
});

test("local suite qualification resolves independently versioned dependencies only from supplied archives", () => {
  assert.deepEqual(localSuiteOverrides({
    execution: "/tmp/dsh-crystra-execution-0.2.10.tgz",
    studio: "/tmp/dsh-crystra-studio-0.1.4.tgz",
  }), {
    "dsh-crystra-execution@0.2.10": "file:/tmp/dsh-crystra-execution-0.2.10.tgz",
    "dsh-crystra-studio@0.1.4": "file:/tmp/dsh-crystra-studio-0.1.4.tgz",
  });
  assert.deepEqual(localSuiteOverrides({
    execution: "/tmp/dsh-crystra-execution.tgz",
    studio: "/tmp/dsh-crystra-studio.tgz",
  }, { execution: "0.2.1", studio: "0.1.1" }), {
    "dsh-crystra-execution@0.2.1": "file:/tmp/dsh-crystra-execution.tgz",
    "dsh-crystra-studio@0.1.1": "file:/tmp/dsh-crystra-studio.tgz",
  });
});

test("pnpm 11 local qualification overrides are rendered into workspace policy", () => {
  assert.equal(localSuiteOverrideYaml({
    "dsh-crystra-execution@0.2.1": "file:/tmp/execution.tgz",
    "dsh-crystra-studio@0.1.1": "file:/tmp/studio.tgz",
  }), 'overrides:\n  "dsh-crystra-execution@0.2.1": "file:/tmp/execution.tgz"\n  "dsh-crystra-studio@0.1.1": "file:/tmp/studio.tgz"\n');
});
