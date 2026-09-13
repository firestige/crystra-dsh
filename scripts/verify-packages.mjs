#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { packWorkspaces } from "./lib/package-artifacts.mjs";

const temporary = await mkdtemp(join(tmpdir(), "crystra-dsh-pack-"));
try {
  const archives = await packWorkspaces({ root: new URL("../", import.meta.url).pathname, output: temporary });
  process.stdout.write(`verified ${archives.length} package archives\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
