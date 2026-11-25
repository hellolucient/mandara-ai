import type { Role } from "@/lib/membership";

/**
 * Access levels for Mandara's own sign-in.
 * The stored role names stay admin / manager / staff so existing data and checks keep working;
 * people see them as Admin, Management and Spa.
 *  - admin: everything, including Prospects and Admin.
 *  - manager (Management): full contracts, restricted documents and resort data. No Prospects, no Admin.
 *  - staff (Spa): no contracts and no restricted documents. Later limited to their own spa.
 * appAccess is a separate switch for which pages they can open:
 *  - full: all pages that role already had.
 *  - dashboard: Home and Chat only (Performance, Ask Mandara AI, By spa; no Quick access or Prospects).
 *  - chat: Chat only (and their own chat memories), whatever the role.
 * Admin always keeps the full app, even if appAccess or chatOnly says otherwise.
 * chatOnly is kept in sync with appAccess === "chat" so existing rows and checks keep working.
 */
export const ROLE_LABELS: Record<Role, string> = { admin: "Admin", manager: "Management", staff: "Spa" };

export type AppAccess = "full" | "dashboard" | "chat";

export const APP_ACCESS_VALUES: AppAccess[] = ["full", "dashboard", "chat"];

export const APP_ACCESS_LABELS: Record<AppAccess, string> = {
  full: "All pages for their role",
  dashboard: "Dashboard + chat",
  chat: "Chat only",
};

export function roleLabel(role: Role | string): string {
  return ROLE_LABELS[role as Role] ?? String(role);
}

export function isAppAccess(value: unknown): value is AppAccess {
  return value === "full" || value === "dashboard" || value === "chat";
}

/** Prefer a stored appAccess value; otherwise treat chatOnly as Chat only and everything else as full. */
export function appAccessFromFlags(input: { appAccess?: unknown; chatOnly?: boolean }): AppAccess {
  if (isAppAccess(input.appAccess)) return input.appAccess;
  return input.chatOnly ? "chat" : "full";
}

/** Contracts and commercial partner terms: Admin and Management only, in pages and in chat. */
export function canSeeContracts(role: Role | string): boolean {
  return role === "admin" || role === "manager";
}

export type AccessSubject = { role: Role | string; chatOnly?: boolean; appAccess?: AppAccess | string };

export function resolveAppAccess(subject: AccessSubject): AppAccess {
  if (subject.role === "admin") return "full";
  return appAccessFromFlags(subject);
}

/** Pages a chat-only person may open. Everything else sends them to /chat. */
export function chatOnlyPageAllowed(pathname: string): boolean {
  return pathname === "/chat" || pathname.startsWith("/chat/") || pathname === "/account" || pathname.startsWith("/account/");
}

/** APIs a chat-only person may call. Everything else is refused with 403. */
export function chatOnlyApiAllowed(pathname: string): boolean {
  return (
    pathname === "/api/chat" ||
    pathname.startsWith("/api/chat/") ||
    pathname.startsWith("/api/conversations") ||
    pathname === "/api/memories" ||
    pathname.startsWith("/api/auth/")
  );
}

/** Management and full-app users see Promotions; spa staff on dashboard-only do not. */
export function canSeePromotions(subject: AccessSubject): boolean {
  if (subject.role === "admin" || subject.role === "manager") return true;
  return resolveAppAccess(subject) === "full";
}

/** Pages a Dashboard + chat person may open. */
export function dashboardPageAllowed(pathname: string, subject?: AccessSubject): boolean {
  if (pathname === "/promotions" || pathname.startsWith("/promotions/")) {
    return subject ? canSeePromotions(subject) : false;
  }
  return pathname === "/" || chatOnlyPageAllowed(pathname);
}

/** APIs a Dashboard + chat person may call, including the sales ticker on Chat. */
export function dashboardApiAllowed(pathname: string): boolean {
  return (
    chatOnlyApiAllowed(pathname) ||
    pathname === "/api/sales-ticker" ||
    pathname.startsWith("/api/sales-ticker/") ||
    pathname === "/api/sales/items" ||
    pathname.startsWith("/api/sales/items/") ||
    pathname === "/api/version"
  );
}

export function pageAllowed(subject: AccessSubject, pathname: string): boolean {
  const access = resolveAppAccess(subject);
  if (access === "chat") return chatOnlyPageAllowed(pathname);
  if (access === "dashboard") return dashboardPageAllowed(pathname, subject);
  return true;
}

export function apiAllowed(subject: AccessSubject, pathname: string): boolean {
  const access = resolveAppAccess(subject);
  if (access === "chat") return chatOnlyApiAllowed(pathname);
  if (access === "dashboard") return dashboardApiAllowed(pathname);
  return true;
}

/**
 * True when the person gets the full-screen chat-only experience (no dashboard, no admin navigation).
 * Admin always keeps the dashboard, even if the chat-only switch is on.
 */
export function usesChatOnlyView(subject: AccessSubject): boolean {
  return resolveAppAccess(subject) === "chat";
}

/** True when the person gets Home and Chat, without Knowledge, Sales, Prospects or Admin. */
export function usesDashboardAccess(subject: AccessSubject): boolean {
  return resolveAppAccess(subject) === "dashboard";
}

/** Quick access tiles (Outlook, Teams, and so on) are for the full app, not Dashboard + chat. */
export function canSeeQuickAccess(subject: AccessSubject): boolean {
  return resolveAppAccess(subject) === "full";
}

export function accessDeniedMessage(subject: AccessSubject): string {
  return resolveAppAccess(subject) === "dashboard"
    ? "Your access is limited to the Home dashboard and Chat."
    : "Your access is limited to Chat.";
}
