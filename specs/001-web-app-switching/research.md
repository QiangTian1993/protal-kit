# Research: 多 Web 应用切换与状态保留

## Reference Baseline (Tuboshu)

- **Observed**: Tuboshu describes itself as an Electron-based “website-to-desktop” tool with multi-account
  isolation and fast switching; its `package.json` indicates Electron + electron-vite + electron-builder.
- **Implication**: Electron’s multi-session model is a proven fit for the requirements in this feature.

## Decisions

### Decision: Use Electron as the desktop container runtime

- **Rationale**:
  - Supports **per-profile session isolation** via persisted partitions (cookies, storage, cache).
  - Mature support for navigation control, permission handlers, and safe-by-default web embedding.
  - Aligns with the referenced baseline (Tuboshu), reducing product-risk.
- **Alternatives considered**:
  - **Swift + WKWebView**: strong mac-native UX, but per-profile persistent storage isolation is harder to
    implement without relying on private APIs.
  - **Tauri/Wry**: smaller footprint, but per-profile isolation and advanced web container controls tend to
    require more custom work.

### Decision: Preserve state by keeping each Web app “alive” while hidden

- **Rationale**:
  - In-session state (DOM, JS state, scroll position, SPA router state) is preserved only if the embedded
    web contents are not destroyed.
  - Switching becomes mostly “view swap” rather than reload.
- **Design constraints**:
  - Need a resource strategy for many running apps (e.g., cap active instances, hibernate LRU by destroying
    and restoring last URL with user-visible tradeoff).

### Decision: Enforce allowed-origins navigation policy per profile

- **Rationale**:
  - Prevents a profile from becoming an unrestricted browser.
  - Enables predictable external link behavior and reduces phishing/drive-by risk.
- **Policy outline**:
  - Allow navigation only when `origin ∈ allowedOrigins` (plus the start URL’s origin by default).
  - For disallowed origins: block in-app navigation and route to system browser (or explicit user choice).

### Decision: Store configuration locally as versioned JSON + schema validation

- **Rationale**:
  - Import/export friendly.
  - Enables migrations as schema evolves (constitution: config-driven + versioning).
  - Makes bug reports reproducible (“attach your profile + workspace snapshot”).

### Decision: Instrument switching + policy decisions with structured logs

- **Rationale**:
  - When a specific website misbehaves on a specific Mac, we need evidence: what profile loaded, what
    navigation was blocked, what partition was used, and how switching behaved.

## Open Questions (Resolved by defaults in this plan)

- **Multi-window support**: default to single main window; can be extended later.
- **Cross-restart “state restore”**: restore to last URL + last active app; true DOM state restoration across
  restarts is best-effort and not guaranteed for all websites.
