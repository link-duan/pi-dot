import { describe, expect, it } from "vitest";
import {
  formatRelativeTime,
  sessionTimeGroup,
  sessionTitle,
  thinkingSummary,
  toolLabel,
  toolSummary,
} from "./format";

describe("sessionTitle", () => {
  it("prefers name over first message", () => {
    expect(sessionTitle({ name: "修登录", firstMessage: "帮我看看" })).toBe("修登录");
  });

  it("uses the first line of the first user message", () => {
    expect(sessionTitle({ firstMessage: "帮我看看\n第二行" })).toBe("帮我看看");
  });

  it("falls back to Empty session", () => {
    expect(sessionTitle({})).toBe("Empty session");
    expect(sessionTitle({ name: "  ", firstMessage: "" })).toBe("Empty session");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-01-02T12:00:00.000Z");

  it("describes recent times compactly", () => {
    expect(formatRelativeTime("2026-01-02T11:59:50.000Z", now)).toBe("Just now");
    expect(formatRelativeTime("2026-01-02T11:50:00.000Z", now)).toBe("10m");
    expect(formatRelativeTime("2026-01-02T09:00:00.000Z", now)).toBe("3h");
    expect(formatRelativeTime("2026-01-01T12:00:00.000Z", now)).toBe("1d");
  });
});

describe("toolSummary", () => {
  it("uses the bash command", () => {
    expect(toolSummary("bash", { command: "ls -la" })).toBe("ls -la");
  });

  it("uses grep and find patterns", () => {
    expect(toolSummary("grep", { pattern: "codex-hook|\\.codex" })).toBe("codex-hook|\\.codex");
    expect(toolSummary("find", { pattern: "**/*.ts" })).toBe("**/*.ts");
  });

  it("uses a path relative to cwd for file tools", () => {
    const cwd = "/Users/me/proj";
    const home = "/Users/me";
    expect(toolSummary("edit", { path: "/Users/me/proj/src/a/b.tsx" }, cwd, home)).toBe("src/a/b.tsx");
    expect(toolSummary("write", { path: "src\\app.ts" }, cwd, home)).toBe("src/app.ts");
    expect(toolSummary("ls", { path: "/Users/me/proj/src" }, cwd, home)).toBe("src");
  });

  it("picks the shorter of relative and ~/ absolute when outside cwd", () => {
    const cwd = "/Users/me/Documents/pi-ui";
    const home = "/Users/me";
    expect(toolSummary("read", { path: "/tmp/notes.md" }, cwd, home)).toBe("/tmp/notes.md");
    expect(toolSummary("read", { path: "/Users/me/.zshrc" }, cwd, home)).toBe("~/.zshrc");
    expect(toolSummary("edit", { path: "/tmp/proj/src/a.ts" }, "/tmp/proj/nested", home)).toBe("../src/a.ts");
  });

  it("appends a line range for read", () => {
    const cwd = "/proj";
    expect(toolSummary("read", { path: "/proj/src/x.ts" }, cwd)).toBe("src/x.ts");
    expect(toolSummary("read", { path: "/proj/src/x.ts", offset: 12 }, cwd)).toBe("src/x.ts:12");
    expect(toolSummary("read", { path: "/proj/src/y.ts", offset: 100, limit: 101 }, cwd)).toBe("src/y.ts:100:200");
    expect(toolSummary("read", { path: "/proj/src/y.ts", limit: 200 }, cwd)).toBe("src/y.ts:1:200");
  });

  it("falls back for unknown tools", () => {
    expect(toolSummary("custom", { command: "echo hi" })).toBe("echo hi");
    expect(toolSummary("custom", { path: "/tmp/x" })).toBe("/tmp/x");
    expect(toolSummary("bash", null)).toBe("");
  });
});

describe("thinkingSummary", () => {
  it("collapses whitespace into a single line", () => {
    expect(thinkingSummary("  \nNeed to look at hooks\nmore")).toBe("Need to look at hooks more");
  });
});

describe("toolLabel", () => {
  it("title-cases known tools and keeps unknown names", () => {
    expect(toolLabel("bash")).toBe("Bash");
    expect(toolLabel("custom_tool")).toBe("custom_tool");
  });
});

describe("sessionTimeGroup", () => {
  const now = new Date(2026, 0, 2, 12).getTime();

  it("buckets by calendar day", () => {
    expect(sessionTimeGroup(new Date(2026, 0, 2, 8).toISOString(), now)).toBe("today");
    expect(sessionTimeGroup(new Date(2026, 0, 1, 23).toISOString(), now)).toBe("yesterday");
    expect(sessionTimeGroup(new Date(2025, 11, 28, 12).toISOString(), now)).toBe("week");
    expect(sessionTimeGroup(new Date(2025, 11, 1, 12).toISOString(), now)).toBe("older");
  });
});
