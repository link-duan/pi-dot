# pi-ui

基于嵌入 [`pi`](https://github.com/earendil-works/pi) Agent SDK 的单会话桌面壳。

## 需要

- [bun](https://bun.sh)
- 已在 `~/.pi/agent` 配好凭据（终端里对 `pi` 做 `/login`，或设置对应 API key 环境变量）

## 开发

```bash
bun install
bun run dev
```

启动后选择一个工作目录。应用在该目录创建 Agent 会话，用来发消息、切模型和展示回复。配置、凭据和会话历史与本机 `pi` 共用 `~/.pi/agent`。
