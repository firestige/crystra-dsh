# Deployment readiness after DSH 0.1.5-rc.2 alignment

The component sources now align the Execution provider and public DSH host to `0.1.5-rc.2`. Development acceptance and a complete published installation are separate checkpoints. The superproject's version references stay unchanged until GA.

## Development inputs

`config/development-inputs.json` binds the exact committed Execution and UI package bytes. Execution provides endpoint-backed DSH model discovery without default model substitution, in addition to session creation, persistence and restoration. UI remains on the recorded-time Analysis implementation.

`config/development-services.json` binds Evidence `e23eec0702cb5d9deadcbf0e162edd9dfa68c2ad` and Evolution `6e6942811e39d5277b6cba0d00bfafb29ff636b5`. The PR service check builds these sources and Evolution's pinned Contracts dependency, verifies image source labels, then runs initialization, recorded-time Trace/Delivery queries, recorded-time Evaluation through the real services, stop/restart and data-volume preservation. It uses a fresh isolated database, not user data.

## Why the existing service descriptor is insufficient

The published [services rc.3 manifest](https://github.com/firestige/crystra/releases/download/crystra-services-v0.1.0-rc.3/crystra-services-0.1.0.release.json) binds Evidence `84bb3152162dee4d448f4c8227f34a686af008d6` and Evolution `c5aa85ec25781d11df31354b076764fa900754a7`. These precede the current recorded-time query and computation implementations. Substituting that descriptor can start a stack while leaving the current Analysis UI unsupported.

The plugin's `modules/initialization/src/service-descriptor.json` is supplied by release assembly. Its absence in a source checkout is explicit, not repaired by inventing a URL or silently selecting a historical bundle.

## Remaining complete-installation acceptance

1. `qualify:current-host` now covers authenticated rc.2 startup, installed Execution model discovery, Task admission, native Brief/Plan human confirmation, owner control-request receipts, browser reload and host restart with a localhost model protocol fixture. The public plugin directly depends on the exact DSH runtime so Execution can resolve it from the installed profile; the plugin installer does not supply a missing peer. The old `qualify-real-harness` browser flow predates token/cookie authentication and the current New Task controls. Its synthetic service responses do not establish a real service chain. The existing Task admission/projection browser scripts cover narrower interactions.
2. Verify a newly admitted Task through planning, real provider execution, durable Delivery, observed Evidence and Evaluation rendered by the current UI. Native DeepSeek now uses the public rc.2 prompt assembly, tool guard and turn-stopping events. It shares `src/host/task-chat-control.js` with Codex/Copilot for Brief/Plan confirmation, control requests and selected Gate decisions. The deterministic browser check proves native tool writes and a control milestone, not a real Workflow execution or live-model quality. Preserve explicit unavailable/empty states and verify refresh/recovery; a service health check or an empty-database query alone is insufficient.
3. Assemble fresh component/service release candidates from accepted commits and bind their exact published digests in the plugin descriptor. Apply the repository's release discipline before publishing. Verify the packed plugin in a clean rc.2 profile using the published bytes.
4. Promote and update the superproject version references only at the authorized GA checkpoint.

The development service qualifier injects an Execution activation callback; it does not execute a model or prove this complete user flow. Its PASS must not be reported as full deployment readiness.

## Native Task control boundary

Only enrolled/bound Task root conversations receive native control instructions. Workflow Sessions, child agents, ordinary conversations and the external Codex/Copilot adapters keep their existing owners. DSH assembles a first-step prompt before persisting the first user message, so an enrolled draft receives bootstrap instructions and a constrained tool surface; `crystra_read_task_context` admits it after the native loop has persisted that message. No synthetic user message or approval is appended to bypass admission.

`crystra_write_task_document` atomically replaces only `brief.json`, `plan.json` or `control.json` under the owner-provided artifact directory. It cannot write confirmations, repository bindings or product files. The native tool guard denies shell, arbitrary writes, subagents and code transport in Task control conversations; file/search/web reads and validated clarification questions remain available. Task state is inserted through a prompt variable, so user-authored template braces stay literal. Human questions bind decisions to the current Session and exact document digest; cancelled questions do not grant approval. Repeated rejected requests yield one continuation notice instead of an automatic retry loop.

Native model requests must contain only callable tool schemas. External Codex/Copilot display events are projected directly into Session history; they must not be registered through `ctx.tools`, which exposes them to native model APIs. A real Cordis/ToolRuntime regression test checks this separation, and the localhost protocol qualifier rejects tool names outside `^[a-zA-Z0-9_-]+$` before responding.

## Task Browser metadata

Execution remains the owner of Task identity, presentation revision and archive state. The host joins bound Tasks with the current selected Session and the same durable Brief/Plan/Run projection used by the workbench. Discussion errors display as “对话失败”, unconfirmed requirements as “需求澄清”, and confirmation/review readiness as explicit labels; these do not claim Task completion or infer lifecycle activity from a Delivery outcome. The list revision includes the projected metadata so polling updates the Browser and Sidebar. Unbound Tasks retain missing metadata; a failed bound-state read displays “状态读取失败”. Workspace name/path come from the Task binding. Archiving a diagnostic Task uses the normal owner command and preserves its data.

## Native question presentation

The client registers a read-only `ask_user_question` toolview through the public
`tool.call.toolview` slot (priority -10). It projects frozen arguments and results,
including persisted `TOOL_OUTCOME_UNKNOWN` interruptions, without reviving settled
question RPCs. Answers remain Session-owned. Pending questions still use the native
DSH composer; its semantic title/header selectors preserve newlines and reserve
space for scrollable options. These styles and the history view apply to the
Crystra-composed host, including its native Harness surface.

Task instructions put choices in `options` and background in `detail`. On a user's
continuation, the model must read current Task state and recorded answers and issue
a fresh question only for unresolved decisions. This is a model instruction, not
an automatic retry or a guarantee of model compliance; no restart implies consent.
