# Agent Instructions (Repository Scope)

These instructions apply to any AI agent working in this repository.

## Mandatory Build Version Rule
- The footer build version shown as `Build vX.Y.Z` must change on every build.
- Source of truth: `src/components/layout/AppVersion.tsx`.
- Build commands must always execute the automatic bump script before compiling.
- This rule is mandatory regardless of active chat session or agent identity.

## Required Build Commands
- `npm run build`
- `npm run build:dev`

Both commands already include the build-version bump step and must not bypass it.
