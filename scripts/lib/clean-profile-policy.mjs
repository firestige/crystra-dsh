export function suiteOnlyLayers(layers) {
  if (!Array.isArray(layers) || !layers.includes("dsh-crystra")
    || !layers.includes("dsh-crystra-execution") || !layers.includes("dsh-crystra-studio")) {
    throw new Error("CLEAN_PROFILE_SUITE_LAYERS_MISSING");
  }
  return layers.filter((name) => name !== "dsh-crystra-execution" && name !== "dsh-crystra-studio");
}

export function reconcileSuiteLayers(layers) {
  if (!Array.isArray(layers) || !layers.includes("dsh-crystra")) throw new Error("CLEAN_PROFILE_SUITE_LAYER_MISSING");
  const withoutCrystra = layers.filter((name) => !["dsh-crystra-execution", "dsh-crystra-studio", "dsh-crystra"].includes(name));
  return [...withoutCrystra, "dsh-crystra"];
}

export function assertCompositionDump(dump, expectedIds) {
  for (const id of expectedIds) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const count = [...dump.matchAll(new RegExp(`\\bid:\\s*['\"]?${escaped}['\"]?\\s*$`, "gmu"))].length;
    if (count !== 1) throw new Error(`CLEAN_PROFILE_ACTIVATION_COUNT: ${id}=${count}`);
  }
  if (/\bid:\s*['"]?crystra-suite['"]?\s*$/mu.test(dump)) throw new Error("CLEAN_PROFILE_SUITE_ACTIVATION_LEAKAGE");
}

export function commandFailureDetail({ stdout, stderr }) {
  return [stdout, stderr].map((value) => value?.trim()).filter(Boolean).join("\n");
}

export function localSuiteOverrides({ execution, studio }, versions = { execution: "0.2.10", studio: "0.1.4" }) {
  return {
    [`dsh-crystra-execution@${versions.execution}`]: `file:${execution}`,
    [`dsh-crystra-studio@${versions.studio}`]: `file:${studio}`,
  };
}

export function localSuiteOverrideYaml(overrides) {
  const lines = ["overrides:"];
  for (const [name, value] of Object.entries(overrides).sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`  ${JSON.stringify(name)}: ${JSON.stringify(value)}`);
  }
  return `${lines.join("\n")}\n`;
}
