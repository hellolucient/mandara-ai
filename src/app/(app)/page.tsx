import { WorldClocks } from "@/components/world-clocks";
import { Sparkline } from "@/components/sparkline";
import { currentMember } from "@/lib/session";
import { calculateHomeKPIs, getSpaSummaries } from "@/lib/home-kpis";
import Link from "next/link";

export const dynamic = "force-dynamic";

const APP_LINKS = [
  { label: "Mandara AI", url: "/chat", icon: "💬" },
  { label: "Outlook", url: "https://outlook.office.com/mail/", icon: "📧" },
  { label: "Calendar", url: "https://outlook.office.com/calendar/", icon: "📅" },
  { label: "Teams", url: "https://teams.microsoft.com", icon: "👥" },
  { label: "OneDrive", url: "https://www.office.com/onedrive", icon: "📁" },
  { label: "Office", url: "https://www.office.com", icon: "📄" },
];

export default async function HomePage() {
  const member = await currentMember();
  if (!member) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <p className="text-muted-foreground">Not signed in</p>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const [kpis, spas] = await Promise.all([
    calculateHomeKPIs(member.stage, today),
    getSpaSummaries(member.stage, today),
  ]);

  const firstName = member.name?.split(" ")[0] || "there";
  const greeting = `Good ${getTimeOfDay()}, ${firstName}`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl text-primary mb-4">{greeting}</h1>
        <WorldClocks />
      </div>

      {/* KPI Strip */}
      {kpis ? (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg text-muted-foreground">Performance Overview</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Latest data:</span>
              <span className="font-medium">{formatDate(kpis.latestDate)}</span>
              {kpis.isStale && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  Data is {Math.floor((Date.parse(today) - Date.parse(kpis.latestDate)) / (1000 * 60 * 60 * 24))} days old
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <KpiCard
              label="Latest Day Revenue"
              value={formatCurrency(kpis.latestRevenue, kpis.currency)}
            />
            <KpiCard
              label="Month-to-Date Revenue"
              value={formatCurrency(kpis.mtdRevenue, kpis.currency)}
            />
            <KpiCard
              label="Guests (MTD)"
              value={kpis.mtdTreatments.toLocaleString()}
            />
            <KpiCard
              label="Avg Spend / Guest"
              value={kpis.avgSpendPerGuest ? formatCurrency(kpis.avgSpendPerGuest, kpis.currency) : "—"}
            />
            <KpiCard
              label="Retail Share"
              value={kpis.retailShare ? `${kpis.retailShare.toFixed(1)}%` : "—"}
            />
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-8 text-center">
          <p className="text-muted-foreground">No sales data available yet</p>
        </div>
      )}

      {/* Spa Table */}
      {spas.length > 0 && (
        <div className="mb-8">
          <h2 className="font-heading text-lg text-muted-foreground mb-3">Performance by Spa</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-2 font-medium">Spa</th>
                  <th className="pb-2 font-medium text-right">Latest Day</th>
                  <th className="pb-2 font-medium text-right">Month-to-Date</th>
                  <th className="pb-2 font-medium text-center">vs Budget to date</th>
                  <th className="pb-2 font-medium">Last 14 Days</th>
                </tr>
              </thead>
              <tbody>
                {spas.map((spa) => (
                  <tr key={spa.locationId} className="border-b last:border-0">
                    <td className="py-3 font-medium">{spa.locationName}</td>
                    <td className="py-3 text-right tabular-nums">
                      {spa.latestRevenue !== null ? formatCurrency(spa.latestRevenue, kpis?.currency || "USD") : "—"}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatCurrency(spa.mtdRevenue, kpis?.currency || "USD")}
                    </td>
                    <td className="py-3 text-center">
                      {spa.budgetPercent !== null ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            spa.budgetPercent >= 100
                              ? "bg-green-100 text-green-800"
                              : spa.budgetPercent >= 80
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {spa.budgetPercent.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Sparkline data={spa.sparklineData} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ask Mandara AI */}
      <div className="mb-8">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-heading text-xl mb-4">Ask Mandara AI</h2>
          <form action="/chat" method="get" className="space-y-4">
            <input
              type="text"
              name="q"
              placeholder="What would you like to know?"
              className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" value="mandara" defaultChecked className="text-primary" />
                <span>Mandara</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" value="general" className="text-primary" />
                <span>General</span>
              </label>
              <button
                type="submit"
                className="ml-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Start Conversation
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Apps Grid */}
      <div>
        <h2 className="font-heading text-lg text-muted-foreground mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {APP_LINKS.map((link) => (
            <Link
              key={link.url}
              href={link.url}
              target={link.url.startsWith("http") ? "_blank" : undefined}
              rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
              className="flex flex-col items-center justify-center rounded-lg border bg-card p-6 transition-colors hover:bg-accent"
            >
              <span className="text-3xl mb-2">{link.icon}</span>
              <span className="text-sm font-medium text-center">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
