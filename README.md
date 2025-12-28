# Portal Kit

一个轻量的 Electron 桌面壳：用「Profile」组织多个 Web 应用，并在它们之间快速切换且尽量保持页面状态。

## 功能概览

- 多 Web 应用切换：每个 Profile 使用独立 `partition`，避免会话串号
- 工作区恢复：记录上次打开的应用与最后访问 URL，重启后尽量恢复
- 导航白名单：仅允许 `allowedOrigins` 内导航（降低被重定向到恶意站点的风险）
- 外链策略：`open-in-popup` / `open-in-system` / `block` / `ask`，适配 OAuth/SSO 弹窗回跳
- 设置抽屉：主题模式 / 系统语言 / 应用管理 / 清理数据
- 快捷键：
  - 切换侧边栏：`Cmd/Ctrl+B`
  - 沉浸模式：`Cmd/Ctrl+Shift+M`
  - 设置：`Cmd/Ctrl+,`

## 开发

### 环境要求

- Node.js 20+

### 安装与启动

```bash
npm install
npm run dev
```

### 测试与代码质量

```bash
npm test
npm run lint
npm run format
```

集成测试（Playwright）：

```bash
npm run test:integration
```

若首次运行提示缺少浏览器依赖，可执行：

```bash
npx playwright install
```

### 构建与打包

```bash
npm run build
npm run pack  # 生成未打包目录产物
npm run dist  # 生成安装包/可分发产物
```

### 应用图标（可选）

- 放置源 PNG：`build/icons/icon.png`（建议 1024x1024）
- 生成各平台图标：`npm run icons`

## 数据与配置

数据目录：`app.getPath('userData')/data`，主要文件：

- `profiles.json`：Profile 列表（Web 应用配置）
- `workspace.json`：工作区（打开的 Profile、活跃项、每个 Profile 的 lastUrl 等）
- `app-config.json`：全局配置（语言等）

对应 Schema/类型：

- `src/shared/schemas/profile.ts`
- `src/shared/schemas/workspace.ts`
- `src/shared/schemas/app-config.ts`
- `src/shared/types.ts`

## Profile 字段速览

常用字段（精简）：

- `name`：显示名称
- `startUrl`：入口 URL
- `allowedOrigins`：允许导航的源（创建/更新时会自动包含 `startUrl` 的 origin）
- `isolation.partition`：会话隔离标识（不同 Profile 不共享 cookie/session）
- `externalLinks.policy`：外链策略（见上）
- `group` / `pinned` / `order`：侧边栏分组与排序

## 安全基线（摘要）

- 渲染进程：`sandbox: true`、`contextIsolation: true`、`nodeIntegration: false`
- 导航策略：不在 `allowedOrigins` 的导航会被拦截，并按外链策略处理

相关实现入口：

- `src/main/security/web-preferences.ts`
- `src/main/policy/navigation-hooks.ts`
- `src/main/policy/external-links.ts`

## 目录结构

```text
src/
  main/        # Electron 主进程（窗口、BrowserView、策略、存储、IPC）
  preload/     # 安全桥接（向 renderer 暴露最小 API）
  renderer/    # React UI（应用壳、设置、应用管理）
  shared/      # 主/渲染共享的 schema & types
tests/         # Vitest 单测
specs/         # 产品需求/合同/设计文档（规划与验收）
docs/          # 项目文档
```

## 文档

- 开源与治理策略：`docs/OPEN_SOURCE.md`
- 需求与合同（示例）：`specs/001-web-app-switching/`

## License

MIT（见 `LICENSE`）。

