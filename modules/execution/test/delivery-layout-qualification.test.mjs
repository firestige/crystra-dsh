import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the real Harness mechanically qualifies Delivery first-fold, responsive, keyboard and visual evidence", async () => {
  const source = await readFile(new URL("../../../scripts/qualify-real-harness.mjs", import.meta.url), "utf8");
  for (const gate of [
    "HARNESS_DELIVERY_FIRST_FOLD_FAILED",
    "HARNESS_DELIVERY_NARROW_OVERFLOW",
    "HARNESS_DELIVERY_ZOOM_OVERFLOW",
    "HARNESS_DELIVERY_DISCLOSURE_FAILED",
    "HARNESS_DELIVERY_COPY_FAILED",
  ]) assert.match(source, new RegExp(gate, "u"));
  assert.match(source, /view\.style\.width\s*=\s*['"]320px['"]/u);
  assert.match(source, /Emulation\.setDeviceMetricsOverride[^\n]+width:\s*640[^\n]+deviceScaleFactor:\s*2/u);
  assert.match(source, /Page\.captureScreenshot/u);
  assert.match(source, /CRYSTRA_QUALIFY_SCREENSHOT_DIR/u);
});
