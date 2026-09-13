# Crystra plugin boundaries

The root `dsh-crystra` package is the only public plugin. The target release and registration authority is `firestige/crystra-dsh`.

- `modules/execution` owns the DSH Execution adapter, Host integration and Delivery presentation.
- `modules/studio` owns the Studio Host gateway and client composition.
- Root Host/client entries compose both modules and preserve their Cordis lifecycle.

Execution, Delivery, Manifest, Runner, Evaluation, Evidence, Evolution, Workflow Package and shared Contracts remain in their component repositories. Ordinary component dependencies are allowed. Source-relative imports across repositories, copied domain implementations and reverse dependencies on a DSH plugin fail boundary checks.

The development input manifest binds exact component commits and archive digests until published new assets exist. Release candidates require immutable GitHub asset coordinates. Neither old release artifacts nor the combination repository's working tree are development inputs.

The fixed-version composition fork of `@deepseek-ai/dsh-client-ui-workspace@0.1.1-rc.2` owns the Workspace sidebar slot and renders the upstream Workspace component beside Delivery. It does not reparent DOM. The single root bundle ships exact upstream attribution and hashes. React and ReactDOM resolve from the DSH host.
