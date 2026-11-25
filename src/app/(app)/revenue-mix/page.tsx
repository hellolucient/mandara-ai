import Link from "next/link";
import { redirect } from "next/navigation";
import { RevenueMixCategoryBar, RevenueMixLegend } from "@/components/revenue-mix/revenue-mix-bars";
import { spaDisplayName } from "@/lib/spa-groups";
import { formatBusinessDate } from "@/lib/dates";
import { canSeeRevenueMix } from "@/lib/revenue-mix-access";
import {
  buildRevenueMixPeriod,
  buildSpaMixRows,
  loadItemLinesForMix,
  listSpasWithItemLines,
  monthRangeContaining,
  weekRangeContaining,
} from "@/lib/revenue-mix";
import { calculateHomeKPIs } from "@/lib/home-kpis";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

type View = "daily" | "weekly" | "monthly";

export default async function RevenueMixPage({ searchParams }: { searchParams: Promise<{ view?: string; spa?: string }> }) {
  const member = await currentMember();
  if (!member) redirect("/");
  if (!canSeeRevenueMix(member.role)) redirect("/");

  const query = await searchParams;
  const view: View = query.view === "daily" || query.view === "weekly" ? query.view : "monthly";
  const spaFilter = query.spa?.trim() || "";

  const today = new Date().toISOString().slice(0, 10);
  const kpis = await calculateHomeKPIs(member.stage, today);
  const latestDate = kpis?.latestDate ?? today;

  let from = latestDate;
  let to = latestDate;
  let periodLabel = formatBusinessDate(latestDate);
  if (view === "weekly") {
    const range = weekRangeContaining(latestDate);
    from = range.from;
    to = range.to;
    periodLabel = `${formatBusinessDate(from)} – ${formatBusinessDate(to)}`;
  } else if (view === "monthly") {
    const range = monthRangeContaining(latestDate);
    from = range.from;
    to = range.to;
    periodLabel = `${formatBusinessDate(from)} – ${formatBusinessDate(to)}`;
  }

  const [lines, spas] = await Promise.all([
    loadItemLinesForMix(member.stage, from, to, spaFilter || null),
    listSpasWithItemLines(member.stage),
  ]);
  const period = buildRevenueMixPeriod(lines);
  const spaRows = spaFilter ? [] : buildSpaMixRows(lines);
  const allLegend = [...period.treatmentSlices, ...period.retailSlices];

  const unmapped = [...new Set([...period.unmappedTreatmentNames, ...period.unmappedRetailNames])];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl">Revenue mix</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Revenue by treatment menu section and retail brand.
          </p>
        </div>
        <form className="flex flex-wrap items-center gap-2" method="get">
          <input type="hidden" name="view" value={view} />
          <label className="sr-only" htmlFor="spa-filter">
            Spa
          </label>
          <select
            id="spa-filter"
            name="spa"
            defaultValue={spaFilter}
            className="rounded-full border bg-card px-3 py-1.5 text-xs"
          >
            <option value="">All spas</option>
            {spas.map((s) => (
              <option key={s.id} value={s.id}>
                {spaDisplayName(s.name)}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full border bg-primary px-3 py-1.5 text-xs text-primary-foreground">
            Apply
          </button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            { id: "monthly", label: "Monthly" },
            { id: "weekly", label: "Weekly" },
            { id: "daily", label: "Daily" },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.id}
            href={`/revenue-mix?view=${tab.id}${spaFilter ? `&spa=${encodeURIComponent(spaFilter)}` : ""}`}
            className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${view === tab.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Period: <span className="font-medium text-foreground">{periodLabel}</span>
        {period.hasData ? null : " — no item lines stored for this period yet."}
      </p>

      {period.hasData ? (
        <>
          <div className="mt-6 rounded-xl border bg-card p-4 md:p-5">
            <RevenueMixLegend slices={allLegend} />
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <RevenueMixCategoryBar
                label="Treatments by menu section"
                total={period.treatmentTotal}
                slices={period.treatmentSlices}
                currency={period.currency}
              />
              <RevenueMixCategoryBar
                label="Retail by brand"
                total={period.retailTotal}
                slices={period.retailSlices}
                currency={period.currency}
              />
            </div>
          </div>

          {spaRows.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-sm font-medium">By spa</h2>
              <ul className="mt-4 space-y-6">
                {spaRows.map((row) => (
                  <li key={row.locationId} className="rounded-xl border bg-card p-4">
                    <p className="mb-3 text-sm font-medium">{spaDisplayName(row.spa)}</p>
                    <div className="grid gap-6 md:grid-cols-2">
                      <RevenueMixCategoryBar
                        label="Treatments"
                        total={row.treatmentSlices.reduce((s, x) => s + x.netSales, 0)}
                        slices={row.treatmentSlices}
                        currency={period.currency}
                        compact
                      />
                      <RevenueMixCategoryBar
                        label="Retail"
                        total={row.retailSlices.reduce((s, x) => s + x.netSales, 0)}
                        slices={row.retailSlices}
                        currency={period.currency}
                        compact
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {unmapped.length > 0 ? (
        <section className="mt-8 rounded-xl border border-dashed bg-muted/30 p-4">
          <h2 className="text-sm font-medium">Unmapped items</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            These lines need a menu section or retail brand assignment before they appear in the mix.
          </p>
          <ul className="mt-3 list-inside list-disc text-sm">
            {unmapped.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}