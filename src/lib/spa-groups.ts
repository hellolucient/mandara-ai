/**
 * Resort-brand grouping for spa lists in Home, Revenue mix, Promotions, and comparisons.
 * TODO(Tenille): Confirm group membership and headings against the live resort list.
 */

export type SpaGroupId = "cinnamon" | "adaaran" | "single" | "other";

export type SpaGroupDef = {
  id: SpaGroupId;
  /** Empty string hides the heading (not used today). */
  label: string;
  /** Stored location short names in display order before revenue sort. */
  spas: readonly string[];
};

export const SPA_GROUPS: readonly SpaGroupDef[] = [
  {
    id: "cinnamon",
    label: "Cinnamon",
    spas: ["Hakuraa Huraa", "Ellaidhoo", "Velifushi", "Dhonveli"],
  },
  {
    id: "adaaran",
    label: "Adaaran",
    spas: ["Rannalhi", "Meedhupparu", "Hudhuranfushi", "Vadoo"],
  },
  {
    id: "single",
    label: "Single resorts",
    spas: ["Kunaavashi", "Nasandhura"],
  },
];

const GROUP_BY_SPA = new Map<string, SpaGroupDef>();
for (const group of SPA_GROUPS) {
  for (const spa of group.spas) {
    GROUP_BY_SPA.set(spa.toLowerCase(), group);
  }
}

const GROUP_ORDER: readonly SpaGroupId[] = ["cinnamon", "adaaran", "single", "other"];

/** Display-only labels; stored location keys stay unchanged. */
export function spaDisplayName(storedName: string): string {
  if (storedName === "Kunaavashi") return "NOOE Kunaavashi";
  return storedName;
}

export function spaGroupForName(storedName: string): SpaGroupDef {
  return (
    GROUP_BY_SPA.get(storedName.toLowerCase()) ?? {
      id: "other",
      label: "Other",
      spas: [],
    }
  );
}

export type SpaGrouped<T> = {
  groupId: SpaGroupId;
  groupLabel: string;
  items: T[];
};

/**
 * Group spas by resort brand, then sort within each group by revenue descending.
 * Spas not in SPA_GROUPS fall into the "Other" group at the end.
 */
export function groupSpasByBrand<T>(
  items: T[],
  revenue: (item: T) => number,
  name: (item: T) => string,
): SpaGrouped<T>[] {
  const buckets = new Map<SpaGroupId, T[]>();
  for (const id of GROUP_ORDER) buckets.set(id, []);

  for (const item of items) {
    const group = spaGroupForName(name(item));
    const list = buckets.get(group.id) ?? buckets.get("other")!;
    list.push(item);
  }

  const result: SpaGrouped<T>[] = [];
  for (const id of GROUP_ORDER) {
    const list = buckets.get(id) ?? [];
    if (list.length === 0) continue;
    list.sort((a, b) => revenue(b) - revenue(a));
    const def = SPA_GROUPS.find((g) => g.id === id);
    result.push({
      groupId: id,
      groupLabel: def?.label ?? "Other",
      items: list,
    });
  }
  return result;
}

export function sortSpaNamesByBrand(names: string[], revenueByName: Map<string, number>): string[] {
  const items = names.map((name) => ({ name, revenue: revenueByName.get(name) ?? 0 }));
  return groupSpasByBrand(items, (i) => i.revenue, (i) => i.name).flatMap((g) => g.items.map((i) => i.name));
}