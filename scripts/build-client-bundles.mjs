#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const bundles = Object.freeze([{
  id: "dsh-crystra",
  entry: "src/client/index.js",
  output: "lib/client.js",
  fixedFork: {
    module: "@deepseek-ai/dsh-client-ui-workspace",
    source: "node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js",
  },
  external: ["react", "react-dom", "@deepseek-ai/dsh-client-ui-primitives", "@deepseek-ai/dsh-client-ui-workspace"],
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
  let fork = "const require = platformRequire;";
  if (bundle.fixedFork !== undefined) {
    const source = await readFile(resolve(root, bundle.fixedFork.source), "utf8");
    const match = source.match(/\tfactory: \(require\) => \{\n([\s\S]*?)\n\t\}\n\}\);/u);
    if (match === null) throw new Error(`FIXED_FORK_SOURCE_INVALID: ${bundle.fixedFork.module}`);
    fork = `const fixedWorkspaceUi = ((require) => {\n${match[1]}\n})(platformRequire);\n    const require = (name) => name === ${JSON.stringify(bundle.fixedFork.module)} ? fixedWorkspaceUi : platformRequire(name);`;
  }
  const output = resolve(root, bundle.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(bundle.id)},\n  factory: (platformRequire) => {\n    ${fork}\n    const module = { exports: {} };\n    const exports = module.exports;\n${body}\n    return module.exports;\n  },\n});\n`);
}
