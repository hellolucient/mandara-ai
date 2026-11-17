import { sql } from "@/lib/db";

export type HomeKPIs = {
  latestDate: string;
  latestRevenue: number;
  mtdRevenue: number;
  mtdTreatments: number;
  /** Retail revenue month to date; null when no stored day splits out retail. */
  mtdRetailSales: number | null;
  /** Retail as a share of net sales, over the lines that report retail. */
  retailShare: number | null;
  avgSpendPerGuest: number | null;
  currency: string;
  isStale: boolean;
};

export type SpaSummary = {
  locationId: string;
  locationName: string;
  latestRevenue: number | null;
  mtdRevenue: number;
  budgetAmount: number | null;
  budgetPercent: number | null;
  /** Retail revenue month to date; null when no day for this spa splits out retail. */
  mtdRetailSales: number | null;
  sparklineData: Array<{ date: string; revenue: number | null }>;
};

/**
 * Calculate KPIs from stored sales data for the home dashboard.
 * Returns null if no data exists.
 */
export async function calculateHomeKPIs(stage: string, today: string): Promise<HomeKPIs | null> {
  const days = await sql<{
    business_date: string;
    source: string;
    currency: string;
    net_sales: number | null;
    treatments: number | null;
    retail_sales: number | null;
    net_with_retail: number | null;
  }>(
    `select to_char(business_date, 'YYYY-MM-DD') as business_date,
            source, currency,
            sum(net_sales) as net_sales,
            sum(treatments) as treatments,
            sum(retail_sales) as retail_sales,
            sum(case when retail_sales is not null then net_sales end) as net_with_retail
     from sales_days d
     left join sales_lines l on l.day_id = d.id
     where d.stage = $1
     group by d.id, d.business_date, d.source, d.currency
     order by d.business_date desc`,
    [stage],
  );

  if (days.length === 0) return null;

  const latestDay = days[0];
  const latestDate = latestDay.business_date;
  const currency = latestDay.currency;

  // Check if data is stale (>2 days old)
  const daysSinceLatest = Math.floor((Date.parse(today) - Date.parse(latestDate)) / (1000 * 60 * 60 * 24));
  const isStale = daysSinceLatest > 2;

  // Latest day revenue
  const latestRevenue = num(latestDay.net_sales) ?? 0;

  // MTD calculations
  const currentMonth = today.slice(0, 7); // YYYY-MM
  const mtdDays = days.filter((d) => d.business_date.startsWith(currentMonth) && d.business_date <= today);

  const mtdRevenue = mtdDays.reduce((sum, d) => sum + (num(d.net_sales) ?? 0), 0);
  const mtdTreatments = mtdDays.reduce((sum, d) => sum + (num(d.treatments) ?? 0), 0);

  // Retail is optional per line; only days and spas that report it are counted.
  const mtdRetailSales = sumKnown(mtdDays.map((d) => num(d.retail_sales)));
  const netWithRetail = sumKnown(mtdDays.map((d) => num(d.net_with_retail)));
  const retailShare = mtdRetailSales !== null && netWithRetail ? (mtdRetailSales / netWithRetail) * 100 : null;
  const avgSpendPerGuest = mtdTreatments > 0 ? mtdRevenue / mtdTreatments : null;

  return {
    latestDate,
    latestRevenue,
    mtdRevenue,
    mtdTreatments,
    mtdRetailSales,
    retailShare,
    avgSpendPerGuest,
    currency,
    isStale,
  };
}

/**
 * Get sparkline data (last 14 days) and MTD per spa location.
 */
export async function getSpaSummaries(stage: string, today: string): Promise<SpaSummary[]> {
  const fourteenDaysAgo = new Date(Date.parse(today) - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const monthStart = `${currentMonth}-01`;
  const fromDate = monthStart < fourteenDaysAgo ? monthStart : fourteenDaysAgo;
  const [year, month] = currentMonth.split("-").map(Number);

  // Get all location names from recent data
  const locations = await sql<{ location_id: string; location_name: string }>(
    `select distinct location_id, location_name
     from sales_lines l
     join sales_days d on d.id = l.day_id
     where d.stage = $1
     order by location_name`,
    [stage],
  );

  // Get budgets for current month
  const budgets = await sql<{ location_id: string; amount: number }>(
    `select location_id, amount
     from budgets
     where stage = $1 and year = $2 and month = $3`,
    [stage, year, month],
  );
  const budgetMap = new Map(budgets.map((b) => [b.location_id, num(b.amount)]));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Get sales data for last 14 days and MTD
  const salesData = await sql<{
    location_id: string;
    business_date: string;
    net_sales: number | null;
    retail_sales: number | null;
  }>(
    `select l.location_id,
            to_char(d.business_date, 'YYYY-MM-DD') as business_date,
            l.net_sales,
            l.retail_sales
     from sales_lines l
     join sales_days d on d.id = l.day_id
     where d.stage = $1
       and d.business_date >= $2
     order by l.location_id, d.business_date`,
    [stage, fromDate],
  );
  for (const row of salesData) {
    row.net_sales = num(row.net_sales);
    row.retail_sales = num(row.retail_sales);
  }
  const latestMtdDate = salesData
    .map((s) => s.business_date)
    .filter((d) => d.startsWith(currentMonth) && d <= today)
    .sort()
    .pop();
  const daysCovered = latestMtdDate ? Number(latestMtdDate.slice(8, 10)) : 0;

  const summaries: SpaSummary[] = [];

  for (const loc of locations) {
    const locSales = salesData.filter((s) => s.location_id === loc.location_id);

    // Latest day revenue
    const latest = locSales.length > 0 ? locSales[locSales.length - 1] : null;
    const latestRevenue = latest?.net_sales ?? null;

    // MTD revenue
    const mtdSales = locSales.filter((s) => s.business_date.startsWith(currentMonth) && s.business_date <= today);
    const mtdRevenue = mtdSales.reduce((sum, s) => sum + (s.net_sales ?? 0), 0);
    const mtdRetailSales = sumKnown(mtdSales.map((s) => s.retail_sales));

    // Budget comparison
    const budgetAmount = budgetMap.get(loc.location_id) ?? null;
    // Compare against the budget for the days covered so far, not the whole month.
    const budgetToDate = budgetAmount && budgetAmount > 0 && daysCovered > 0 ? (budgetAmount * daysCovered) / daysInMonth : null;
    const budgetPercent = budgetToDate ? (mtdRevenue / budgetToDate) * 100 : null;

    // Sparkline data (last 14 days)
    const sparklineData: Array<{ date: string; revenue: number | null }> = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(Date.parse(today) - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const dayData = locSales.find((s) => s.business_date === date);
      sparklineData.push({ date, revenue: dayData?.net_sales ?? null });
    }

    summaries.push({
      locationId: loc.location_id,
      locationName: loc.location_name,
      latestRevenue,
      mtdRevenue,
      budgetAmount,
      budgetPercent,
      mtdRetailSales,
      sparklineData,
    });
  }

  return summaries;
}

/**
 * Check if sales data is stale (>2 days old).
 */
export function isSalesDataStale(latestDate: string, today: string): boolean {
  const daysSince = Math.floor((Date.parse(today) - Date.parse(latestDate)) / (1000 * 60 * 60 * 24));
  return daysSince > 2;
}

/** Sum of the known values, or null when every value is missing (so "no data" is not shown as 0). */
export function sumKnown(values: Array<number | null>): number | null {
  let total: number | null = null;
  for (const value of values) if (value !== null) total = (total ?? 0) + value;
  return total;
}

/** Postgres returns numeric and bigint sums as strings; convert safely. */
export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
