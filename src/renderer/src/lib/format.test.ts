import { describe, expect, it } from "vitest";
import { formatRelativeTime, sessionTimeGroup, sessionTitle } from "./format";

describe("sessionTitle", () => {
  it("prefers name over first message", () => {
    expect(sessionTitle({ name: "修登录", firstMessage: "帮我看看" })).toBe("修登录");
  });

  it("uses the first line of the first user message", () => {
    expect(sessionTitle({ firstMessage: "帮我看看\n第二行" })).toBe("帮我看看");
  });

  it("falls back to 空会话", () => {
    expect(sessionTitle({})).toBe("空会话");
    expect(sessionTitle({ name: "  ", firstMessage: "" })).toBe("空会话");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-01-02T12:00:00.000Z");

  it("describes recent times compactly", () => {
    expect(formatRelativeTime("2026-01-02T11:59:50.000Z", now)).toBe("刚刚");
    expect(formatRelativeTime("2026-01-02T11:50:00.000Z", now)).toBe("10m");
    expect(formatRelativeTime("2026-01-02T09:00:00.000Z", now)).toBe("3h");
    expect(formatRelativeTime("2026-01-01T12:00:00.000Z", now)).toBe("1d");
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
