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
import { SpaByLocationTable } from "@/components/spa-by-location-table";
import { currentMember } from "@/lib/session";
import { calculateHomeKPIs, getSpaSummaries, type HomeKPIs, type SpaSummary } from "@/lib/home-kpis";
import { AskTile } from "@/components/ask-tile";
import { ProspectsCard } from "@/components/prospects/home-card";
import { canSeePromotions, canSeeQuickAccess } from "@/lib/access";
import { HomePromoCard } from "@/components/home-promo-card";
import { buildHomePromoCardData } from "@/lib/promo-analytics";
import { loadApprovedPromoCodes } from "@/lib/promo-approved-codes";
import { seedPromoBackfill } from "@/lib/promo-backfill-seed";
import { listPromoPeriods, loadAllPromoLines } from "@/lib/promo-store";
import { loadDays } from "@/lib/sales-store";
import { canSeeProspects } from "@/lib/prospects-access";
import { prospectSummary } from "@/lib/prospects-store";
import { canSeeRevenueMix } from "@/lib/revenue-mix-access";
import { RevenueMixHomeLoader } from "@/components/revenue-mix/home-loader";

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
  const showPromo = canSeePromotions(member);

  const [kpis, spas, prospects, promoCard] = await Promise.all([
    calculateHomeKPIs(member.stage, today),
    getSpaSummaries(member.stage, today),
    canSeeProspects(member.role) ? prospectSummary(member) : Promise.resolve(null),
    showPromo
      ? (async () => {
          await seedPromoBackfill(member.stage);
          const [periods, lines, salesDays, approved] = await Promise.all([
            listPromoPeriods(member.stage),
            loadAllPromoLines(member.stage, "treatment"),
            loadDays(member.stage),
            loadApprovedPromoCodes(member.stage),
          ]);
          return buildHomePromoCardData(periods, lines, salesDays, approved);
        })()
      : Promise.resolve(null),
  ]);

  const firstName = member.name?.split(" ")[0] || "there";
  const currency = kpis?.currency || "USD";
  const showApps = canSeeQuickAccess(member);

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

      {promoCard ? <HomePromoCard data={promoCard} /> : null}

      {kpis && canSeeRevenueMix(member.role) ? (
        <RevenueMixHomeLoader stage={member.stage} latestDate={kpis.latestDate} />
      ) : null}

      {/* Ask + apps. Dashboard + chat people get Ask across the full width, without Quick access. */}
      <section className={showApps ? "mt-10 grid gap-5 lg:grid-cols-12" : "mt-10"}>
        <div className={showApps ? "flex flex-col lg:col-span-7" : "flex flex-col"}>
          <SectionTitle>Ask Mandara AI</SectionTitle>
          <AskTile />
        </div>
        {showApps ? (
          <div className="lg:col-span-5">
            <SectionTitle>Quick access</SectionTitle>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {APP_LINKS.map((link) => (
                <AppTile key={link.url} {...link} />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {spas.length > 0 ? (
        <SpaByLocationTable
          spas={spas}
          currency={currency}
          latestDate={kpis?.latestDate ?? spas[0]?.latestDate ?? ""}
          today={today}
        />
      ) : null}

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-[19px] font-normal tracking-[-0.005em] text-foreground">{children}</h2>;
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

