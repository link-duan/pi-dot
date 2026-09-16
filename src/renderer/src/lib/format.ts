export function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((block) => {
        if (block && typeof block === "object" && "text" in block) {
          return String((block as { text: unknown }).text ?? "");
        }
        if (block && typeof block === "object" && "content" in block) {
          return asText((block as { content: unknown }).content);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object" && "content" in value) {
    return asText((value as { content: unknown }).content);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function compactJson(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text.length > 240 ? `${text.slice(0, 237)}…` : text;
  } catch {
    return String(value);
  }
}
