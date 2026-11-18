import { rejectCrossOrigin } from "@/lib/http";
import { clearedSessionCookie, logout, readSessionToken } from "@/lib/auth-local";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  await logout(readSessionToken(request.headers.get("cookie")));
  return new Response(null, {
    status: 303,
    headers: { location: "/login", "set-cookie": clearedSessionCookie(), "cache-control": "no-store" },
  });
}
