# Statistic Entry period imports (routine)

Steiners **Statistic Entry** range exports (group MDV) feed last-year MTD/YTD comparisons on Home **By spa**.

## Files

- One file per range and kind: `stat_YYYY-MM-DD_YYYY-MM-DD_Treatment.txt` or `_Retail.txt` (tab-separated).
- Import with:

```bash
DATABASE_URL='<direct Postgres or Neon>' npx tsx scripts/import-period-items.mjs stat_2025-11-01_2025-11-24_Treatment.txt stat_2025-11-01_2025-11-24_Retail.txt
```

Re-importing the same `period_from`, `period_to`, and kind **replaces** rows for that period.

## Daily routine (going forward)

1. **Each DSR day**: import the Statistic range **1st of month last year … same calendar day last year** (Treatment + Retail pair). Example on 2026-11-24: `stat_2025-11-01_2025-11-24_Treatment.txt` and `_Retail.txt`.
2. **On the 1st of each month**: import the **full previous calendar month** for this year (Treatment + Retail). Example on 2026-12-01: `stat_2026-11-01_2026-11-30_Treatment.txt` and `_Retail.txt`.

Keep historical backfill (full months Jan–Dec 2025, Jan–Oct 2026, and the Nov partials) on the server or import in batches when ranges change.

## Migration

Apply `024_sales_period_items.sql` with `npm run db:migrate` when `DATABASE_URL` is set.