/** Where to go after sign-in: only a path on this site, never another host. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.includes("\n") || v.includes("\r")) return "/";
  if (v.startsWith("/login") || v.startsWith("/api/")) return "/";
  return v.slice(0, 300);
}
