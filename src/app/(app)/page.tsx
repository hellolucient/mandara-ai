import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Cloud,
  LayoutGrid,
  Mail,
  Sparkles,
  Users,
} from "lucide-react";
import { WorldClocks } from "@/components/world-clocks";
import { Sparkline } from "@/components/sparkline";
import { currentMember } from "@/lib/session";
import { calculateHomeKPIs, getSpaSummaries, type HomeKPIs, type SpaSummary } from "@/lib/home-kpis";
import { AskTile } from "@/components/ask-tile";
import { ProspectsCard } from "@/components/prospects/home-card";
import { canSeeProspects } from "@/lib/prospects-access";
import { prospectSummary } from "@/lib/prospects-store";

export const dynamic = "force-dynamic";

const APP_LINKS: Array<{ label: string; hint: string; url: string; icon: LucideIcon }> = [
  { label: "Mandara AI", hint: "Chat", url: "/chat", icon: Sparkles },
  { label: "Outlook", hint: "Mail", url: "https://outlook.office.com/mail/", icon: Mail },
  { label: "Calendar", hint: "Outlook", url: "https://outlook.office.com/calendar/", icon: CalendarDays },
  { label: "Teams", hint: "Microsoft", url: "https://teams.microsoft.com", icon: Users },
  { label: "OneDrive", hint: "Files", url: "https://www.office.com/onedrive", icon: Cloud },
  { label: "Office", hint: "Microsoft 365", url: "https://www.office.com", icon: LayoutGrid },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function HomePage() {
  const member = await currentMember();
  if (!member) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-10">
        <p className="text-muted-foreground">Not signed in</p>
      </main>
    );
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // The Prospects card is for administrators only: nothing is read for anyone else.
  const [kpis, spas, prospects] = await Promise.all([
    calculateHomeKPIs(member.stage, today),
    getSpaSummaries(member.stage, today),
    canSeeProspects(member.role) ? prospectSummary(member) : Promise.resolve(null),
  ]);

  const firstName = member.name?.split(" ")[0] || "there";
  const currency = kpis?.currency || "USD";

  return (
    <main className="mx-auto max-w-[1200px] px-5 pt-8 pb-16 md:px-10 md:pt-12">
      {/* Header */}
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">{longDate(now)}</p>
          <h1 className="mt-2 font-heading text-[34px] leading-[1.1] font-normal tracking-[-0.01em] text-primary md:text-[44px]">
            Good {timeOfDay(now)}, {firstName}
          </h1>
        </div>
        <WorldClocks />
      </header>

      {kpis ? <Overview kpis={kpis} spas={spas} today={today} /> : <EmptyOverview />}

      {/* Ask + apps */}
      <section className="mt-10 grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col lg:col-span-7">
          <SectionTitle>Ask Mandara AI</SectionTitle>
          <AskTile />
        </div>
        <div className="lg:col-span-5">
          <SectionTitle>Quick access</SectionTitle>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {APP_LINKS.map((link) => (
              <AppTile key={link.url} {...link} />
            ))}
          </div>
        </div>
      </section>

      {spas.length > 0 ? <SpaTable spas={spas} currency={currency} /> : null}

      {prospects ? <ProspectsCard summary={prospects} /> : null}
    </main>
  );
}

/* ---------- Overview ---------- */

function Overview({ kpis, spas, today }: { kpis: HomeKPIs; spas: SpaSummary[]; today: string }) {
  const daysOld = Math.max(0, Math.floor((Date.parse(today) - Date.parse(kpis.latestDate)) / DAY_MS));
  const trend = groupTrend(spas);
  const monthDays = Number(kpis.latestDate.slice(8, 10));
  const monthLabel = new Date(`${kpis.latestDate}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

  return (
    <section className="mt-10 md:mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Performance</SectionTitle>
        <StatusPill stale={kpis.isStale} daysOld={daysOld} latestDate={kpis.latestDate} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6">
        {/* Hero: month to date */}
        <div className="relative col-span-2 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-[0_1px_2px_rgba(20,40,35,0.12),0_12px_32px_-12px_rgba(20,60,55,0.45)] md:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-[radial-gradient(closest-side,rgba(255,240,215,0.09),transparent)]"
          />
          <p className="text-[11px] font-medium tracking-[0.18em] text-primary-foreground/65 uppercase">Month to date</p>
          <p className="mt-3 font-heading text-[40px] leading-none tracking-[-0.02em] tabular-nums md:text-[44px]">
            {formatCurrency(kpis.mtdRevenue, kpis.currency)}
          </p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <p className="text-[13px] text-primary-foreground/70">
              {spas.length} spas · 1–{monthDays} {monthLabel}
            </p>
            {trend.length > 1 ? (
              <Sparkline data={trend} id="group" width={132} height={34} strokeWidth={1.6} className="text-[#e9d7b8]" />
            ) : null}
          </div>
        </div>

        <KpiCard
          label="Latest day"
          value={formatCurrency(kpis.latestRevenue, kpis.currency)}
          note={shortDate(kpis.latestDate)}
        />
        <KpiCard label="Guests" value={kpis.mtdTreatments.toLocaleString("en-US")} note="Month to date" />
        <KpiCard
          label="Avg spend"
          value={kpis.avgSpendPerGuest !== null ? formatCurrency(kpis.avgSpendPerGuest, kpis.currency) : "—"}
          note="Per guest"
        />
        <KpiCard
          label="Retail sales"
          value={kpis.mtdRetailSales !== null ? formatCurrency(kpis.mtdRetailSales, kpis.currency) : "—"}
          note={
            kpis.mtdRetailSales !== null && kpis.retailShare !== null
              ? `${kpis.retailShare.toFixed(1)}% of revenue`
              : "Month to date"
          }
        />
      </div>
    </section>
  );
}

function KpiCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] dark:border-white/10">
      <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <div className="mt-4">
        <p className="text-[26px] leading-none font-medium tracking-[-0.02em] text-foreground tabular-nums">{value}</p>
        <p className="mt-2 text-[12.5px] text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function StatusPill({ stale, daysOld, latestDate }: { stale: boolean; daysOld: number; latestDate: string }) {
  const age = daysOld === 0 ? "today" : daysOld === 1 ? "1 day ago" : `${daysOld} days ago`;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] ${
        stale
          ? "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200"
          : "border-black/[0.06] bg-card text-muted-foreground dark:border-white/10"
      }`}
    >
      <span className="relative flex size-1.5">
        {!stale ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/50 [animation-duration:2.4s]" /> : null}
        <span className={`relative inline-flex size-1.5 rounded-full ${stale ? "bg-amber-500" : "bg-emerald-600"}`} />
      </span>
      <span>
        DSR to <span className="font-medium text-foreground">{shortDate(latestDate)}</span>
        <span className="mx-1.5 opacity-40">·</span>
        {stale ? `${daysOld} days old` : `updated ${age}`}
      </span>
    </span>
  );
}

function EmptyOverview() {
  return (
    <section className="mt-10 md:mt-12">
      <SectionTitle>Performance</SectionTitle>
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-black/[0.06] bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:py-14 dark:border-white/10">
        <svg
          aria-hidden="true"
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-primary/[0.07]"
        >
          <path d="M0 95 C80 80 120 40 200 55 S330 100 400 60 S520 20 600 35 L600 120 L0 120 Z" fill="currentColor" />
        </svg>
        <div className="relative mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary">
          <ChartNoAxesCombined className="size-[22px]" strokeWidth={1.5} />
        </div>
        <p className="relative mt-5 font-heading text-2xl text-foreground">No sales yet</p>
        <p className="relative mx-auto mt-2 max-w-md text-[14px] leading-6 text-muted-foreground">
          Daily figures from the DSR will appear here once the first day is loaded: revenue, guests, retail and each
          spa against budget.
        </p>
        <Link
          href="/sales"
          className="relative mt-6 inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-background px-4 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/[0.05]"
        >
          Go to Sales <ArrowRight className="size-3.5" strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}

function AppTile({ label, hint, url, icon: Icon }: { label: string; hint: string; url: string; icon: LucideIcon }) {
  const external = url.startsWith("http");
  return (
    <Link
      href={url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-black/[0.06] bg-card p-3.5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-black/[0.09] hover:shadow-[0_2px_4px_rgba(20,40,35,0.05),0_10px_24px_-10px_rgba(20,40,35,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:border-white/10"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.07] text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] leading-tight font-medium text-foreground">{label}</span>
        <span className="block truncate text-[11.5px] text-muted-foreground">{hint}</span>
      </span>
      {external ? (
        <ArrowUpRight
          aria-hidden="true"
          className="absolute top-3 right-3 size-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70"
          strokeWidth={1.75}
        />
      ) : null}
    </Link>
  );
}

/* ---------- Spa table ---------- */

function SpaTable({ spas, currency }: { spas: SpaSummary[]; currency: string }) {
  const showRetail = spas.some((spa) => spa.mtdRetailSales !== null);
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <SectionTitle>By spa</SectionTitle>
        <p className="hidden text-[12px] text-muted-foreground sm:block">Budget compared with the days reported so far</p>
      </div>

      {/* Desktop */}
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:block dark:border-white/10">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-black/[0.06] text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase dark:border-white/10">
              <th className="py-3 pr-3 pl-6 font-medium">Spa</th>
              <th className="px-3 py-3 text-right font-medium">Latest day</th>
              <th className="px-3 py-3 text-right font-medium">Month to date</th>
              {showRetail ? <th className="px-3 py-3 text-right font-medium">Retail MTD</th> : null}
              <th className="px-3 py-3 font-medium">vs budget</th>
              <th className="py-3 pr-6 pl-3 text-right font-medium">14 days</th>
            </tr>
          </thead>
          <tbody>
            {spas.map((spa) => (
              <tr
                key={spa.locationId}
                className="border-b border-black/[0.045] transition-colors last:border-0 hover:bg-primary/[0.025] dark:border-white/[0.06]"
              >
                <td className="py-3.5 pr-3 pl-6 font-medium text-foreground">{spa.locationName}</td>
                <td className="px-3 py-3.5 text-right text-muted-foreground tabular-nums">
                  {spa.latestRevenue !== null ? formatCurrency(spa.latestRevenue, currency) : <Missing />}
                </td>
                <td className="px-3 py-3.5 text-right font-medium text-foreground tabular-nums">
                  {formatCurrency(spa.mtdRevenue, currency)}
                </td>
                {showRetail ? (
                  <td className="px-3 py-3.5 text-right text-muted-foreground tabular-nums">
                    {spa.mtdRetailSales !== null ? formatCurrency(spa.mtdRetailSales, currency) : <Missing />}
                  </td>
                ) : null}
                <td className="px-3 py-3.5">
                  <BudgetBar percent={spa.budgetPercent} />
                </td>
                <td className="py-3.5 pr-6 pl-3 text-right">
                  <Sparkline data={spa.sparklineData} id={spa.locationId} width={140} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="mt-4 divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:hidden dark:divide-white/[0.06] dark:border-white/10">
        {spas.map((spa) => (
          <li key={spa.locationId} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-medium text-foreground">{spa.locationName}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
                  Latest {spa.latestRevenue !== null ? formatCurrency(spa.latestRevenue, currency) : "—"}
                  {showRetail && spa.mtdRetailSales !== null ? ` · Retail ${formatCurrency(spa.mtdRetailSales, currency)}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-medium text-foreground tabular-nums">{formatCurrency(spa.mtdRevenue, currency)}</p>
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">MTD</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-4">
              <BudgetBar percent={spa.budgetPercent} />
              <Sparkline data={spa.sparklineData} id={`m-${spa.locationId}`} width={96} height={24} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BudgetBar({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-[12px] text-muted-foreground/80">No budget</span>;
  }
  const tone =
    percent >= 100
      ? { bar: "bg-primary", text: "text-primary" }
      : percent >= 90
        ? { bar: "bg-[#b08a5a]", text: "text-[#8a6a40] dark:text-[#d9b98a]" }
        : { bar: "bg-[#c2703d]", text: "text-[#a65a2b] dark:text-[#e5a27a]" };
  const width = Math.min(percent, 150) / 1.5;
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-1 w-24 rounded-full bg-black/[0.07] dark:bg-white/10">
        <div className={`absolute inset-y-0 left-0 rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
        {/* 100% of budget */}
        <div aria-hidden="true" className="absolute -top-1 -bottom-1 left-[66.6%] w-px bg-foreground/25" />
      </div>
      <span className={`w-10 text-[12.5px] font-medium tabular-nums ${tone.text}`}>{percent.toFixed(0)}%</span>
    </div>
  );
}

/* ---------- Bits ---------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">{children}</h2>;
}

function Missing() {
  return <span className="text-muted-foreground/60">—</span>;
}

/** Group daily total across spas, for the hero trend. A day with no figures at all stays missing. */
function groupTrend(spas: SpaSummary[]): Array<{ date: string; revenue: number | null }> {
  if (spas.length === 0) return [];
  return spas[0].sparklineData.map((point, index) => {
    const values = spas.map((spa) => spa.sparklineData[index]?.revenue ?? null).filter((v): v is number => v !== null);
    return { date: point.date, revenue: values.length ? values.reduce((a, b) => a + b, 0) : null };
  });
}

/** Trent works from Bangkok; greet and date in that zone, not the server's. */
function timeOfDay(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Bangkok" }).format(now));
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function longDate(now: Date): string {
  return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" });
}

function shortDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
