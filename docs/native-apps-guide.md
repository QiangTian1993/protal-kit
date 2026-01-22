# 原生应用集成使用指南

Portal Kit 支持将「原生应用」加入应用库，并与 Web 应用一起在侧边栏、命令面板中统一切换喵～

## 入口位置

1. 打开主窗口侧边栏右下角「设置」按钮（或快捷键 `Cmd/Ctrl+,`）
2. 在设置页左侧选择「应用」
3. 点击右上角「添加」
4. 将「应用类型」切换为「原生应用」

## 如何添加原生应用

在「原生应用」表单中，至少需要填写一种启动方式（`path` / `bundleId` / `appName` / `desktopEntry` 之一）：

- **名称**：用于列表展示与搜索
- **启动配置**（至少填一项）
  - **可执行路径（推荐）**：Windows/macOS/Linux 都可用
  - **Bundle ID（macOS，可选）**：例如 `com.apple.Terminal`
  - **应用名称（Windows，可选）**：例如 `Visual Studio Code`
  - **Desktop Entry（Linux，可选）**：例如 `code.desktop` 或 `org.gnome.Terminal`
- **启动参数（可选）**：每行一个参数（会按行拆分）
- **工作目录（可选）**：作为启动时的 `cwd`

保存后，应用会出现在列表中。

## 启动与切换

Portal Kit 目前支持三种入口切换到原生应用：

- **设置 → 应用（库）**：在列表中点击「打开 / 置前」
- **侧边栏 Switcher**：点击应用图标切换
- **命令面板**：搜索应用名称并回车切换（原生应用会显示可执行信息）

## 常见问题（FAQ）

### 1) 点击「打开」没反应 / 启动失败

优先检查：

- 是否配置了至少一种启动方式
- `path` 是否可访问（路径存在、权限允许）
- macOS 上通过 `open` / `osascript` 置前时，是否需要授予「辅助功能/自动化」权限

### 2) 启动参数怎么写？

每行一个参数即可，例如：

```text
--profile-directory=Default
--disable-gpu
```

Portal Kit 会将每一行作为一个独立参数传给启动器（不会拼成一整段命令），以避免命令注入风险。

### 3) 为什么有时看不到 PID / 状态显示不准确？

部分平台的“间接启动方式”（例如 macOS 使用 `open`、Linux 使用 `xdg-open`）可能无法可靠获取真实应用 PID，状态展示会受限于平台能力。

## 截图（可选）

可将截图放在 `docs/images/` 下并在此处引用，例如：

```md
![设置-应用-原生应用表单](./images/native-app-form.png)
![库列表-原生应用运行状态](./images/native-app-status.png)
```

