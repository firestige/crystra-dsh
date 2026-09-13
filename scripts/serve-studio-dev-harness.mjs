#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const built = await build({
  absWorkingDir: root, bundle: true, entryPoints: ["modules/studio/dev/main.js"],
  format: "iife", platform: "browser", target: "es2022", outdir: "studio-dev-out", write: false,
  loader: { ".ttf": "dataurl", ".woff": "dataurl", ".woff2": "dataurl" },
});
const html = await readFile(resolve(root, "modules/studio/dev/index.html"));
const javascript = built.outputFiles.find((file) => file.path.endsWith("main.js"))?.contents;
const stylesheet = built.outputFiles.find((file) => file.path.endsWith("main.css"))?.contents;
if (javascript === undefined || stylesheet === undefined) throw new Error("STUDIO_DEV_BUILD_OUTPUT_INVALID");
const port = Number(process.env.CRYSTRA_STUDIO_DEV_PORT ?? 4173);
createServer((_request, response) => {
  const client = _request.url === "/client.js";
  const styles = _request.url === "/client.css";
  response.writeHead(200, { "content-type": client ? "text/javascript; charset=utf-8" : styles ? "text/css; charset=utf-8" : "text/html; charset=utf-8" });
  response.end(client ? javascript : styles ? stylesheet : html);
}).listen(port, "127.0.0.1", () => process.stdout.write(`CRYSTRA Studio dev harness: http://127.0.0.1:${port}\n`));
