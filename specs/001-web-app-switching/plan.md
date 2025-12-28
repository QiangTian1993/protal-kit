# Implementation Plan: 多 Web 应用切换与状态保留

**Branch**: `001-web-app-switching` | **Date**: 2025-12-21 | **Spec**: `/Users/tianqiang/my-project/portal-kit/specs/001-web-app-switching/spec.md`
**Input**: Feature specification from `/Users/tianqiang/my-project/portal-kit/specs/001-web-app-switching/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command (if present in your tooling).

## Summary

Deliver a macOS desktop container that can add multiple Web apps, switch between them instantly,
and preserve each app’s in-session state (navigation, login/session, and page state) across
switches, with per-app isolation and explicit navigation boundaries.

Technical approach: build on Electron so each Web app runs in its own isolated session partition
(`persist:<profileId>`) and is kept alive while hidden to preserve state; store profiles/workspace
as versioned local JSON with schema validation; enforce allowed-origins navigation policy and safe
defaults (no Node in renderer, sandboxed web contents).

## Technical Context

**Language/Version**: TypeScript (Node.js 20+, Electron 36+)  
**Primary Dependencies**: Electron, electron-vite (or equivalent build tooling), schema validation (e.g., Zod), local config storage (JSON file)  
**Storage**: Local files in macOS Application Support; versioned JSON for profiles/workspace; Electron persisted sessions (`persist:<profileId>`)  
**Testing**: Unit tests for config/schema; integration/e2e tests for switching + session isolation (Playwright recommended)  
**Target Platform**: macOS (initially); design keeps cross-platform possible  
**Project Type**: Single desktop app (main + renderer)  
**Performance Goals**: 90% of app switches become interactive in ≤ 1s with 3 running apps (from spec SC-002)  
**Constraints**: Safe-by-default web container; no cross-app data leakage; offline/failed-load must degrade gracefully  
**Scale/Scope**: Personal productivity tool; dozens of profiles; 3–10 concurrent running apps typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `/Users/tianqiang/my-project/portal-kit/.specify/memory/constitution.md`:

- **PASS**: Security-first defaults: sandboxed web contents, no Node APIs exposed to untrusted web.
- **PASS**: Navigation boundary control: enforce per-profile allowed origins; explicit handling for external links.
- **PASS**: Data isolation: per-profile storage isolation via separate persisted session partitions.
- **PASS**: Config-driven profiles: all app behaviors are expressed in versioned `WebAppProfile` data.
- **PASS**: Observability/testability: structured logs for profile load, navigation decisions, switching; automated tests for high-risk policy paths.
- **PASS**: Distribution/update readiness: SemVer policy + reproducible build plan recorded (implementation later).

Post-design re-check (after Phase 1 outputs):

- **PASS**: Data model + contracts encode isolation + allowed-origins policies.
- **PASS**: Quickstart includes manual verification steps for the security/switching gates.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
src/
├── main/                # Electron main process (windows, sessions, storage, policies)
├── preload/             # Minimal, audited bridge APIs (optional)
└── renderer/            # UI: app library, switching UI, settings

tests/
├── unit/                # schema + policy unit tests
└── integration/         # switching + isolation tests
```

**Structure Decision**: Single desktop app with `main`/`renderer` split to enforce security boundaries.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
