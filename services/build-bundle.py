#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).parent
EXACT_IMAGE = re.compile(r"^[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$")
VERSION = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$")


def fail(message: str) -> None:
    raise SystemExit(f"invalid Compose release manifest: {message}")


def load_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("schemaVersion") != "crystra.compose-release@1.0.0":
        fail("unsupported schemaVersion")
    version = value.get("version")
    if not isinstance(version, str) or VERSION.fullmatch(version) is None:
        fail("version must be exact semver")
    if value.get("supportedPlatforms") != ["linux/amd64", "linux/arm64"]:
        fail("supportedPlatforms must be the qualified linux/amd64 and linux/arm64 matrix")
    compatibility = value.get("schemaCompatibility")
    if not isinstance(compatibility, dict):
        fail("schemaCompatibility must be present")
    revision = compatibility.get("evidenceRevision")
    reads = compatibility.get("reads")
    if not isinstance(revision, str) or not isinstance(reads, list) or revision not in reads:
        fail("Evidence migration revision is not rollback-readable")
    host = value.get("hostIntegration")
    if not isinstance(host, dict) or host != {
        "schemaVersion": "crystra.loopback-host@1.0.0",
        "evidenceQueryRevision": "0.1.0",
        "evidenceTaskQueryRevision": "1.0.0",
        "evolutionComputeRevision": "1",
    }:
        fail("loopback Host Contract revisions are incompatible")
    images = value.get("images")
    if not isinstance(images, dict) or set(images) != {"postgres", "evidence", "evolution"}:
        fail("images must be exactly postgres, evidence, and evolution")
    for name, image in images.items():
        if not isinstance(image, dict):
            fail(f"{name} image record must be an object")
        coordinate = image.get("coordinate")
        source = image.get("source")
        provenance = image.get("provenance")
        if not isinstance(coordinate, str) or EXACT_IMAGE.fullmatch(coordinate) is None:
            fail(f"{name} image must contain an exact tag and immutable sha256 digest")
        if not isinstance(source, str) or not source.startswith("https://"):
            fail(f"{name} image source provenance must be an HTTPS URL")
        if not isinstance(provenance, str) or not provenance.startswith("https://"):
            fail(f"{name} image attestation provenance must be an HTTPS URL")
    return value


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build-bundle.py RELEASE.json OUTPUT-DIRECTORY")
    manifest_path = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    if output.exists():
        fail("output directory already exists")
    manifest = load_manifest(manifest_path)
    images = manifest["images"]
    replacements = {
        "@POSTGRES_IMAGE@": images["postgres"]["coordinate"],
        "@EVIDENCE_IMAGE@": images["evidence"]["coordinate"],
        "@EVOLUTION_IMAGE@": images["evolution"]["coordinate"],
        "@BUNDLE_VERSION@": manifest["version"],
    }
    output.mkdir(parents=True)
    compose = (ROOT / "compose.template.yaml").read_text(encoding="utf-8")
    launcher = (ROOT / "crystra-compose.template").read_text(encoding="utf-8")
    for marker, replacement in replacements.items():
        compose = compose.replace(marker, replacement)
        launcher = launcher.replace(marker, replacement)
    if "@" in "".join(marker for marker in replacements if marker in compose + launcher):
        fail("bundle template contains unresolved markers")
    files = {
        "compose.yaml": compose,
        "crystra-compose": launcher,
        "release.json": json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        "evolution.config.json": (ROOT / "evolution.config.json").read_text(encoding="utf-8"),
        "init-roles.sh": (ROOT / "init-roles.sh").read_text(encoding="utf-8"),
        "README.md": (ROOT / "README.md").read_text(encoding="utf-8"),
        "loopback-host.md": (ROOT / "loopback-host.md").read_text(encoding="utf-8"),
        "host-endpoints.template.json": (
            ROOT / "host-endpoints.template.json"
        ).read_text(encoding="utf-8"),
        "crystra-host-preflight.mjs": (
            ROOT / "crystra-host-preflight.mjs"
        ).read_text(encoding="utf-8"),
        "run-with-timeout.mjs": (
            ROOT / "run-with-timeout.mjs"
        ).read_text(encoding="utf-8"),
    }
    for name, content in files.items():
        (output / name).write_text(content, encoding="utf-8")
    (output / "crystra-compose").chmod(0o755)
    (output / "init-roles.sh").chmod(0o755)
    (output / "crystra-host-preflight.mjs").chmod(0o755)
    (output / "run-with-timeout.mjs").chmod(0o755)
    checksums = []
    for name in sorted(files):
        digest = hashlib.sha256((output / name).read_bytes()).hexdigest()
        checksums.append(f"{digest}  {name}")
    (output / "SHA256SUMS").write_text("\n".join(checksums) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
