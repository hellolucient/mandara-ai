import type { Role } from "@/lib/membership";

/**
 * Prospects are for administrators only. Managers and staff get nothing:
 * no menu item, no page, no API, no Home card, and no chat answers.
 * Every read and write in prospects-store checks this first, so a page or
 * route that forgot to check still cannot return prospect data.
 */
export function canSeeProspects(role: Role | string | null | undefined): boolean {
  return role === "admin";
}

export class ProspectsForbiddenError extends Error {
  constructor() {
    super("Prospects are for administrators only.");
    this.name = "ProspectsForbiddenError";
  }
}

export type ProspectsViewer = { stage: string; role: "admin"; name?: string };

export function assertProspectsAccess(viewer: { role: Role | string } | null | undefined): asserts viewer is ProspectsViewer {
  if (!viewer || !canSeeProspects(viewer.role)) throw new ProspectsForbiddenError();
}
