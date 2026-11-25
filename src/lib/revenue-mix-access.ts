import type { Role } from "@/lib/membership";
import { canManage } from "@/lib/members";

/** Revenue mix dashboards: spa directors and administrators (Management+). */
export function canSeeRevenueMix(role: Role | string): boolean {
  return canManage(role as Role);
}