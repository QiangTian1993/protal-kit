# Data Model: 多 Web 应用切换与状态保留

This document defines the persistent entities used by Portal Kit to manage multiple Web apps, switching,
isolation, and workspace restore. All persisted data is local-only.

## Versioning

- **Schema version**: `1`
- Any backward-incompatible change MUST bump schema version and provide a migration strategy.

## Entities

### WebAppProfile

Represents one “desktopized” Web application.

**Fields**

- `id` (string, required): stable identifier (UUID recommended).
- `name` (string, required): user-visible app name.
- `startUrl` (string, required): initial URL opened when the profile is launched.
- `allowedOrigins` (string[], required): list of allowed origins (e.g., `https://example.com`).
  - Default rule: include `origin(startUrl)` if not explicitly present.
- `icon` (object, optional):
  - `type` (string): `builtin` | `file`
  - `value` (string): builtin key or local file path
- `window` (object, optional):
  - `defaultWidth` (number)
  - `defaultHeight` (number)
- `isolation` (object, required):
  - `partition` (string, required): persisted session partition name, e.g. `persist:<id>`
- `externalLinks` (object, required):
  - `policy` (string, required): `open-in-system` | `block` | `ask`
- `createdAt` (string, required): ISO date-time.
- `updatedAt` (string, required): ISO date-time.

**Validation rules**

- `startUrl` MUST be a valid absolute URL with `http` or `https` scheme.
- Each `allowedOrigins[i]` MUST be a valid origin (`scheme://host[:port]`) and MUST NOT include path/query.
- `partition` MUST be unique per profile.

### Workspace

Represents the last-known “working set” of profiles and the current focus.

**Fields**

- `schemaVersion` (number, required): `1`.
- `activeProfileId` (string, optional): currently selected profile.
- `openProfileIds` (string[], required): profiles intended to be open (ordered by recency).
- `perProfileState` (object, required): map `profileId -> WebAppRuntimeState`.
- `windowBounds` (object, optional):
  - `x`, `y`, `width`, `height` (numbers)
- `updatedAt` (string, required): ISO date-time.

### WebAppRuntimeState

Captures the minimum state required for best-effort restore across restarts.

**Fields**

- `lastUrl` (string, optional): last visible URL when the profile lost focus or app exited.
- `lastActivatedAt` (string, optional): ISO date-time.
- `notes` (string, optional): diagnostic notes for troubleshooting (user-facing optional).

**Notes**

- In-session state (DOM, SPA memory) is preserved during switching only when the web contents remain alive.
- Across restarts, restore is best-effort: re-open `lastUrl` and rely on website’s own persistence.
