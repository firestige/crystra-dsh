# Crystra release and installation lifecycle

The only public plugin is **dsh-crystra**, registered through **firestige/crystra-dsh**. Execution, Studio and initialization are internal modules; crystra-execution and crystra-ui-core are ordinary dependencies. There is no independently installed Intake, Studio, suite or standalone installer. Old WSR packages and deployed data are not migrated.

DSH owns installation and the Host. Use an exact qualified plugin release and the [initialization commands](initialization.md): `/crystra setup`, `/crystra doctor`, and `/crystra services start|stop|status`. Unloading or uninstalling preserves service state and volumes. Stop services explicitly if they should not continue. Internal modularity does not change Execution's per-Role Provider authorization boundary.

## Frozen release inputs

config/development-inputs.json records ordinary dependency package names, versions, source revisions and artifact hashes. Development can prepare exact local artifacts, but candidate publication requires published GitHub dependency URLs and matching digests. The plugin package.json must select those exact remote inputs.

The release-bound modules/initialization/src/service-descriptor.json identifies the service archive URL, archive directory and SHA-256. The combination repository publishes and qualifies service resources before the plugin that binds them. Missing service assets block candidate construction; development-only local image fixtures do not satisfy published-input qualification.

## Candidate evidence

The only RC entry is a push to release/next with release/request.json. Tags use crystra-dsh-vX.Y.Z-rc.N. The builder creates the single plugin archive first. scripts/run-release-qualification.mjs executes the fixed gates against that exact archive and retains per-gate logs and receipts in qualification-evidence/.

Receipts bind the candidate tag, source commit, release metadata hash and log hash. Missing, failed or mismatched receipts cannot produce PASS. Clean-profile, lifecycle and real-Harness checks consume the candidate archive without repacking it. The Host run also covers loopback outage, and Provider routing remains an Execution concern. The remote-input gate verifies both component and service bytes. A retry starts with a fresh output directory.

The release uploads qualification-evidence.tar.gz with release-qualification.json, release-metadata.json, the plugin archive and checksums. Component qualification does not replace the final combination's actual-environment acceptance.

## Human promotion and first release

Only a human dispatches release-promote.yml with the exact qualified candidate tag. The workflow verifies downloaded qualification and artifact bytes, then publishes the same candidate files under crystra-dsh-vX.Y.Z; it does not rebuild or publish separate subplugins to npm.

Release workflows use the repository-scoped release App with CRYSTRA_RELEASE_CLIENT_ID and CRYSTRA_RELEASE_APP_PRIVATE_KEY. Their presence and the first actual new release must be verified separately. Code integration during the rename does not imply those permissions or a usable published release already exist.

For combination-level GA, lower-layer coordinates must already be stable. Bind stable Execution/UI and service assets before building the plugin RC intended for such a combination. Do not change dependencies or the service descriptor during promotion. The combination rules are maintained in [crystra's release guide](https://github.com/firestige/crystra/blob/main/docs/guides/release-automation.md).
