# IPC Contracts (Draft): 多 Web 应用切换与状态保留

This document defines the expected request/response shapes for main↔renderer messaging.
It is intentionally implementation-agnostic: it describes channel names and payload shapes.

## Conventions

- All requests include `requestId` for correlation.
- All responses include `requestId` and either `result` or `error`.
- Errors are normalized: `{ code: string, message: string, details?: unknown }`.

## UI / App Shell

### `app.layout.set`

Used by renderer to inform main-process `BrowserView` layout (web apps and settings drawer) when UI chrome changes size.

- Request: `{ requestId: string, sidebarWidth: number, topbarHeight: number, rightInset?: number }`
- Response: `{ requestId: string, result: { applied: true } }`

### `app.settings.open`

Open settings drawer as an overlay view (does not resize the active web app view).

- Request: `{ requestId: string }`
- Response: `{ requestId: string, result: { opened: true } }`

### `app.settings.close`

Close settings drawer.

- Request: `{ requestId: string }`
- Response: `{ requestId: string, result: { closed: true } }`

### Event: `ui.settings.drawer`

Emitted by main process when settings drawer opens/closes or its width changes.

- Payload: `{ opened: boolean, width: number }`

### Event: `profiles.changed`

Emitted by main process after profile mutations so other renderer surfaces (e.g. main window + settings drawer) can refresh without tight coupling.

- Payload (current): `{ type: "created" | "updated" | "deleted" | "imported", profileId?: string }`

## Profiles

### `profiles.list`

- Request: `{ requestId: string }`
- Response: `{ requestId: string, result: { profiles: WebAppProfile[] } }`

### `profiles.create`

- Request: `{ requestId: string, profile: WebAppProfileInput }`
- Response: `{ requestId: string, result: { profile: WebAppProfile } }`

### `profiles.update`

- Request: `{ requestId: string, profileId: string, patch: Partial<WebAppProfileInput> }`
- Response: `{ requestId: string, result: { profile: WebAppProfile } }`

### `profiles.delete`

- Request: `{ requestId: string, profileId: string }`
- Response: `{ requestId: string, result: { deleted: true } }`

## Workspace / Switching

### `workspace.get`

- Request: `{ requestId: string }`
- Response: `{ requestId: string, result: { workspace: Workspace } }`

### `workspace.open`

- Request: `{ requestId: string, profileId: string }`
- Response: `{ requestId: string, result: { activeProfileId: string } }`

### `workspace.switch`

- Request: `{ requestId: string, profileId: string }`
- Response: `{ requestId: string, result: { activeProfileId: string } }`

### `workspace.close`

- Request: `{ requestId: string, profileId: string }`
- Response: `{ requestId: string, result: { closed: true } }`

## Data Management

### `data.clear`

- Request: `{ requestId: string, scope: "profile" | "all", profileId?: string }`
- Response: `{ requestId: string, result: { cleared: true } }`

## Types

- `WebAppProfile`: see `specs/001-web-app-switching/contracts/profile.schema.json`
- `Workspace`: see `specs/001-web-app-switching/contracts/workspace.schema.json`
- `WebAppProfileInput`: same as `WebAppProfile` minus `createdAt`/`updatedAt` (server-generated)
