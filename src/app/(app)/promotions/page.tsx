import Link from "next/link";
import { SalesActions } from "@/components/sales-actions";
import { Badge } from "@/components/ui/badge";
import { buildDailyView, buildMonthlySummaries, buildWeeklyView } from "@/lib/promo-analytics";
import { loadApprovedPromoCodes } from "@/lib/promo-approved-codes";
import { seedPromoBackfill } from "@/lib/promo-backfill-seed";
import { listPromoPeriods, loadAllPromoLines } from "@/lib/promo-store";
import { money } from "@/lib/dates";
import { canManage } from "@/lib/members";
import { loadDays } from "@/lib/sales-store";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Tab = "daily" | "weekly" | "monthly";

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const member = await currentMember();
  if (!member) redirect("/");
  await seedPromoBackfill(member.stage);

  const query = await searchParams;
  const view: Tab = query.view === "weekly" || query.view === "monthly" ? query.view : "daily";

  const [periods, lines, salesDays, approved] = await Promise.all([
    listPromoPeriods(member.stage),
    loadAllPromoLines(member.stage, "treatment"),
    loadDays(member.stage),
    loadApprovedPromoCodes(member.stage),
  ]);
  const retailLines = await loadAllPromoLines(member.stage, "retail");
  const allLines = [...lines, ...retailLines];

  const daily = buildDailyView(periods, allLines, salesDays, approved);
  const weekly = buildWeeklyView(allLines, approved, "treatment");
  const monthly = buildMonthlySummaries(periods, allLines, salesDays, approved, "treatment");
  const retailMonthly = buildMonthlySummaries(periods, allLines, salesDays, approved, "retail");

  const offList = [
    ...new Set(
      allLines.map((l) => l.promoCode.toUpperCase()).filter((code) => !approved.has(code)),
    ),
  ].sort();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl">Promotions</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Steiners promotion summaries by code and spa. Import a JSON file from{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">scripts/promo_to_import.py</code> (same Import a file flow as
            sales). Re-importing the same range and kind replaces the prior data.
          </p>
        </div>
        <SalesActions canRun={canManage(member.role)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            { id: "daily", label: "Daily" },
            { id: "weekly", label: "Weekly" },
            { id: "monthly", label: "Monthly" },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.id}
            href={`/promotions?view=${tab.id}`}
            className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap ${view === tab.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {periods.length === 0 ? (
        <p className="mt-8 rounded-xl border bg-card px-4 py-6 text-sm">
          No promotion data yet. Run{" "}
          <code className="rounded bg-muted px-1 text-xs">node scripts/promo_backfill_generate.mjs</code> then import the JSON files, or
          add them under <code className="rounded bg-muted px-1 text-xs">data/promo-backfill/json</code> for automatic local seeding.
        </p>
      ) : null}

      {offList.length > 0 ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Off-list codes in stored data: {offList.join(", ")}. Review the approved list (TODO: Trent to confirm standing offers).
        </p>
      ) : null}

      {view === "daily" ? (
        <section className="mt-6 space-y-4">
          <h2 className="font-heading text-xl">Daily · by spa</h2>
          {!daily.date ? (
            <p className="text-sm text-muted-foreground">No single-day treatment promo file for yesterday; showing the latest available day below if present.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Promo day {daily.date} (promo USD as % of stored DSR treatment revenue where available).</p>
          )}
          {daily.spas.map((spa) => (
            <article key={spa.spa} className="overflow-hidden rounded-xl border bg-card">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h3 className="font-medium">{spa.spa}</h3>
                  <p className="text-xs text-muted-foreground">
                    Promo {money(spa.promoUsd, "USD")}
                    {spa.promoSharePct != null ? ` · ${spa.promoSharePct}% of treatment revenue` : " · no DSR treatment revenue for this date"}
                  </p>
                </div>
                {spa.shareAlert ? <Badge variant="destructive">Share jump</Badge> : null}
              </header>
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2 pl-3 font-medium">Code</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 text-right font-medium">Qty</th>
                    <th className="py-2 pr-3 text-right font-medium">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {spa.codes.map((row) => (
                    <tr key={row.promoCode} className="border-b last:border-0">
                      <td className="py-2 pl-3">
                        {row.promoCode}
                        {row.offList ? (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            Off list
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{row.description || "—"}</td>
                      <td className="px-2 py-2 text-right">{row.qty}</td>
                      <td className="py-2 pr-3 text-right">{money(row.usd, "USD")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </section>
      ) : null}

      {view === "weekly" ? (
        <section className="mt-6">
          <h2 className="font-heading text-xl">Weekly · spa director</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Week {weekly.weekKey || "—"}
            {weekly.priorWeekKey ? ` vs ${weekly.priorWeekKey}` : ""} — treatment promos assigned by ISO week of period end.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="py-3 pl-3 font-medium">Spa</th>
                  <th className="px-2 py-3 font-medium">Code</th>
                  <th className="px-2 py-3 text-right font-medium">This wk</th>
                  <th className="px-2 py-3 text-right font-medium">Prior wk</th>
                  <th className="py-3 pr-3 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {weekly.rows.slice(0, 80).map((row) => (
                  <tr key={`${row.spa}-${row.promoCode}`} className="border-b last:border-0">
                    <td className="py-2 pl-3">{row.spa}</td>
                    <td className="px-2 py-2">
                      {row.promoCode}
                      {row.offList ? (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          Off list
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right">{money(row.thisWeekUsd, "USD")}</td>
                    <td className="px-2 py-2 text-right">{money(row.priorWeekUsd, "USD")}</td>
                    <td className="py-2 pr-3 text-right">
                      {money(row.changeUsd, "USD")}
                      {row.changePct != null ? ` (${row.changePct > 0 ? "+" : ""}${row.changePct}%)` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {view === "monthly" ? (
        <section className="mt-6 space-y-8">
          <h2 className="font-heading text-xl">Monthly summary</h2>
          {monthly.map((block) => (
            <article key={block.periodFrom} className="rounded-xl border bg-card p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-lg">{block.label}</h3>
                <p className="text-sm">
                  {money(block.totalUsd, "USD")}
                  {block.changePct != null && block.priorLabel ? (
                    <span className="ml-2 text-muted-foreground">
                      vs {block.priorLabel} ({block.changePct > 0 ? "+" : ""}
                      {block.changePct}%)
                    </span>
                  ) : null}
                </p>
              </header>
              {block.offListCodes.length > 0 ? (
                <p className="mt-2 text-xs text-amber-800">Off-list codes this month: {block.offListCodes.join(", ")}</p>
              ) : null}
              <table className="mt-4 w-full text-sm">
                <thead className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="py-2 font-medium">Spa</th>
                    <th className="py-2 text-right font-medium">Promo USD</th>
                    <th className="py-2 text-right font-medium">Promo % rev</th>
                    <th className="py-2 pr-1 font-medium">Top codes</th>
                  </tr>
                </thead>
                <tbody>
                  {block.spas.map((spa) => (
                    <tr key={spa.spa} className="border-b last:border-0">
                      <td className="py-2">{spa.spa}</td>
                      <td className="py-2 text-right">{money(spa.promoUsd, "USD")}</td>
                      <td className="py-2 text-right">{spa.promoSharePct != null ? `${spa.promoSharePct}%` : "—"}</td>
                      <td className="py-2 pr-1 text-xs text-muted-foreground">
                        {spa.topCodes.map((c) => `${c.promoCode} ${money(c.usd, "USD")}${c.offList ? "⚠" : ""}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
          {retailMonthly.length > 0 ? (
            <div>
              <h3 className="font-heading text-lg">Retail promos</h3>
              {retailMonthly.map((block) => (
                <p key={block.periodFrom} className="mt-2 text-sm">
                  {block.label}: {money(block.totalUsd, "USD")}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}