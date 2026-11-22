import type { Role } from "@/lib/membership";
import { canSeeProspects } from "@/lib/prospects-access";
import { resolveAppAccess, type AppAccess, type AccessSubject } from "@/lib/access";

export type NavItem = { href: string; label: string };

/**
 * The menu for a person.
 * Chat only: Chat.
 * Dashboard + chat: Home and Chat.
 * Full: the role's pages. Prospects and Admin are for administrators only. The pages and APIs refuse everyone else too.
 */
export function navItems(role: Role, chatOnly = false, appAccess?: AppAccess | string): NavItem[] {
  const subject: AccessSubject = { role, chatOnly, appAccess };
  const access = resolveAppAccess(subject);
  if (access === "chat") return [{ href: "/chat", label: "Chat" }];
  if (access === "dashboard") return [
    { href: "/", label: "Home" },
    { href: "/chat", label: "Chat" },
  ];
  const items: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/chat", label: "Chat" },
    { href: "/knowledge", label: "Knowledge" },
    { href: "/sales", label: "Sales" },
    { href: "/agents", label: "Agents" },
    { href: "/memories", label: "Memories" },
  ];
  if (canSeeProspects(role)) items.push({ href: "/prospects", label: "Prospects" });
  if (role === "admin") items.push({ href: "/admin", label: "Admin" });
  return items;
}
