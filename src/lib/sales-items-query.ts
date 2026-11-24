const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ItemsQuery =
  | { ok: true; mode: "day"; fromDate: string; toDate: string }
  | { ok: true; mode: "range"; fromDate: string; toDate: string }
  | { ok: false; error: string; status: number };

export function parseItemsQuery(params: { date?: string; from?: string; to?: string }): ItemsQuery {
  const date = params.date?.trim() ?? "";
  const from = params.from?.trim() ?? "";
  const to = params.to?.trim() ?? "";

  if (date) {
    if (!DATE.test(date)) return { ok: false, error: "date must be YYYY-MM-DD.", status: 400 };
    return { ok: true, mode: "day", fromDate: date, toDate: date };
  }
  if (from && to) {
    if (!DATE.test(from) || !DATE.test(to)) return { ok: false, error: "from and to must be YYYY-MM-DD.", status: 400 };
    if (from > to) return { ok: false, error: "from must not be after to.", status: 400 };
    return { ok: true, mode: "range", fromDate: from, toDate: to };
  }
  return { ok: false, error: "Pass date for one day, or from and to for a range.", status: 400 };
}