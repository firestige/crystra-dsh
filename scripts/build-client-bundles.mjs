#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const bundles = Object.freeze([{
  id: "dsh-crystra",
  entry: "src/client/index.js",
  output: "lib/client.js",
  external: ["react", "react-dom", "@deepseek-ai/dsh-client-ui-primitives"],
}]);

for (const bundle of bundles) {
  const result = await build({
    absWorkingDir: root,
    bundle: true,
    entryPoints: [bundle.entry],
    external: bundle.external,
    format: "cjs",
    legalComments: "none",
    minify: false,
    platform: "browser",
    target: "es2022",
    loader: { ".css": "text" },
    write: false,
  });
  if (result.outputFiles.length !== 1) throw new Error(`CLIENT_BUNDLE_OUTPUT_INVALID: ${bundle.id}`);
  const body = result.outputFiles[0].text;
  const output = resolve(root, bundle.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(bundle.id)},\n  factory: (platformRequire) => {\n    const require = platformRequire;\n    const module = { exports: {} };\n    const exports = module.exports;\n${body}\n    return module.exports;\n  },\n});\n`);
}
