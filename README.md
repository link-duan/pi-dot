# Pi Dot

嵌入 [`pi`](https://github.com/earendil-works/pi) Agent SDK 的桌面壳：一个工作目录里可以开多个 Session，正在跑的可以切到后台继续。多个项目用多个窗口（`Cmd+Shift+N`），同一文件夹不会开两份。

不另起 pi RPC 进程。扩展绑定用 SDK 的 `rpc` 模式（非 TUI 宿主），配置、凭据和会话文件与本机 `pi` 共用 `~/.pi/agent`。

## 需要

- [bun](https://bun.sh)
- 已在 `~/.pi/agent` 配好凭据（终端里对 `pi` 做 `/login`，或设置对应 API key 环境变量）

## 开发

```bash
bun install
bun run dev
```

启动后选择一个工作目录。之后可以发消息、切模型、在 Session 历史里切换。生成中切走不会中断；空 Session 上再点新建没有效果。关窗、换文件夹或退出时如果还有任务在跑，会先确认。
