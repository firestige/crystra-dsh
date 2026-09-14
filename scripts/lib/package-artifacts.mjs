import { cp, mkdtemp, readFile, rm, mkdir, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

import { BoundaryViolation, validatePackInventory } from "./foundation-policy.mjs";



function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error !== undefined || result.status !== 0) {
    throw new BoundaryViolation(
      "ARTIFACT_COMMAND_FAILED",
      `${command} ${args.join(" ")}: ${result.error?.message ?? result.stderr ?? result.stdout}`.trim(),
    );
  }
  return result.stdout;
}

export async function packWorkspaces({ root, output }) {
  const repositoryRoot = resolve(root);
  const destination = resolve(output);
  await mkdir(destination, { recursive: true });
  const before = new Set(await readdir(destination));
  const staging=await mkdtemp(resolve(tmpdir(),"crystra-plugin-pack-"));
  try {
    await cp(repositoryRoot,staging,{recursive:true,filter:file=>![".git","node_modules","artifacts",".crystra-inputs"].includes(basename(file))});
    const manifest=JSON.parse(await readFile(resolve(staging,"package.json"),"utf8"));
    const inputs=JSON.parse(await readFile(resolve(repositoryRoot,"config/development-inputs.json"),"utf8")).inputs;
    if(JSON.stringify(manifest.bundleDependencies)!==JSON.stringify(["crystra-execution","crystra-ui-core"]))throw new BoundaryViolation("BUNDLED_COMPONENT_SET",manifest.name);
    for(const input of Object.values(inputs)) {
      const archive=resolve(repositoryRoot,".crystra-inputs",input.artifact);
      if(createHash("sha256").update(await readFile(archive)).digest("hex")!==input.sha256)throw new BoundaryViolation("COMPONENT_DIGEST_MISMATCH",input.package);
      const target=resolve(staging,"node_modules",input.package);await mkdir(target,{recursive:true});
      run("tar",["-xzf",archive,"--strip-components=1","-C",target]);
      const owner=JSON.parse(await readFile(resolve(target,"package.json"),"utf8"));
      if(owner.name!==input.package||owner.version!==input.version)throw new BoundaryViolation("BUNDLED_COMPONENT_IDENTITY",input.package);
      for(const [name,version] of Object.entries(owner.dependencies??{}))if(manifest.dependencies[name]!==version)throw new BoundaryViolation("BUNDLED_COMPONENT_DEPENDENCY",name);
    }
    // Only first-party packages exist here; npm cannot capture local native dependencies.
    run("npm", ["pack", "--silent", "--pack-destination", destination], {cwd: staging});
  } finally {await rm(staging,{recursive:true,force:true});}
  const archives = (await readdir(destination))
    .filter((entry) => entry.endsWith(".tgz") && !before.has(entry))
    .sort()
    .map((entry) => resolve(destination, entry));
  if (archives.length !== 1) {
    throw new BoundaryViolation("PACK_COUNT", `created ${archives.length} archives`);
  }
  for (const archive of archives) {
    const listing = run("tar", ["-tzf", archive]).trim().split("\n").filter(Boolean).sort();
    const name = "dsh-crystra";
    validatePackInventory({ name, files: listing });
  }
  return Object.freeze(archives);
}
