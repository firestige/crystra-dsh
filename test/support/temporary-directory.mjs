import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Workflow sources require canonical paths, including when the OS temp root is a symlink.
export async function createTemporaryDirectory(prefix) {
  return realpath(await mkdtemp(join(tmpdir(), prefix)));
}
