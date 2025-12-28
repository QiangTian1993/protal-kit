# Quickstart: 多 Web 应用切换与状态保留

This quickstart documents how to validate the planned behavior once the desktop app scaffold exists.

## Smoke Test Checklist (Manual)

### macOS 毛玻璃（vibrancy）

1. 在 macOS 上运行应用，将窗口拖到有明显桌面壁纸纹理的位置。
2. 验证侧边栏/顶部栏背景为半透明，并能呈现系统毛玻璃效果（随壁纸变化而变化）。

### 分组与排序

1. 在“应用管理”中为两个应用设置不同 `分组`。
2. 在“应用管理”中拖拽排序（固定区/未固定区都试一下，可尝试跨分组拖拽）。
3. 点击某个分组标题右侧的“固定分组”，验证该分组下所有应用都被固定到侧边栏。
4. 在已固定分组中点击“取消固定”，验证该分组下所有应用都从侧边栏移除。
5. 在顶部栏使用“分组 Select”选择不同分组，验证侧边栏可快速聚焦显示该分组的固定应用。
6. 验证侧边栏按分组分段显示，且固定应用顺序与“应用管理”一致。
7. 重启应用后，验证分组与顺序仍保持。

### 应用编辑（页内表单）

1. 在“应用管理”列表中点击某个应用的“编辑”。
2. 验证不弹窗，当前视图切换为编辑表单，并且存在“返回”按钮。
3. 点击“返回”回到列表。

### 复制/粘贴快捷键

1. 在“应用管理”中打开一个输入框（例如搜索框），使用 `Cmd+C / Cmd+V` 进行复制/粘贴。
2. 在 Web 应用页面中同样验证 `Cmd+C / Cmd+V`。

### 滚动条样式

1. 在设置页中滚动，验证滚动条为细且半透明的样式，并且 hover 时对比度提升（可见但不抢眼）。
2. 在侧边栏应用列表中滚动，验证滚动条默认隐藏（仍可通过鼠标滚轮/触控板滚动）。

### Add and Open a Web App (US1)

1. Add a profile with:
   - Name: `App A`
   - Start URL: a reachable `https://...`
   - Allowed origins: include the start URL origin
2. Verify it appears in the app library and opens successfully.

### Switch Without Losing State (US2)

1. Open `App A`, navigate away from the start URL, and change a visible on-page state (e.g., type into a form).
2. Add and open `App B`, navigate to a different page.
3. Switch back to `App A`.
4. Verify:
   - The page is not reset to the start URL.
   - The previously visible state (e.g., typed text) remains.

### Session Isolation (FR-006)

1. Add two profiles pointing at the same service (or two different services) and log in with two different
   accounts (one per profile).
2. Switch between profiles.
3. Verify accounts do not “cross-contaminate” (no shared cookies/session).

### Allowed Origins Policy (FR-007)

1. In a profile, click a link that navigates to a different origin not in `allowedOrigins`.
2. Verify the navigation is blocked in-app and handled according to the profile policy (e.g., opened in system browser or in-app popup).

### 首次进入弹窗行为

1. 打开一个 Web 应用，观察是否出现额外弹窗窗口。
2. 验证：允许域名内的 `window.open` 默认不会产生新窗口（应在当前 WebView 内打开）；仅外域在 `open-in-popup` 策略下会打开弹窗。
3. 打开 `https://chat.qwen.ai/` 验证：冷启动时不会被站点自动弹窗打扰（若需要弹窗登录，点击登录后应仍可弹出）。

### 沉浸模式（仅网页内容）

1. 通过菜单 `Portal Kit → 沉浸模式` 或快捷键 `Cmd/Ctrl+Shift+M` 切换沉浸模式。
2. 验证：切换后顶部栏与侧边栏隐藏，仅显示网页内容；再次切换恢复。
3. 点击顶栏右侧的“沉浸模式”按钮也可切换，按钮图标应在“窗口含 UI”和“仅内容”两种状态间切换。

### 系统语言设置

1. 打开设置抽屉，进入“外观”。
2. 在“系统语言”下拉中选择“跟随系统 / 简体中文 / English (US)”。
3. 验证：设置被持久化且会广播 `ui.language.changed` 事件（用于后续 i18n）。

### OAuth 授权回跳（open-in-popup）

1. 将目标 Web 应用的 “外链策略” 设置为 `open-in-popup`。
2. 在 Web 应用内触发一次 OAuth/授权登录（通常会打开登录弹窗）。
3. 完成登录后，验证：
   - 登录弹窗不会卡住在外域页面（best-effort 自动关闭或可手动关闭）。
   - 主 WebView 能回到授权后的页面/登录态生效（例如刷新后仍保持登录）。

### Restore After Restart (US3)

1. Open `App A` and `App B`, end with `App B` active.
2. Quit the desktop app.
3. Reopen it.
4. Verify it restores to `App B` as the active profile and returns to the last known page (best-effort).

## Diagnostics

- When reporting issues, attach:
  - The relevant profile export (WebAppProfile JSON)
  - The workspace snapshot (Workspace JSON)
  - A log export covering: profile load, navigation decisions, switching events

## Developer Notes (Local)

- If Electron binary download is blocked by your environment, reinstall without skipping:
  - `rm -rf node_modules/electron`
  - `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`
- For Playwright integration tests, install browsers once:
  - `npx playwright install`
