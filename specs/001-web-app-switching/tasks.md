---

description: "Task list for multi web app switching + state retention"
---

# Tasks: 多 Web 应用切换与状态保留

**Input**: Design documents from `/Users/tianqiang/my-project/portal-kit/specs/001-web-app-switching/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include tests for security/policy-sensitive behavior (allowed origins, isolation, switching) per constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Desktop app**: `src/main/`, `src/preload/`, `src/renderer/`, `tests/` at repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Node/TypeScript workspace and Electron app manifest in `package.json`
- [x] T002 [P] Add TypeScript config in `tsconfig.json` and `tsconfig.node.json`
- [x] T003 [P] Add build/dev scripts and tooling config in `package.json` (dev, build, pack)
- [x] T004 Create base source structure `src/main/`, `src/preload/`, `src/renderer/` and entry files (`src/main/index.ts`, `src/renderer/index.tsx`)
- [x] T005 [P] Add lint/format config in `.eslintrc*` and `.prettierrc*`
- [x] T006 [P] Add test runner config for unit + integration in `vitest.config.ts` and `playwright.config.ts`
- [x] T007 Add docs pointers for this feature in `specs/001-web-app-switching/quickstart.md` (link to future commands/log locations)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Define runtime config types (Profile/Workspace) in `src/shared/types.ts`
- [x] T009 [P] Add schema validation for WebAppProfile in `src/shared/schemas/profile.ts` (based on `specs/001-web-app-switching/contracts/profile.schema.json`)
- [x] T010 [P] Add schema validation for Workspace in `src/shared/schemas/workspace.ts` (based on `specs/001-web-app-switching/contracts/workspace.schema.json`)
- [x] T011 Implement local storage paths + file IO helpers in `src/main/storage/paths.ts` and `src/main/storage/file-store.ts`
- [x] T012 Implement ProfileStore CRUD + import/export in `src/main/storage/profile-store.ts`
- [x] T013 Implement WorkspaceStore load/save in `src/main/storage/workspace-store.ts`
- [x] T014 Implement structured logging wrapper in `src/main/observability/logger.ts`
- [x] T015 Implement navigation policy engine (allowed origins + external link policy) in `src/main/policy/navigation-policy.ts`
- [x] T016 Implement safe Electron defaults (no nodeIntegration, contextIsolation on, sandbox on) in `src/main/security/web-preferences.ts`
- [x] T017 Implement session isolation mapping (`persist:<profileId>`) in `src/main/sessions/partition.ts`
- [x] T018 Implement IPC contract skeleton (channels + requestId + error normalization) in `src/main/ipc/router.ts` and `src/preload/ipc-bridge.ts`
- [x] T019 Implement app window shell and renderer mounting in `src/main/windows/main-window.ts`
- [x] T020 [P] Unit test: Profile schema accepts valid minimal profile and rejects invalid URL/origin in `tests/unit/profile-schema.test.ts`
- [x] T021 [P] Unit test: Workspace schema accepts valid workspace and rejects invalid shape in `tests/unit/workspace-schema.test.ts`
- [x] T022 [P] Unit test: Navigation policy allows allowed origins and blocks others in `tests/unit/navigation-policy.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 添加 Web 应用到应用库 (Priority: P1) 🎯 MVP

**Goal**: Users can create, edit, delete, and open Web app profiles from the app library.

**Independent Test**: Create a profile, see it in the library, open it, edit it, restart the app, and see it persisted.

### Tests for User Story 1 (include when required) ⚠️

- [ ] T023 [P] [US1] Integration test: create/edit/delete profile via UI and verify persistence in `tests/integration/profiles-crud.spec.ts`

### Implementation for User Story 1

- [x] T024 [P] [US1] Implement IPC handlers for `profiles.list/create/update/delete` in `src/main/ipc/handlers/profiles.ts`
- [x] T025 [US1] Wire IPC router to profile handlers in `src/main/ipc/router.ts`
- [x] T026 [P] [US1] Build app library list view in `src/renderer/features/library/LibraryView.tsx`
- [x] T027 [P] [US1] Build create/edit profile form with validation in `src/renderer/features/library/ProfileForm.tsx`
- [x] T028 [US1] Implement renderer-side profiles API wrapper in `src/renderer/lib/ipc/profiles.ts`
- [x] T029 [US1] Add delete confirmation UX in `src/renderer/features/library/DeleteProfileDialog.tsx`
- [x] T030 [US1] Add profile import/export UI entry points in `src/renderer/features/library/ImportExport.tsx`

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - 在多个 Web 应用之间切换并保留状态 (Priority: P2)

**Goal**: Users can switch between multiple running Web apps without losing in-session state.

**Independent Test**: Open two profiles, navigate to different pages, change visible state (typed text), switch back and forth, and verify no reload/state loss.

### Tests for User Story 2 (include when required) ⚠️

- [ ] T031 [P] [US2] Integration test: switching keeps DOM state (typed input) in `tests/integration/switching-state-retention.spec.ts`
- [ ] T032 [P] [US2] Integration test: per-profile session isolation (cookie/account) in `tests/integration/session-isolation.spec.ts`
- [ ] T033 [P] [US2] Integration test: disallowed origin navigation is blocked/redirected in `tests/integration/allowed-origins-policy.spec.ts`

### Implementation for User Story 2

- [x] T034 [US2] Implement WebAppView lifecycle manager (create/keep-alive/hide/show) in `src/main/webapps/webapp-manager.ts`
- [x] T035 [US2] Implement per-profile WebContents/session partition wiring in `src/main/webapps/webapp-factory.ts`
- [x] T036 [US2] Enforce navigation policy hooks (will-navigate/new-window) in `src/main/policy/navigation-hooks.ts`
- [x] T037 [US2] Implement switching IPC (`workspace.open/switch/close`) in `src/main/ipc/handlers/workspace.ts`
- [x] T038 [US2] Add switching UI (tabs/sidebar + active indicator) in `src/renderer/features/switcher/Switcher.tsx`
- [x] T039 [P] [US2] Add renderer-side workspace API wrapper in `src/renderer/lib/ipc/workspace.ts`
- [x] T040 [US2] Add “open in system browser” behavior for external links in `src/main/policy/external-links.ts`
- [x] T041 [US2] Add logs for switch + navigation decisions in `src/main/observability/events.ts`

**Checkpoint**: User Stories 1 AND 2 both work independently

---

## Phase 5: User Story 3 - 记住工作区并在下次启动恢复 (Priority: P3)

**Goal**: On restart, restore the last active profile and its last known page (best-effort).

**Independent Test**: Open two profiles, end with profile B active on a non-start URL, quit app, relaunch, and verify B is active and navigates to last URL.

### Tests for User Story 3 (include when required) ⚠️

- [x] T042 [P] [US3] Unit test: WorkspaceStore persists and reloads workspace snapshot in `tests/unit/workspace-store.test.ts`
- [ ] T043 [P] [US3] Integration test: restores last active profile and last URL on restart in `tests/integration/workspace-restore.spec.ts`

### Implementation for User Story 3

- [x] T044 [US3] Persist workspace updates on open/switch/close in `src/main/storage/workspace-store.ts`
- [x] T045 [US3] Track per-profile lastUrl updates (navigation finish) in `src/main/webapps/webapp-manager.ts`
- [x] T046 [US3] Restore workspace at startup (openProfileIds + activeProfileId) in `src/main/app/startup-restore.ts`
- [ ] T047 [P] [US3] Add “Restore previous session” toggle UI (if desired) in `src/renderer/features/settings/RestoreToggle.tsx`

**Checkpoint**: All user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T048 [P] Add “clear data” UI flow (profile/all) in `src/renderer/features/settings/ClearData.tsx`
- [x] T049 Add main-process implementation for data clearing (sessions + files) in `src/main/data/clear-data.ts`
- [ ] T050 [P] Add profile export/import file picker integration in `src/renderer/lib/files/pickers.ts`
- [ ] T051 Add performance instrumentation for switch latency in `src/main/observability/perf.ts`
- [ ] T052 [P] Add user-facing error surfaces (invalid URL, load failure, blocked navigation) in `src/renderer/components/Toasts.tsx`
- [x] T053 Add “resource strategy” guardrails (cap running apps, LRU) in `src/main/webapps/resource-strategy.ts`
- [x] T054 Update feature docs for troubleshooting + logs in `specs/001-web-app-switching/quickstart.md`
- [x] T055 Add Immersive Mode (menu + shortcut Cmd/Ctrl+Shift+M + topbar button) with layout sync in `src/main/index.ts` and `src/renderer/app/App.tsx`
- [x] T056 Add App Language config storage + IPC (`app.config.get/setLanguage`) in `src/shared/schemas/app-config.ts`, `src/main/storage/app-config-store.ts`, `src/main/ipc/handlers/app.ts`, UI in `src/renderer/app/SettingsApp.tsx`
- [x] T057 Topbar: move group Select to left side, remove border, avoid mac traffic light overlap; Sidebar: add group dividers. Changes in `src/renderer/app/App.tsx`, `src/renderer/styles.css`, `src/renderer/features/switcher/Switcher.tsx`
- [x] T058 Adjust navigation pop-up policy to inline allowed-origin child windows and relax gesture checks for SSO redirects in `src/main/policy/navigation-hooks.ts`
- [x] T059 Packaging: add app icon pipeline and builder config (mac/win/linux) in `package.json`, `scripts/make-icons.sh`, `scripts/generate-icons.mjs`
- [x] T060 Windows: hide native menu bar, merge menu into topbar, enable titleBarOverlay, and fix shortcuts when BrowserView is focused (`src/main/windows/main-window.ts`, `src/main/policy/keyboard-shortcuts.ts`, `src/main/ipc/handlers/app.ts`, `src/renderer/app/App.tsx`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on User Story 1 (needs profiles), plus Foundational
- **User Story 3 (Phase 5)**: Depends on User Story 2 (needs switching runtime state), plus Foundational
- **Polish (Phase 6)**: Depends on desired stories being complete

### Parallel Opportunities

- T002, T003, T005, T006 can proceed in parallel after T001
- T009, T010, T020, T021, T022 are parallel once shared types (T008) exist
- Renderer UI tasks in each story phase are parallelizable with main-process handler work

---

## Parallel Example: User Story 2

```text
T031 [P] [US2] Integration test: switching keeps DOM state (typed input) in tests/integration/switching-state-retention.spec.ts
T034 [US2] Implement WebAppView lifecycle manager (create/keep-alive/hide/show) in src/main/webapps/webapp-manager.ts
T038 [US2] Add switching UI (tabs/sidebar + active indicator) in src/renderer/features/switcher/Switcher.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 + Phase 2
2. Complete Phase 3 (US1)
3. Validate via US1 independent test + `specs/001-web-app-switching/quickstart.md`

### Incremental Delivery

1. Add US2 (switch + state retention + isolation policies) and validate with integration tests
2. Add US3 (workspace restore) and validate with restart test
3. Polish for stability, diagnostics, and resource constraints
