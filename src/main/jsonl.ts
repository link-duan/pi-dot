/** Serialize one JSONL record. Framing is LF-only. */
export function serializeJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

/**
 * Split a buffer on `\n` only. Returns leftover incomplete data.
 * Trailing `\r` is stripped so `\r\n` input is accepted.
 */
export function consumeJsonl(buffer: string, onLine: (line: string) => void): string {
  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) {
      return buffer;
    }

    let line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }
    if (line.length > 0) {
      onLine(line);
    }
  }
}
