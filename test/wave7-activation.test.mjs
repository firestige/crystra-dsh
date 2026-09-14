import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import * as ReactDOM from "react-dom";

const root = resolve(import.meta.dirname, "..");
const json = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));

test("one plugin activates its internal Host and browser modules", async () => {
  const manifest=await json("package.json");
  assert.equal(manifest.name,"dsh-crystra");
  assert.equal(manifest.exports["./client"],"./lib/client.js");
  assert.ok(manifest.dependencies["crystra-execution"]);
  assert.ok(manifest.dependencies["crystra-ui-core"]);
  assert.equal(manifest.peerDependencies["crystra-execution"],undefined);
});

test("the real Harness qualification boots the v2 runner with repository Role Provider bindings", async () => {
  const source = await readFile(join(root, "scripts/qualify-real-harness.mjs"), "utf8");
  assert.match(source, /schemaVersion: "execution\.config@2\.0\.0"/u);
  assert.match(source, /implementationKey: "runner\.v2"/u);
  assert.match(source, /\.crystra", "role-provider-bindings\.json"/u);
  assert.match(source, /"role\.greeter"[\s\S]*provider\.copilot[\s\S]*"role\.reviewer"[\s\S]*provider\.codex/u);
  assert.match(source, /archives\.length !== 1/u);
  assert.doesNotMatch(source, /dsh-crystra-0\.2\.1\.tgz/u);
  assert.match(source, /summary[^\n]*Technical details/u);
});

test("the real Harness qualifies the semantic trace DataZoom contract", async () => {
  const source = await readFile(join(root, "scripts/qualify-real-harness.mjs"), "utf8");
  assert.match(source, /role="slider"\]\[aria-label="Trace minimap zoom window"\]/u);
  assert.match(source, /trace-waterfall-minimap-overview/u);
  assert.match(source, /trace-waterfall-data-zoom-window/u);
  assert.match(source, /trace-waterfall-data-zoom-handle-left/u);
  assert.match(source, /trace-waterfall-data-zoom-handle-right/u);
  assert.match(source, /\.trace-minimap-ruler/u);
  assert.doesNotMatch(source, /\.trace-ruler i/u);
  assert.doesNotMatch(source, /input\[type="range"\]/u);
});

test("the real Harness qualifies the deterministic trace Tree canvas contract", async () => {
  const source = await readFile(join(root, "scripts/qualify-real-harness.mjs"), "utf8");
  assert.match(source, /canvas\[aria-label="Recorded span call tree graph"\]/u);
  assert.match(source, /\[aria-label="Tree minimap navigation"\]/u);
  assert.match(source, /parentEdgeCount/u);
  assert.match(source, /linkCount/u);
  assert.doesNotMatch(source, /svg\[aria-label="Recorded span call tree graph"\]/u);
  assert.doesNotMatch(source, /\[aria-label="Semantic camera map"\]/u);
});

test("the real Harness requires Trace without duplicate overview summaries", async () => {
  const source = await readFile(join(root, "scripts/qualify-real-harness.mjs"), "utf8");
  assert.match(source, /waterfall.summaryLabels.length !== 0/u);
  assert.doesNotMatch(source, /label: "Statistics"/u);
});

test("generated clients use one module identity and no private source or direct downstream transport", async () => {
  const execution = await readFile(join(root, "lib/client.js"), "utf8");
  const studio = await readFile(join(root, "lib/client.js"), "utf8");
  assert.match(execution, /id: "dsh-crystra"/u);
  assert.match(studio, /id: "dsh-crystra"/u);
  assert.doesNotMatch(execution, /execution-system\/src|\/crystra list/u);
  assert.doesNotMatch(studio, /EVIDENCE_UPSTREAM|EVOLUTION_UPSTREAM|fetch\(["']https?:/u);
  assert.doesNotMatch(`${execution}\n${studio}`, /\beval\s*\(|new Function|document\.write/u);

  for (const [source, expected] of [[execution, "dsh-crystra"]]) {
    let definition;
    vm.runInNewContext(source, {
      TextDecoder, TextEncoder, URL, URLSearchParams,
      window: { __ModuleLoader__: { load(value) { definition = value; } } },
    });
    assert.equal(definition.id, expected);
    const loaded = definition.factory((name) => {
      if (name === "react") return React;
      if (name === "react-dom") return ReactDOM;
      if (name === "react/jsx-runtime") return { jsx() {}, jsxs() {} };
      if (name === "@deepseek-ai/dsh-client-runtime/client") return { defineStore() {} };
      if (name === "@deepseek-ai/dsh-client-ui-primitives") return {
        DisclosureRow() {}, MessageText() {}, StateDot() {},
      };
      if (name === "@deepseek-ai/dsh-client-ui-workspace") return { apply() {}, inject: [] };
      throw new Error(`unexpected browser dependency ${name}`);
    });
    assert.equal(typeof loaded.apply, "function");
    assert.ok(Array.isArray(loaded.inject));
  }
});

test("one Cordis patch registers only Crystra and its workspace override", async () => {
  const patch=await readFile(join(root,"cordis.patch.yml"),"utf8");
  assert.match(patch,/id: crystra\n\s+name: 'dsh-crystra'/);
  assert.match(patch,/id: ui-workspace[\s\S]*disabled: true/);
  assert.doesNotMatch(patch,/dsh-crystra-(?:execution|studio)|__REQUIRED__/);
});
