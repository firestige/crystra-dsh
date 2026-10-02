import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");
test("the unified plugin locks the shared BI development archive by digest", async () => {
  const manifest=JSON.parse(await readFile(resolve(root,"package.json"),"utf8"));
  const input=JSON.parse(await readFile(resolve(root,"config/development-inputs.json"),"utf8")).inputs.ui;
  const lock=JSON.parse(await readFile(resolve(root,"package-lock.json"),"utf8"));
  assert.equal(lock.packages["node_modules/crystra-ui-core"].version,input.version);
  assert.equal(manifest.dependencies["crystra-ui-core"],`file:.crystra-inputs/${input.artifact}`);
  const bytes=await readFile(resolve(root,".crystra-inputs",input.artifact));
  assert.equal(createHash("sha256").update(bytes).digest("hex"),input.sha256);
});

test("the production browser entry consumes only the formal package exports", async () => {
  const source = await readFile(
    resolve(root, "modules/studio/src/client/browser-entry.js"),
    "utf8",
  );
  assert.match(source, /from "crystra-ui-core"/u);
  assert.match(source, /from "crystra-ui-core\/styles\.css"/u);
  assert.doesNotMatch(source, /crystra-ui\/packages\/bi\/src|\.\.\/\.\.\/\.\.\/crystra-ui/u);
});

test("the built Studio bundle embeds the qualified package but keeps Host React external", async () => {
  const bundle = await readFile(
    resolve(root, "lib/client.js"),
    "utf8",
  );
  assert.match(bundle, /node_modules\/crystra-ui-core\/dist\/index\.js/u);
  assert.match(bundle, /require\("react"\)/u);
  assert.match(bundle, /require\("react\/jsx-runtime"\)/u);
  assert.match(bundle, /data-crystra-bi-styles/u);
  assert.doesNotMatch(bundle, /react_production_min|react\.production\.min|__SECRET_INTERNALS_DO_NOT_USE/u);
  assert.doesNotMatch(bundle, /crystra-ui\/packages\/bi\/src|@crystra\/bi|(?:from|require\()\s*["'](?:file:|workspace:)/u);
  assert.doesNotMatch(bundle, /rendererSelector|selectRenderer|canvasRenderer/iu);
  assert.doesNotMatch(bundle, /projectRecordedStructure|RecordedStructureFoundation/u);
});
