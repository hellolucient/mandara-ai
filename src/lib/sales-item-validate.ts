import type { ItemCategory, ItemLineRow, SalesItemsExtract } from "@/lib/sales-item-types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isItemLinesPayload(input: unknown): input is Record<string, unknown> & { items: unknown[] } {
  return Boolean(input && typeof input === "object" && Array.isArray((input as Record<string, unknown>).items));
}

export function isItemLinesImport(input: unknown): boolean {
  return isItemLinesPayload(input);
}

function nullableNumber(value: unknown): { ok: true; value: number | null } | { ok: false } {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value === "number" && Number.isFinite(value)) return { ok: true, value };
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return { ok: true, value: Number(value) };
  }
  return { ok: false };
}

function parseCategory(value: unknown): ItemCategory | null {
  if (typeof value !== "string") return null;
  const folded = value.trim().toLowerCase();
  if (folded === "treatment" || folded === "retail") return folded;
  return null;
}

export function validateItemLinesExtract(
  input: unknown,
): { ok: true; extract: SalesItemsExtract } | { ok: false; error: string } {
  if (!isItemLinesPayload(input)) return { ok: false, error: "The file was not an item-lines extract." };
  const record = input;
  const businessDate = typeof record.businessDate === "string" ? record.businessDate : "";
  if (!DATE.test(businessDate) || Number.isNaN(Date.parse(`${businessDate}T00:00:00Z`))) {
    return { ok: false, error: "businessDate must be a real YYYY-MM-DD date." };
  }
  const currency = typeof record.currency === "string" && /^[A-Z]{3}$/.test(record.currency) ? record.currency : "USD";
  if (record.items.length === 0 || record.items.length > 5000) {
    return { ok: false, error: "The extract needs between 1 and 5000 item rows." };
  }
  const issues: string[] = [];
  const items: ItemLineRow[] = [];
  const seen = new Set<string>();
  for (const row of record.items) {
    if (!row || typeof row !== "object") return { ok: false, error: "An item row was not an object." };
    const item = row as Record<string, unknown>;
    const location = typeof item.location === "string" ? item.location.trim() : "";
    if (!location || location.length > 120) return { ok: false, error: "Each item row needs a location name." };
    const category = parseCategory(item.category);
    if (!category) return { ok: false, error: `Each item needs category treatment or retail (${location}).` };
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name || name.length > 200) return { ok: false, error: `Each item needs a name (${location}).` };
    const quantity = nullableNumber(item.quantity);
    const net = nullableNumber(item.netSales);
    if (!quantity.ok || !net.ok) return { ok: false, error: `${location}: quantity and netSales must be numbers.` };
    if (quantity.value == null || quantity.value < 0) {
      return { ok: false, error: `${location} · ${name}: quantity must be zero or greater.` };
    }
    if (net.value == null || net.value < 0) {
      return { ok: false, error: `${location} · ${name}: netSales must be zero or greater.` };
    }
    const key = `${location.toLowerCase()}|${category}|${name.toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: `Duplicate item line: ${location}, ${category}, ${name}.` };
    seen.add(key);
    items.push({
      location,
      category,
      name,
      quantity: quantity.value,
      netSales: net.value,
    });
  }
  return { ok: true, extract: { businessDate, currency, items, issues } };
}