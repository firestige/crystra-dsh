# Crystra Execution host module

This internal module belongs to the single `dsh-crystra` plugin. It adapts Intake, Host RPC, Delivery projections, action disclosure and final-message presentation. It is not installed or registered separately.

Delivery state comes from the read-only control-plane exported by `crystra-execution`; domain behavior, recovery and Provider authority remain there. Native DSH Workspace navigation is owned by DSH. This module does not add a Delivery accordion or replace the Workspace UI.

Configuration is supplied through the root plugin. Exact Execution dependencies and DSH compatibility are recorded in the root package and release manifest; there is no separate module installation step.
