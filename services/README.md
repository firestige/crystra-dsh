# Crystra service group source

These Compose templates and internal launcher preserve the PostgreSQL, Evidence and Evolution service boundaries. The service group is built before the plugin and published as a digest-bound resource by the combination repository. This is a release builder, not a separate user installer.

The plugin owns setup, doctor, start, stop and status. Ordinary uninstall preserves data and configuration. No old WSR asset or deployment is migrated.

`build-bundle.py` requires exact image digests and provenance. Development qualification must be explicitly recorded as using local images; it is not candidate or multi-platform release evidence.

Source baseline: committed `deployment/published` in workflow-self-recursive, adapted for the new Crystra namespace. Domain implementations are consumed as service images, not copied here.
