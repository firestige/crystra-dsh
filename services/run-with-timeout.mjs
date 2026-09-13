#!/usr/bin/env node

import process from "node:process";
import { spawn } from "node:child_process";

const [secondsText, command, ...args] = process.argv.slice(2);
const seconds = Number(secondsText);
if (!Number.isInteger(seconds) || seconds < 1 || command === undefined) {
  process.stderr.write("usage: run-with-timeout.mjs SECONDS COMMAND [ARG ...]\n");
  process.exit(2);
}

const grouped = process.platform !== "win32";
const child = spawn(command, args, { stdio: "inherit", detached: grouped });
let timedOut = false;

function signalChild(signal) {
  try {
    if (grouped) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

const timeout = setTimeout(() => {
  timedOut = true;
  signalChild("SIGTERM");
  setTimeout(() => signalChild("SIGKILL"), 1000).unref();
}, seconds * 1000);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => signalChild(signal));
}

child.on("error", (error) => {
  clearTimeout(timeout);
  process.stderr.write(`${command} could not start: ${error.message}\n`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  clearTimeout(timeout);
  if (timedOut) {
    process.stderr.write(`${command} exceeded ${seconds} seconds and was terminated.\n`);
    process.exitCode = 124;
  } else if (Number.isInteger(code)) {
    process.exitCode = code;
  } else {
    process.stderr.write(`${command} terminated by ${signal ?? "an unknown signal"}.\n`);
    process.exitCode = 1;
  }
});
