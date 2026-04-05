# AGENTS.md

## Purpose
This repository contains a small Electron desktop app for preparing WAV libraries and DistroKid upload manifests.

## Working Rules
- Keep renderer code split by responsibility. Prefer small modules for DOM lookup, rendering, state, and orchestration.
- Avoid adding new all-in-one controller files or large UI scripts. If a file starts mixing state, rendering, IO, and event wiring, split it.
- Prefer pure functions in `src/shared` and thin orchestration in `src/main` and `src/renderer`.
- Every user-visible bug fix should include or update an automated test when practical.
- Preserve ASCII unless a file already requires non-ASCII text.
- Use explicit error handling for async UI actions so a single exception does not freeze the renderer flow.

## Quality Bar
- Run `npm test` and `npm run lint` before handing off when dependencies are available.
- Keep functions short and names concrete.
- Avoid hidden coupling between DOM structure and controller logic. Optional elements must be treated defensively.
- Do not introduce destructive git operations or revert unrelated user changes.

## Testing Focus
- Prefer regression tests around renderer controller flows and shared library behavior.
- Mock Electron bridge APIs at the boundary instead of coupling tests to a full Electron runtime.
