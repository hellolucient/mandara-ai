import { randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function slug(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return base || "location";
}
