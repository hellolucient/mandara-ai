import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SignedOut } from "@/components/shell";
import { PrintControls } from "@/components/print-controls";
import { addDays, businessToday, formatBusinessDate, formatMaldives, money } from "@/lib/dates";
import { buildSalesReport, type SalesReport } from "@/lib/sales-report";
import { loadDays } from "@/lib/sales-store";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ date?: string }> }): Promise<Metadata> {
  const { date } = await searchParams;
  // The browser uses the title as the suggested PDF file name.
  return { title: `Mandara daily sales report ${date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""}`.trim() };
}

/** Printable management report. Same access as the Sales page: any signed-in member of the workspace. */
export default async function SalesReportPrint({ searchParams }: { searchParams: Promise<{ date?: string; print?: string }> }) {
  const member = await currentMember();
  if (!member) return <SignedOut />;
  if (member.chatOnly && member.role !== "admin") redirect("/chat");
  if ("mustChangePassword" in member && member.mustChangePassword) redirect("/account/password");
  const query = await searchParams;
  const days = await loadDays(member.stage);
  const requested = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : addDays(businessToday(), -1);
  const day = days.find((item) => item.businessDate === requested) ?? days.at(-1) ?? null;
  const backHref = day ? `/sales?date=${day.businessDate}` : "/sales";

  return (
    <div className="min-h-screen bg-[#e9e6df] print:bg-white">
      <style>{PRINT_CSS}</style>
      <PrintControls auto={query.print === "1" && day != null} backHref={backHref} />
      <article className="report mx-auto mb-10 w-[210mm] max-w-full bg-white px-[14mm] py-[12mm] text-[#21302e] shadow-[0_2px_24px_rgba(20,40,35,0.12)] print:m-0 print:w-auto print:p-0 print:shadow-none">
        {day ? <Report report={buildSalesReport(day, days)} /> : <p className="py-20 text-center">No sales records are stored yet.</p>}
      </article>
    </div>
  );
}

const PRINT_CSS = `
@page { size: A4; margin: 12mm 13mm 14mm; }
@media print {
  html, body { background: #fff !important; }
  .report { font-size: 10pt; }
  .report table { page-break-inside: auto; }
  .report tr, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .report thead { display: table-header-group; }
}
.report { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.report-stat-value { overflow: visible; font-variant-numeric: tabular-nums; }
/* Narrow phones (portrait). Print and landscape/desktop keep the A4 layout. */
@media screen and (max-width: 639px) {
  .report {
    padding: 1.25rem 0.75rem !important;
  }
  .report-header { gap: 0.75rem; }
  .report-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .report-kpis > * { min-width: 0; }
  .report-compares {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  .report-stat-value {
    font-size: 1.125rem;
    line-height: 1.2;
    white-space: nowrap;
    overflow: visible;
  }
  .report-stat-note { overflow-wrap: anywhere; }
  .report-change {
    display: block;
    margin-left: 0;
    margin-top: 1px;
  }
  .report-table {
    font-size: 9.5px;
  }
  .report-table th,
  .report-table td {
    padding-left: 0.2rem;
    padding-right: 0.2rem;
    vertical-align: top;
  }
  .report-table th:first-child,
  .report-table td:first-child { padding-left: 0; }
  .report-table th:last-child,
  .report-table td:last-child { padding-right: 0; }
  .report-table th {
    letter-spacing: 0.06em;
    font-size: 8px;
    line-height: 1.2;
  }
  .report-table th[data-short] .label-full { display: none; }
  .report-table th[data-short]::after { content: attr(data-short); }
  .report-num { white-space: nowrap; }
  .report-spa { overflow-wrap: break-word; }
  .report-var-pct {
    display: block;
    margin-left: 0;
  }
  .report-footer {
    flex-direction: column;
    gap: 0.15rem;
  }
}
`;

function Report({ report: r }: { report: SalesReport }) {
  const c = r.currency;
  const m = (v: number | null) => (v == null ? "—" : money(v, c));
  const signed = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${money(Math.abs(v), c)}`);
  const pct = (v: number | null) => (v == null ? "" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);
  const tone = (v: number | null) => (v == null ? "" : v >= 0 ? "text-[#1f5c55]" : "text-[#a65a2b]");
  const t = r.totals;
  const generated = formatMaldives(new Date());

  return (
    <>
      <header className="report-header flex items-start justify-between gap-6 border-b-2 border-[#1f4f4a] pb-4">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 32 32" aria-hidden="true" className="size-9 text-[#1f4f4a]">
            <circle cx="16" cy="16" r="3.2" fill="currentColor" />
            <path
              d="M16 4.5c1.4 3.6 1.4 6.1 0 8.2-1.4-2.1-1.4-4.6 0-8.2Zm0 23c-1.4-3.6-1.4-6.1 0-8.2 1.4 2.1 1.4 4.6 0 8.2ZM4.5 16c3.6-1.4 6.1-1.4 8.2 0-2.1 1.4-4.6 1.4-8.2 0Zm23 0c-3.6 1.4-6.1 1.4-8.2 0 2.1-1.4 4.6-1.4 8.2 0Z"
              fill="currentColor"
            />
          </svg>
          <div>
            <p className="font-heading text-[22px] leading-none text-[#1f4f4a]">Mandara</p>
            <p className="mt-1 text-[9.5px] tracking-[0.22em] text-[#5b6e6b] uppercase">Spa Maldives</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[9.5px] font-medium tracking-[0.2em] text-[#5b6e6b] uppercase">Daily sales report</p>
          <p className="mt-1 font-heading text-[20px] leading-tight">{formatBusinessDate(r.businessDate)}</p>
          <p className="mt-0.5 text-[11px] text-[#5b6e6b]">{weekday(r.businessDate)}</p>
        </div>
      </header>

      <p className="mt-3 text-[11px] text-[#5b6e6b]">
        Source: {r.source === "Steiners DSR (imported)" ? "Steiners DSR" : r.source} · Currency {c} · Net sales are total revenue, guests are
        treatment guests, budget is that day&apos;s forecast.
        {r.sample ? " Sample figures, not from the DSR." : ""}
      </p>

      <section className="report-kpis avoid-break mt-5 grid grid-cols-4 gap-2.5">
        <Stat label="Net sales" value={m(t.netSales)} note={`${t.locations} spa${t.locations === 1 ? "" : "s"} reporting`} strong />
        <Stat
          label="vs budget"
          value={signed(t.variance)}
          note={t.variancePercent == null ? "No budget stored" : `${pct(t.variancePercent)} on ${m(t.budget)}`}
          valueClass={tone(t.variance)}
        />
        <Stat label="Guests" value={t.guests == null ? "—" : t.guests.toLocaleString("en-US")} note="Treatment guests" />
        <Stat
          label={r.hasRetail ? "Retail" : "Month to date"}
          value={r.hasRetail ? m(t.retailSales) : m(r.monthToDate.netSales)}
          note={r.hasRetail ? (t.retailShare == null ? "" : `${t.retailShare.toFixed(1)}% of net sales`) : `${r.monthToDate.days} days`}
        />
      </section>

      <section className="report-compares avoid-break mt-2.5 grid grid-cols-3 gap-2.5 text-[11px]">
        <Compare label="Previous day" data={r.previousDay} m={m} pct={pct} tone={tone} />
        <Compare label="Same weekday last week" data={r.weekEarlier} m={m} pct={pct} tone={tone} />
        <div className="rounded-lg border border-[#e3e0d8] px-3 py-2">
          <p className="text-[9px] font-medium tracking-[0.16em] text-[#5b6e6b] uppercase">Month to date</p>
          <p className="mt-0.5 text-[12.5px] font-medium tabular-nums">
            <span className="report-num">{m(r.monthToDate.netSales)}</span>
            {r.monthToDate.budgetPercent != null ? (
              <span className="report-change ml-1.5 font-normal text-[#5b6e6b]">{r.monthToDate.budgetPercent.toFixed(0)}% of budget*</span>
            ) : null}
          </p>
          <p className="text-[#5b6e6b]">
            {r.monthToDate.days} day{r.monthToDate.days === 1 ? "" : "s"} recorded
            {r.monthToDate.budgetPercent != null ? " · *spas with a budget" : ""}
          </p>
        </div>
      </section>

      <h2 className="mt-5 font-heading text-[15px] text-[#1f4f4a]">By spa</h2>
      <table className="report-table mt-2 w-full border-collapse text-[11px] tabular-nums">
        <thead>
          <tr className="border-b border-[#1f4f4a]/40 text-left text-[9px] tracking-[0.12em] text-[#5b6e6b] uppercase">
            <th className="py-1.5 pr-2 font-medium">Spa</th>
            <th className="px-2 py-1.5 text-right font-medium" data-short="Sales"><span className="label-full">Net sales</span></th>
            <th className="px-2 py-1.5 text-right font-medium">Budget</th>
            <th className="px-2 py-1.5 text-right font-medium" data-short="Var"><span className="label-full">Variance</span></th>
            <th className="px-2 py-1.5 text-right font-medium" data-short="Guests"><span className="label-full">Guests</span></th>
            {r.hasRetail ? <th className="px-2 py-1.5 text-right font-medium" data-short="Retail"><span className="label-full">Retail</span></th> : null}
            <th className="py-1.5 pl-2 text-right font-medium" data-short="vs wk"><span className="label-full">vs last week</span></th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((line) => (
            <tr key={line.name} className="border-b border-[#ebe8e1]">
              <td className="report-spa py-[5px] pr-2 font-medium">{line.name}</td>
              <td className="report-num px-2 py-[5px] text-right">{line.netSales == null ? <span className="text-[#a65a2b]">Missing</span> : m(line.netSales)}</td>
              <td className="report-num px-2 py-[5px] text-right text-[#5b6e6b]">{m(line.budget)}</td>
              <td className={`report-num px-2 py-[5px] text-right ${tone(line.variance)}`}>
                {signed(line.variance)}
                {line.variancePercent != null ? <span className="report-var-pct ml-1 text-[9.5px] opacity-75">{pct(line.variancePercent)}</span> : null}
              </td>
              <td className="report-num px-2 py-[5px] text-right">{line.guests ?? "—"}</td>
              {r.hasRetail ? <td className="report-num px-2 py-[5px] text-right">{m(line.retailSales)}</td> : null}
              <td className={`report-num py-[5px] pl-2 text-right ${tone(line.weekChange)}`}>{line.weekChange == null ? "—" : pct(line.weekChange)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#1f4f4a]/60 font-semibold">
            <td className="py-1.5 pr-2">Total</td>
            <td className="report-num px-2 py-1.5 text-right">{m(t.netSales)}</td>
            <td className="report-num px-2 py-1.5 text-right">{m(t.budget)}</td>
            <td className={`report-num px-2 py-1.5 text-right ${tone(t.variance)}`}>{signed(t.variance)}</td>
            <td className="report-num px-2 py-1.5 text-right">{t.guests ?? "—"}</td>
            {r.hasRetail ? <td className="report-num px-2 py-1.5 text-right">{m(t.retailSales)}</td> : null}
            <td className={`report-num py-1.5 pl-2 text-right ${tone(r.weekEarlier?.change ?? null)}`}>
              {r.weekEarlier?.change == null ? "—" : pct(r.weekEarlier.change)}
            </td>
          </tr>
        </tfoot>
      </table>
      {t.variance != null && t.budget != null && r.lines.some((line) => line.budget == null) ? (
        <p className="mt-1.5 text-[9.5px] text-[#5b6e6b]">Variance totals only the spas with a budget stored.</p>
      ) : null}

      <section className="avoid-break mt-5">
        <h2 className="font-heading text-[15px] text-[#1f4f4a]">Needs attention</h2>
        {r.attention.length ? (
          <ul className="mt-2 space-y-1 text-[11px]">
            {r.attention.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-[#c2703d]" />
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-[#5b6e6b]">Nothing in the stored figures meets the attention rules.</p>
        )}
        <p className="mt-2 text-[9.5px] text-[#5b6e6b]">
          Rules: a missing figure, a spa below its stored budget, or a drop of 25% or more versus the same weekday last week.
        </p>
      </section>

      {r.note ? <p className="mt-4 text-[10.5px] text-[#5b6e6b]">Note on this day: {r.note}</p> : null}

      <footer className="report-footer mt-5 flex justify-between border-t border-[#e3e0d8] pt-2 text-[9px] text-[#8a9794]">
        <span>Mandara Spa (Maldives) Pvt Ltd · Internal management report</span>
        <span>Generated {generated}</span>
      </footer>
    </>
  );
}

function Stat({ label, value, note, strong, valueClass = "" }: { label: string; value: string; note: string; strong?: boolean; valueClass?: string }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${strong ? "bg-[#1f4f4a] text-white" : "border border-[#e3e0d8]"}`}>
      <p className={`text-[9px] font-medium tracking-[0.16em] uppercase ${strong ? "text-white/70" : "text-[#5b6e6b]"}`}>{label}</p>
      <p className={`report-stat-value mt-1 text-[19px] leading-tight font-medium tabular-nums ${valueClass}`}>{value}</p>
      <p className={`report-stat-note mt-0.5 text-[10px] ${strong ? "text-white/70" : "text-[#5b6e6b]"}`}>{note}</p>
    </div>
  );
}

function Compare({
  label,
  data,
  m,
  pct,
  tone,
}: {
  label: string;
  data: SalesReport["previousDay"];
  m: (v: number | null) => string;
  pct: (v: number | null) => string;
  tone: (v: number | null) => string;
}) {
  return (
    <div className="rounded-lg border border-[#e3e0d8] px-3 py-2">
      <p className="text-[9px] font-medium tracking-[0.16em] text-[#5b6e6b] uppercase">{label}</p>
      {data ? (
        <>
          <p className="mt-0.5 text-[12.5px] font-medium tabular-nums">
            <span className="report-num">{m(data.netSales)}</span>
            {data.change != null ? <span className={`report-change ml-1.5 font-normal ${tone(data.change)}`}>today {pct(data.change)}</span> : null}
          </p>
          <p className="text-[#5b6e6b]">{formatBusinessDate(data.date)}</p>
        </>
      ) : (
        <p className="mt-0.5 text-[#5b6e6b]">No stored record</p>
      )}
    </div>
  );
}

function weekday(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, mo - 1, d)));
}
