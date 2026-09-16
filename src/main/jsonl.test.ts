import { describe, expect, it } from "vitest";
import { consumeJsonl, serializeJsonLine } from "./jsonl";

describe("consumeJsonl", () => {
  it("splits only on LF and keeps leftover", () => {
    const lines: string[] = [];
    const leftover = consumeJsonl('{"a":1}\n{"b":2}\n{"c":', (line) => lines.push(line));
    expect(lines).toEqual(['{"a":1}', '{"b":2}']);
    expect(leftover).toBe('{"c":');
  });

  it("accepts CRLF and does not split on U+2028", () => {
    const lines: string[] = [];
    const payload = JSON.stringify({ text: "hello\u2028world" });
    const leftover = consumeJsonl(`${payload}\r\n`, (line) => lines.push(line));
    expect(lines).toEqual([payload]);
    expect(JSON.parse(lines[0]!).text).toBe("hello\u2028world");
    expect(leftover).toBe("");
  });

  it("serializeJsonLine uses a trailing LF", () => {
    expect(serializeJsonLine({ type: "abort" })).toBe('{"type":"abort"}\n');
  });
});
