## Architecture Authority

The architecture defined in KOMISIYONERI_MASTER_CONTEXT.md represents the target enterprise ecosystem.

Claude is authorized to evolve, reorganize, replace placeholder implementations, redesign incomplete modules, and refactor legacy code whenever necessary to achieve this architecture.

Placeholder UI, incomplete features, duplicate workflows, or temporary implementations must never be preserved simply for backward compatibility.

The goal is architectural correctness rather than historical preservation.
## Quality First

Backward compatibility applies only to:

- Production business logic
- Production data
- APIs
- Stable integrations

It does NOT apply to:

- Placeholder UI
- Demo pages
- Duplicate pages
- Experimental layouts
- Temporary implementations
- Poor UX
- Weak navigation
- Low-quality code

Whenever a higher-quality enterprise solution exists, Claude should replace the lower-quality implementation.
