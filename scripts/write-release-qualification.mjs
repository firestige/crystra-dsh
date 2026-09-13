#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {readQualificationReceipts} from "./lib/qualification-receipts.mjs";

const directory = resolve(process.argv[2] ?? "artifacts/candidate");
try {
  const bytes = await readFile(resolve(directory, "release-metadata.json"));
  const metadata = JSON.parse(bytes);
  const receipts = await readQualificationReceipts(resolve(directory,"qualification-evidence"),bytes);
  const qualification = {
    schemaVersion: "crystra.dsh.release-qualification@1.0.0", packageVersion: metadata.packageVersion,
    candidateTag: metadata.candidateTag, commit: metadata.commit,
    artifactMetadataSha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    gates: Object.fromEntries(Object.keys(receipts).map(gate => [gate, receipts[gate].status])),
    receipts,
  };
  await writeFile(resolve(directory, "release-qualification.json"), `${JSON.stringify(qualification, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify(qualification, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
