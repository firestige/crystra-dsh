# Remote integration — 2026-09-28

Remote main `ad500a3` includes lifecycle documentation (`fee8e87`), the parallel v8
assembly (`89d8f0a`) and host navigation fixes. It targets DSH 0.1.1. The current
accepted local branch targets DSH 0.1.5 and is based on `e1a5d86`.

The merge retains the accepted local implementation and integrates remote ancestry.
This is an explicit supersession resolution, not a claim that both trees match:

- Lifecycle documentation already exists locally from `88f48d8`.
- Keep 0.1.5 session/workspace/slot APIs, native TSX shell, DSH-owned sidebar,
  Task and Workflow session isolation, persisted resource actions and shared UI.
- Preserve current Crystra/DSH banner navigation and settings, rather than restore
  0.1.1 product-entry injection and its old draft-authoring gateways.
- Retain the bounded Analysis gateway, recorded-time query composition and
  localStorage configuration from the accepted integration.
- Preserve exact local component artifacts and the generated native client bundle.
  The remote published dependency pins, old harness tests and release requests
  describe the superseded assembly and must not downgrade this candidate.

All remote source remains available through the merge parent. No remote commit is
rewritten and no release is requested. This branch is pushed under its existing
name; merging it into remote main is a separate operation.
