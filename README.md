# Pi Dot

基于 [`pi`](https://github.com/earendil-works/pi) Agent SDK 的桌面客户端（Electron）。在本地项目文件夹里和 agent 对话：一个项目可以有多个 Session，正在运行的 Session 切到后台后会继续跑。

Pi Dot 不另起 pi RPC 进程，而是直接嵌入 SDK，扩展以 SDK 的 `rpc` 模式（非 TUI 宿主）绑定。配置、凭据和会话文件与本机的 `pi` 共用 `~/.pi/agent`。

## 功能

- **项目与窗口**：每个窗口绑定一个项目文件夹。多个项目就开多个窗口（`Cmd+Shift+N`），同一个文件夹不会被打开两次。
- **Session**：在标题栏切换（`Ctrl+R`）、重命名和删除 Session，删除的文件会移到废纸篓。正在运行的 Session 切走后会在后台继续跑，结束或需要你处理时会标记出来，并发送系统通知。
- **Composer**：用 `@` 引用文件，用 `/skill:name` 调用 Skill，可以粘贴图片。运行中可以插话（steering），也可以把消息排进后续队列。
- **Transcript**：Markdown、代码、Mermaid 和公式渲染；可以编辑、Fork 或回退到任一条用户消息。
- **Plan Mode**：agent 只读探索代码，然后写一份 Plan File 交给你审阅。可以在全屏视图里选中文字添加行内评论，确认后点 Build 开始实施。
- **上下文与压缩**：上下文用量圆环在运行过程中实时更新，可以手动触发压缩。
- **设置**（`Cmd+,`）：Provider 凭据、模型目录和 agent 行为。项目里的 `.pi/settings.json` 会覆盖这些全局设置。

各个概念的准确定义见 [`CONTEXT.md`](CONTEXT.md)。

## 环境要求

- [bun](https://bun.sh)
- 至少一个 Provider 的凭据：在 Settings 里配置，或者直接沿用本机 `pi` 在 `~/.pi/agent` 里的配置

## 开发

```bash
bun install
bun run dev
```

启动后选择一个工作目录即可开始对话。关闭窗口、切换文件夹或退出应用时，如果还有任务在运行，会先确认一次。

未打包运行时（例如 `bun run dev`），应用会在 `9222` 端口打开 Chrome DevTools Protocol 调试端口，用于检查 UI。访问 `#/playground` 路由可以打开组件演示页。

### 常用脚本

| 命令                           | 作用                                                   |
| ------------------------------ | ------------------------------------------------------ |
| `bun run dev`                  | 启动开发模式                                           |
| `bun run build`                | 构建到 `out/`                                          |
| `bun run test`                 | 运行 Vitest 测试                                       |
| `bun run typecheck`            | 对主进程和渲染进程做类型检查                           |
| `bun run lint` / `bun run fmt` | oxlint 检查 / oxfmt 格式化                             |
| `bun run icons`                | 从 `resources/*.svg` 重新生成图标，需要 `rsvg-convert` |

提交前，lefthook 会对改动的文件运行 lint 和 format。

## 目录结构

```
src/
  main/       Electron 主进程：AgentHost（嵌入 SDK、管理 Live Session）、窗口、IPC、设置
  preload/    向渲染进程暴露 window.pi API
  renderer/   React 界面：Composer、Transcript、Plan 视图、设置页
  shared/     主进程和渲染进程共用的协议、IPC 通道和类型
resources/    应用图标
```

## 数据存放位置

| 内容                     | 位置                              |
| ------------------------ | --------------------------------- |
| 配置、凭据、Session 文件 | `~/.pi/agent`（与本机 `pi` 共用） |
| Plan File                | `~/.pi-dot/plans/`                |
| 项目级设置               | `<项目>/.pi/settings.json`        |
