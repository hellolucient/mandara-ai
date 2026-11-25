import { newId } from "@/lib/ids";
import type { ParsedPeriodFile } from "@/lib/statistic-period-parse";
import { parseStatisticPeriodFile } from "@/lib/statistic-period-parse";

export type SqlExecutor = {
  (text: string, params?: unknown[]): Promise<unknown[]>;
};

export async function replacePeriodItems(
  execute: SqlExecutor,
  stage: string,
  parsed: ParsedPeriodFile,
): Promise<{ rows: number }> {
  await execute(
    `delete from sales_period_items
     where stage = $1 and period_from = $2::date and period_to = $3::date and kind = $4`,
    [stage, parsed.periodFrom, parsed.periodTo, parsed.kind],
  );

  let rows = 0;
  for (const item of parsed.items) {
    await execute(
      `insert into sales_period_items
         (id, stage, period_from, period_to, location, kind, item_code, item_name, supplier, qty, nett)
       values ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, $11)
       on conflict (stage, period_from, period_to, location, kind, item_code, item_name)
       do update set qty = excluded.qty, nett = excluded.nett, supplier = excluded.supplier, imported_at = now()`,
      [
        newId(),
        stage,
        parsed.periodFrom,
        parsed.periodTo,
        item.location,
        parsed.kind,
        item.itemCode,
        item.itemName,
        item.supplier,
        item.qty,
        item.nett,
      ],
    );
    rows += 1;
  }
  return { rows };
}

export async function importStatisticPeriodFile(
  execute: SqlExecutor,
  stage: string,
  text: string,
  filename: string,
): Promise<{ ok: true; rows: number; periodFrom: string; periodTo: string; kind: string } | { ok: false; error: string }> {
  const parsed = parseStatisticPeriodFile(text, filename);
  if (!parsed.ok) return parsed;
  const saved = await replacePeriodItems(execute, stage, parsed.parsed);
  return {
    ok: true,
    rows: saved.rows,
    periodFrom: parsed.parsed.periodFrom,
    periodTo: parsed.parsed.periodTo,
    kind: parsed.parsed.kind,
  };
}