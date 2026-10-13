# Backend rebuild checkpoint evidence

This Git checkpoint includes selected installation, onboarding, recovery and native-runtime results, screenshots, source hashes and external acceptance drivers. The latest source regression run passed 415 tests.

Large raw experiment directories, dependency/profile snapshots, private service configuration and generated tarballs remain local and ignored. They are not required to install runtime dependencies or build the package. No npm version or GitHub Release is published by this checkpoint.

The independent package is reproducible from this branch with `npm ci` followed by `npm pack --ignore-scripts`. Its acceptance hash and exact tested environment are recorded in `new-user-onboarding/manifest.json`; the local tested tarball is retained separately. The external drivers record how the isolated acceptance was conducted and are evidence, not user installation dependencies.

Start with `docs/backend-rebuild/first-run.md` and `docs/backend-rebuild/new-user-onboarding-results.md` for the current scope and known legacy-log boundary. Older reports retain the findings at their original experiment dates; references to unselected raw artifacts are local evidence locations.
