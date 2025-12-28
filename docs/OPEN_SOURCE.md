# 开源策略（Open Source Strategy）

本文件描述 `portal-kit` 的开源治理、版本与发布、贡献流程、安全与合规等策略，指导后续对外协作与长期维护。

## 目标与原则

- 透明与可复用：默认公开设计、实现与问题讨论，便于他人复用。
- 安全为先：主进程/渲染安全基线不妥协（sandbox、contextIsolation、no nodeIntegration、导航白名单）。
- 兼容易用：Node 20+、Electron 36+、TypeScript 严格模式、React 18+。
- 贡献者友好：清晰的贡献指南、明确的评审与合并节奏。

## 许可证（License）

建议使用 MIT（宽松、生态通用）。若需更强的商标/品牌限制，可以：

- 代码采用 MIT；
- 品牌与图标单独声明使用许可与限制（见“品牌与商标”）。

本仓库代码采用 MIT 许可证，详见根目录 `LICENSE`，并已在 `package.json` 标注 `license` 字段。

## 品牌与商标（Branding）

- 应用图标与名称归其各自所有者所有。若使用自定义图标，请确保你拥有授权；
- 打包时已配置：
  - macOS: `build/icons/icon.icns`
  - Windows: `build/icons/icon.ico`
  - Linux: `build/icons/icon.png`
  - 生成脚本：`npm run icons`（见 `scripts/make-icons.sh`）

## 治理模型（Governance）

- 维护者模型（Maintainer Model）：由一小组维护者负责路线图、合并与发布；
- 评审原则：
  - 至少 1 名维护者 Code Review 才可合并；
  - 安全/策略相关改动（主进程安全、导航策略）需 2 名维护者确认；
- 冲突处理：遵循技术理由优先、以规范与测试为准。

## 版本与分支（Versioning & Branching）

- 版本：SemVer（MAJOR.MINOR.PATCH）。
  - BREAKING：主进程/IPC 合同、存储 Schema 变更需 MAJOR；
  - 新功能：MINOR；修复：PATCH。
- 分支：
  - `main`：稳定分支；
  - `feat/*`：功能分支；
  - `fix/*`：修复分支；
  - `docs/*`：文档类；
  - `release/*`（可选）：准备发版的冻结分支。

## 发布流程（Releasing）

1. 更新版本号与变更日志（遵循 Conventional Commits 生成/手写均可）；
2. 构建与打包：`npm run dist`（会先运行 `npm run build` 与图标生成）；
3. 产物：`dist/` 目录（mac 应用、Win 安装包、Linux 包等）；
4. 创建 Git Tag 与 Release，附带 Release Notes；
5.（可选）CI 自动发布。

## 贡献流程（Contributing）

详见 `CONTRIBUTING.md`。要点：

- 提交规范：Conventional Commits（例如 `feat: 添加沉浸模式`、`fix(main): 放宽 SSO 跳转拦截`）；
- DCO（开发者来源声明）：推荐使用 Signed-off-by（`git commit -s`）；
- 代码风格：TypeScript 严格模式，React 函数组件 + Hooks；遵循 `AGENTS.md` 中的规则；
- 测试：修改 Schema/策略/存储需附单测或解释原因；
- Lint/Format：`npm run lint && npm run format`；
- 本地验证：`npm test` 与 `npm run pack`。

## 安全策略（Security）

- 私下披露：详见 `SECURITY.md`；若托管在 GitHub，请使用 Security Advisories；
- SLA：收到报告后 2 个工作日内初步响应，严重问题优先；
- 默认不接受通过公开 Issue 披露漏洞的方式（避免 0day 风险）。

## 依赖与更新（Dependencies）

- 定期升级 Electron/Vite/TypeScript 的次要版本，安全告警优先处理；
- 不接受引入 Node 集成到渲染进程的改动；
- 第三方依赖需具备兼容的许可证（MIT/BSD/Apache-2.0 等）。

## 变更日志（Changelog）

- 以 Release Notes 或 `CHANGELOG.md` 形式发布；
- 建议使用 Conventional Commits 自动生成工具（如 `conventional-changelog`）。

## 路线图（Roadmap，摘要）

- 国际化（i18n）接入与运行时切换；
- 沉浸模式持久化到 Workspace；
- OAuth/SSO 体验继续打磨（回流/弹窗策略更多站点适配）；
- 插件/脚本化（受限沙箱内能力暴露）。

---

若需将本仓库正式公开：

1) 增加 `LICENSE` 文件；2) 填充 `CODE_OF_CONDUCT.md` 联系方式；3) 开启 Issue/PR 模板与 CI；4) 在 README 中链接本策略文档。
