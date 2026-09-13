# CRYSTRA

`dsh-crystra-execution` is the DeepSeek Harness bundle displayed as **CRYSTRA**. It
owns only DSH-specific Intake, Host gateway, Delivery resource, Session view,
Action disclosure, and final-message presentation.

Delivery state comes from the read-only `DeliveryControlPlaneReadModel` exported
by `crystra-execution`; the browser reaches it only through the loopback Host RPC
channel. Sidebar reads never execute `/crystra list`. Execution domain behavior,
recovery, mutation, and Provider authority remain in `crystra-execution`.

The required Cordis configuration is:

```yaml
configFile: /absolute/path/to/execution-config.yaml
bindingFile: /absolute/path/to/dsh-intake-bindings.json
```

The package is locked to DSH `0.1.1-rc.2`. Its Workspace UI composition fork
and exact MIT provenance are documented under
`src/client/delivery-inventory/UPSTREAM.md`.

The compatible `crystra-execution@^0.2.0` peer comes from the immutable GitHub
`0.2.7` release asset recorded in `package.json`, not ambient npm resolution. Install that
asset as an explicit DSH profile root alongside this adapter; its required
SHA-256 is `bb3718360946d114251def2f1a975ee783974c2c0d959dbb4289e8955f4b5acc`.
