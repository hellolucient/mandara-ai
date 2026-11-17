const ALIASES: Record<string, string> = {
  "north malé": "Kaafu",
  "south malé": "Kaafu",
  "malé": "Kaafu",
  "north male": "Kaafu",
  "south male": "Kaafu",
  male: "Kaafu",
  "north ari": "Alifu Alifu",
  "south ari": "Alifu Dhaalu",
};

/**
 * The atoll a prospect is filed under. The workbook uses official names ("Kaafu"), the openings
 * list uses geographic ones ("South Malé Atoll, Guraidhoo"); both read as the official atoll.
 */
export function atollGroup(atoll: string): string {
  const a = atoll.trim();
  if (!a || /not settled|unknown/i.test(a)) return "";
  if (/hulhumal/i.test(a)) return "Kaafu";
  const named = /^([^,(]+?)\s+atoll\b/i.exec(a);
  const base = (named ? named[1] : a.replace(/\s*\(.*\)\s*$/, "").split(",")[0]).trim();
  return ALIASES[base.toLowerCase()] ?? base;
}

export function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatDay(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "linkedin.com/in/greg-allan" rather than the full link, so several links on one site stay distinguishable. */
export function shortUrl(url: string, max = 48): string {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, "");
    const text = `${u.hostname.replace(/^www\./, "")}${path}`;
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  } catch {
    return url;
  }
}
