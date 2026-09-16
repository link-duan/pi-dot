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

export function sessionTitle(item: { name?: string; firstMessage?: string }): string {
  const name = item.name?.trim();
  if (name) return name;
  const first = item.firstMessage?.trim();
  if (first) return first.split("\n")[0] ?? first;
  return "空会话";
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h`;
  return `${Math.floor(hour / 24)}d`;
}

export const TIME_GROUP_LABELS = {
  today: "今天",
  yesterday: "昨天",
  week: "最近 7 天",
  older: "更早",
} as const;

export type TimeGroup = keyof typeof TIME_GROUP_LABELS;

export function sessionTimeGroup(iso: string, now = Date.now()): TimeGroup {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "older";
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const start = startOfToday.getTime();
  if (then >= start) return "today";
  if (then >= start - 86_400_000) return "yesterday";
  if (then >= start - 7 * 86_400_000) return "week";
  return "older";
}

export function groupByTime<T extends { modified: string }>(
  items: T[],
  now = Date.now(),
): Array<{ group: TimeGroup; items: T[] }> {
  const buckets: Record<TimeGroup, T[]> = { today: [], yesterday: [], week: [], older: [] };
  for (const item of items) {
    buckets[sessionTimeGroup(item.modified, now)].push(item);
  }
  return (Object.keys(TIME_GROUP_LABELS) as TimeGroup[])
    .filter((group) => buckets[group].length > 0)
    .map((group) => ({ group, items: buckets[group] }));
}
