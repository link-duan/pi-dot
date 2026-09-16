import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function lastPathLine(output: string): string | undefined {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("/") || /^[A-Za-z]:[\\/]/.test(line))
    .at(-1);
}

function whichPi(envPath?: string): string | undefined {
  try {
    const out = execFileSync("/bin/sh", ["-c", "command -v pi"], {
      encoding: "utf8",
      timeout: 3000,
      env: envPath ? { ...process.env, PATH: envPath } : process.env,
    });
    return lastPathLine(out);
  } catch {
    return undefined;
  }
}

export function loginShellPath(): string {
  try {
    const shell = process.env.SHELL || "/bin/zsh";
    const out = execFileSync(shell, ["-ilc", 'printf %s "$PATH"'], {
      encoding: "utf8",
      timeout: 8000,
    });
    const pathLine = out
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("/") && line.includes(":"))
      .at(-1);
    return pathLine || process.env.PATH || "";
  } catch {
    return process.env.PATH || "";
  }
}

export function resolvePiPath(envPath?: string): string {
  const path = envPath ?? loginShellPath();
  const candidates = [
    whichPi(path),
    join(homedir(), ".local/bin/pi"),
    "/opt/homebrew/bin/pi",
    "/usr/local/bin/pi",
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Could not find pi. Install @mariozechner/pi-coding-agent and make sure `pi` runs in your terminal.");
}

export function spawnEnv(): NodeJS.ProcessEnv {
  const path = loginShellPath();
  return {
    ...process.env,
    PATH: path || process.env.PATH,
  };
}
