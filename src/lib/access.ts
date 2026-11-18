import type { Role } from "@/lib/membership";

/**
 * Access levels for Mandara's own sign-in.
 * The stored role names stay admin / manager / staff so existing data and checks keep working;
 * people see them as Admin, Management and Spa.
 *  - admin: everything, including Prospects and Admin.
 *  - manager (Management): full contracts, restricted documents and resort data. No Prospects, no Admin.
 *  - staff (Spa): no contracts and no restricted documents. Later limited to their own spa.
 * chatOnly is a separate switch: the person only gets Chat (and their own chat memories), whatever the role.
 */
export const ROLE_LABELS: Record<Role, string> = { admin: "Admin", manager: "Management", staff: "Spa" };

export function roleLabel(role: Role | string): string {
  return ROLE_LABELS[role as Role] ?? String(role);
}

/** Contracts and commercial partner terms: Admin and Management only, in pages and in chat. */
export function canSeeContracts(role: Role | string): boolean {
  return role === "admin" || role === "manager";
}

export type AccessSubject = { role: Role | string; chatOnly?: boolean };

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

export function pageAllowed(subject: AccessSubject, pathname: string): boolean {
  if (subject.chatOnly && subject.role !== "admin") return chatOnlyPageAllowed(pathname);
  return true;
}

export function apiAllowed(subject: AccessSubject, pathname: string): boolean {
  if (subject.chatOnly && subject.role !== "admin") return chatOnlyApiAllowed(pathname);
  return true;
}
