import type { Role } from "@/lib/membership";
import { canSeeProspects } from "@/lib/prospects-access";

export type NavItem = { href: string; label: string };

/** The menu for a role. Prospects and Admin are for administrators only. The pages and APIs refuse everyone else too. */
export function navItems(role: Role, chatOnly = false): NavItem[] {
  if (chatOnly && role !== "admin") return [{ href: "/chat", label: "Chat" }];
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
