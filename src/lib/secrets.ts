import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

export function envPresent(name: string): boolean {
  return Boolean(readEnv(name));
}

export function workspaceOwnerSub(): string {
  return readEnv("WORKSPACE_OWNER_SUB");
}

function readEnv(name: string): string {
  const inlined = process.env[name];
  return typeof inlined === "string" ? inlined.trim() : "";
}

export function cronAuthorized(provided: string): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(secret);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function integrationStatus() {
  return {
    openRouter: envPresent("OPENROUTER_API_KEY"),
    cron: envPresent("CRON_SECRET"),
    dsrUrl: envPresent("DSR_BASE_URL"),
    dsrUsername: envPresent("DSR_USERNAME"),
    dsrPassword: envPresent("DSR_PASSWORD"),
    dsrMapReady: readMapReady(),
    workspaceOwner: envPresent("WORKSPACE_OWNER_SUB"),
  };
}

export function readMapReady(): boolean {
  try {
    const raw = readFileSync("config/dsr-map.json", "utf8");
    const parsed = JSON.parse(raw) as { ready?: boolean };
    return parsed.ready === true;
  } catch {
    return false;
  }
}
