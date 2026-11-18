import { timingSafeEqual } from "node:crypto";
import dsrMap from "../../config/dsr-map.json";

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
    workspaceOwner: envPresent("WORKSPACE_OWNER_SUB") || process.env.AUTH_MODE?.trim() === "local",
  };
}

export function readMapReady(): boolean {
  // Bundled at build time: Cloudflare Workers have no filesystem to read config/ from.
  return (dsrMap as { ready?: boolean }).ready === true;
}
