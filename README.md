# pi-ui

基于本机 `pi --mode rpc` 的单会话桌面壳。

## 需要

- [bun](https://bun.sh)
- 已安装并可在终端运行的 [`pi`](https://github.com/badlogic/pi-mono)
- 已在终端完成 `pi` 登录（`/login` 或 API key）

## 开发

```bash
bun install
bun run dev
```

启动后选择一个工作目录。应用会在该目录 spawn `pi --mode rpc`，用来发消息、切模型和展示回复。
