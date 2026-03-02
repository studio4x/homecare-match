# Agent Instructions (Repository Scope)

These instructions apply to any AI agent working in this repository.

## Mandatory Build Version Rule
- The footer build version shown as `Build vX.Y.Z` must change on every local build.
- Source of truth: `src/components/layout/AppVersion.tsx`.
- Build commands must always execute the automatic bump script before compiling.
- In CI/deploy environments (`CI=true`), bump is skipped by default to avoid double increment between local and deploy builds.
- To force CI bump, set `HCM_BUMP_IN_CI=1`.
- This rule is mandatory regardless of active chat session or agent identity.

## Required Build Commands
- `npm run build`
- `npm run build:dev`

Both commands already include the build-version bump step and must not bypass it.
