import { describe, expect, it } from "vitest";
import {
  asRpcEvent,
  asThinkingLevel,
  isAgentMessage,
  parseThinkingLevels,
  THINKING_LEVEL_LABELS,
} from "./protocol";

describe("asRpcEvent", () => {
  it("accepts known event types", () => {
    expect(asRpcEvent({ type: "agent_start" })).toEqual({ type: "agent_start" });
  });

  it("drops unknown payloads", () => {
    expect(asRpcEvent({ type: "response" })).toBeNull();
    expect(asRpcEvent({ type: "turn_start" })).toBeNull();
    expect(asRpcEvent(null)).toBeNull();
    expect(asRpcEvent("agent_start")).toBeNull();
  });
});

describe("isAgentMessage", () => {
  it("accepts known roles", () => {
    expect(isAgentMessage({ role: "user", content: "hi", timestamp: 1 })).toBe(true);
  });

  it("rejects unknown roles", () => {
    expect(isAgentMessage({ role: "system" })).toBe(false);
    expect(isAgentMessage(null)).toBe(false);
  });
});

describe("thinking levels", () => {
  it("accepts known levels and drops unknown values", () => {
    expect(asThinkingLevel("high")).toBe("high");
    expect(asThinkingLevel("max")).toBe("max");
    expect(asThinkingLevel("turbo")).toBeUndefined();
    expect(asThinkingLevel(null)).toBeUndefined();
  });

  it("keeps only levels the current model actually exposes", () => {
    expect(parseThinkingLevels(["off", "high", "nope", "max"])).toEqual(["off", "high", "max"]);
    expect(parseThinkingLevels([])).toEqual(["off"]);
    expect(parseThinkingLevels(undefined)).toEqual(["off"]);
  });

  it("uses short labels for the trigger", () => {
    expect(THINKING_LEVEL_LABELS.minimal).toBe("Min");
    expect(THINKING_LEVEL_LABELS.medium).toBe("Med");
    expect(THINKING_LEVEL_LABELS.xhigh).toBe("xHigh");
  });
});
