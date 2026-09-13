import { mkdir, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
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
  run("npm", ["pack", "--silent", "--pack-destination", destination], {cwd: repositoryRoot});
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
