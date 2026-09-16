import { displayPath } from "./path";

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

export function prettyJson(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

const TOOL_LABELS: Record<string, string> = {
  bash: "Bash",
  grep: "Grep",
  edit: "Edit",
  read: "Read",
  write: "Write",
  find: "Find",
  ls: "Ls",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name.toLowerCase()] ?? name;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pathField(record: Record<string, unknown>, cwd?: string | null, home?: string | null): string {
  const path = stringField(record, "path", "TargetFile", "AbsolutePath");
  return path ? displayPath(path, cwd, home) : "";
}

function readRangeSuffix(record: Record<string, unknown>): string {
  const offset = numberField(record, "offset");
  const limit = numberField(record, "limit");
  if (offset == null && limit == null) return "";
  const start = offset ?? 1;
  if (limit == null) return `:${start}`;
  const end = start + limit - 1;
  return end === start ? `:${start}` : `:${start}:${end}`;
}

export function toolSummary(name: string, args: unknown, cwd?: string | null, home?: string | null): string {
  const record = asRecord(args);
  if (!record) return "";

  const lower = name.toLowerCase();
  if (lower === "bash" || lower.includes("command") || lower.includes("exec") || lower.includes("shell")) {
    return stringField(record, "command", "CommandLine");
  }
  if (lower === "grep" || lower === "find") {
    return stringField(record, "pattern", "Query", "query");
  }
  if (lower === "read") {
    const path = pathField(record, cwd, home);
    return path ? `${path}${readRangeSuffix(record)}` : "";
  }
  if (lower === "write" || lower === "edit" || lower === "ls") {
    return pathField(record, cwd, home);
  }

  const command = stringField(record, "command", "CommandLine");
  if (command) return command;
  const path = pathField(record, cwd, home);
  if (path) return path;
  return stringField(record, "pattern", "Query", "query");
}

export function thinkingSummary(thinking: string): string {
  return thinking.replace(/\s+/g, " ").trim();
}

export function sessionTitle(item: { name?: string; firstMessage?: string }): string {
  const name = item.name?.trim();
  if (name) return name;
  const first = item.firstMessage?.trim();
  if (first) return first.split("\n")[0] ?? first;
  return "Empty session";
}

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h`;
  return `${Math.floor(hour / 24)}d`;
}

export const TIME_GROUP_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days",
  older: "Older",
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
