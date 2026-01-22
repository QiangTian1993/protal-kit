# Changelog

## 0.1.0 (2026-01-20)

### 新增

- 原生应用集成：支持将原生应用加入库，并与 Web 应用统一切换（侧边栏 / 命令面板）
- NativeAppProfile 类型与 Zod Schema：`AppProfile` 联合类型 + `z.discriminatedUnion`
- 主进程原生启动器：macOS / Windows / Linux 启动与置前能力
- 统一应用管理器：Web/原生统一 open/switch/close 入口
- 测试：补齐单元测试、UI 单测（RTL）与 Playwright E2E

