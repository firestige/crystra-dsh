import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("the independent development harness mounts the production Studio plugin instead of copying its UI or domain authority", async () => {
  const source = await readFile(resolve(import.meta.dirname, "../dev/main.js"), "utf8");
  assert.match(source, /createStudioClientPlugin\(\{ React, Primitives, Bi/u);
  assert.doesNotMatch(source, /function Studio|class Studio|fetch\s*\(|facts\/(?:write|delete)|traces\/(?:write|delete)/u);
  assert.doesNotMatch(source, /useSessions|cwd|repository context/iu);
});
