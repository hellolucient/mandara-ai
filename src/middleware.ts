import { NextResponse, type NextRequest } from "next/server";

/**
 * Passes the request path to server components (the app layout uses it to keep chat-only people in Chat),
 * and, under Mandara's own sign-in, sends signed-out page requests to /login without touching the database.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const local = process.env.AUTH_MODE?.trim() === "local";
  if (local && !path.startsWith("/api/") && path !== "/login" && !request.cookies.get("__Host-mandara_session")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  const forwarded = new Headers(request.headers);
  forwarded.set("x-mandara-path", path);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|apple-icon|apple-touch-icon|manifest|.*\\.(?:png|ico|svg|webmanifest|txt)$).*)"],
};
