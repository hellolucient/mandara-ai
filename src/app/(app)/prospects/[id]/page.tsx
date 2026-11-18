import { LeadStatusTag } from "@/components/prospects/prospects-browser";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, Flower2, Link2, NotebookPen, Radar, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PriorityBadge, SignalTypeTag, StatusPill } from "@/components/prospects/badges";
import { NoteForm, SignalForm, StageControl } from "@/components/prospects/prospect-actions";
import { canSeeProspects } from "@/lib/prospects-access";
import { atollGroup, formatDay, formatUsd, hostOf, shortUrl } from "@/lib/prospects-format";
import { getProspect } from "@/lib/prospects-store";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await currentMember();
  if (!member) redirect("/");
  if (!canSeeProspects(member.role)) notFound();
  const { id } = await params;
  const found = await getProspect(member, id);
  if (!found) notFound();
  const { prospect: p, notes, signals } = found;
  const atoll = atollGroup(p.atoll);
  const where = [p.atoll && atoll !== p.atoll ? `${atoll} · ${p.atoll}` : p.atoll, p.propertyType, p.keys ? `${p.keys} keys` : "", p.tier]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-[1200px] px-5 pt-6 pb-16 md:px-10 md:pt-10">
      <Link href="/prospects" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3.5" strokeWidth={1.75} /> Prospects
      </Link>

      <header className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <PriorityBadge priority={p.priority} withLabel />
            <StatusPill status={p.status} />
            {p.leadStatus ? <LeadStatusTag status={p.leadStatus} /> : null}
          </div>
          <h1 className="mt-3 font-heading text-[30px] leading-[1.12] font-normal tracking-[-0.01em] text-primary md:text-[40px]">{p.name}</h1>
          {where ? <p className="mt-2 text-[14px] text-muted-foreground">{where}</p> : null}
        </div>
        <StageControl id={p.id} status={p.status} />
      </header>

      {p.verdict || p.timing ? (
        <section className="mt-6 grid gap-3 md:grid-cols-2">
          {p.verdict ? <Callout label="Verdict" text={p.verdict} wide={!p.timing} /> : null}
          {p.timing ? <Callout label="Timing" text={p.timing} wide={!p.verdict} /> : null}
        </section>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Card icon={UserRound} title="Who to approach">
            <Facts
              rows={[
                ["General manager", [p.gmName, p.gmSince ? `since ${p.gmSince}` : ""].filter(Boolean).join(", ")],
                ["GM background", p.gmBackground],
                ["Spa manager", p.spaManager],
                ["Angles in", p.approach],
                ["Owner and directors", p.ownerLinks],
              ]}
            />
          </Card>
          {p.jcNotes ? (
            <Card icon={UserRound} title="JC notes and contacts">
              <p className="text-[14px] leading-6 whitespace-pre-line break-words">{p.jcNotes}</p>
              <p className="mt-3 text-[12px] text-muted-foreground">Administrators only. Never sent to the chat assistant.</p>
            </Card>
          ) : null}
          <Card icon={Flower2} title="The spa today">
            <Facts
              rows={[
                ["Spa", p.spaName],
                ["Operator", p.spaOperator],
                ["Model", p.spaModel],
                ["Run by", p.spaManagedBy],
                ["Mandara history", p.mandaraHistory],
              ]}
            />
          </Card>
          <Card icon={NotebookPen} title="Notes">
            <NoteForm id={p.id} />
            {notes.length ? (
              <ol className="mt-5 space-y-4 border-l border-black/[0.08] pl-4">
                {notes.map((n) => (
                  <li key={n.id} className="relative">
                    <span aria-hidden="true" className="absolute top-1.5 -left-[21px] size-2 rounded-full border-2 border-card bg-primary/60" />
                    <p className="text-[12px] text-muted-foreground">
                      {formatDay(n.date)}
                      {n.author ? ` · ${n.author}` : ""}
                    </p>
                    <p className="mt-0.5 text-[14px] leading-6 whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-[13px] text-muted-foreground">No notes yet. Stage changes are noted here too.</p>
            )}
          </Card>
          {p.notes || p.confidence ? (
            <Card icon={Building2} title="Research">
              <Facts
                rows={[
                  ["Opportunity", p.notes],
                  ["Confidence and gaps", p.confidence],
                  ["Researched", formatDay(p.intelDate)],
                ]}
              />
            </Card>
          ) : null}
        </div>

        <div className="space-y-5 lg:col-span-4">
          <Card icon={Radar} title="Signals" action={<span className="text-[12px] text-muted-foreground tabular-nums">{signals.length}</span>}>
            {signals.length ? (
              <ul className="mb-4 space-y-3.5">
                {signals.map((s) => (
                  <li key={s.id}>
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <SignalTypeTag type={s.type} />
                      {formatDay(s.date)}
                    </div>
                    <p className="mt-1 text-[14px] leading-snug">{s.summary}</p>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] text-primary hover:underline">
                        {hostOf(s.url)} <ArrowUpRight className="size-3" strokeWidth={1.75} />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-[13px] leading-5 text-muted-foreground">
                No signals yet. News, spa job ads, new GMs and developments land here as reasons to reach out.
              </p>
            )}
            <SignalForm id={p.id} />
          </Card>

          <Card icon={Building2} title="Property">
            <Facts
              compact
              rows={[
                ["Owner company", p.ownerCompany],
                ["Management", p.managementCompany],
                ["Brand / group", p.brandGroup],
                ["Keys", p.keys ? String(p.keys) : ""],
                ["Est. spa revenue / yr", p.estSpaRevenue != null ? `${formatUsd(p.estSpaRevenue)} (estimate)` : ""],
                ["Est. Mandara fee / yr", p.estFee != null ? `${formatUsd(p.estFee)} (estimate)` : ""],
              ]}
            />
          </Card>

          {p.sources.length ? (
            <Card icon={Link2} title="Sources">
              <ul className="space-y-1.5">
                {p.sources.map((url) => (
                  <li key={url} className="min-w-0">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[13px] text-primary hover:underline">
                      <span className="truncate">{shortUrl(url)}</span>
                      <ArrowUpRight className="size-3 shrink-0" strokeWidth={1.75} />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Card({ icon: Icon, title, action, children }: { icon: LucideIcon; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-heading text-[19px] font-normal text-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
            <Icon className="size-4" strokeWidth={1.6} />
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Facts({ rows, compact = false }: { rows: Array<[string, string]>; compact?: boolean }) {
  const shown = rows.filter(([, value]) => value && value.trim() && !/^(not (found|identified|retrieved)\.?|n\/a)$/i.test(value.trim()));
  if (shown.length === 0) return <p className="text-[13px] text-muted-foreground">Nothing recorded yet.</p>;
  return (
    <dl className={compact ? "space-y-3" : "divide-y divide-black/[0.05]"}>
      {shown.map(([label, value]) => (
        <div key={label} className={compact ? "" : "grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[160px_1fr] sm:gap-4"}>
          <dt className="text-[12px] font-medium tracking-wide text-muted-foreground">{label}</dt>
          <dd className="text-[14px] leading-6 break-words whitespace-pre-line text-foreground/90">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Callout({ label, text, wide }: { label: string; text: string; wide: boolean }) {
  // The workbook joins its verdict and Trent's later calls with " | ". Show each on its own line.
  const parts = text.split(/\s+\|\s+/).filter(Boolean);
  return (
    <div className={`rounded-2xl border border-primary/10 bg-primary/[0.04] px-5 py-4 ${wide ? "md:col-span-2" : ""}`}>
      <p className="text-[11px] font-medium tracking-[0.18em] text-primary/70 uppercase">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {parts.map((part) => (
          <li key={part} className="text-[14px] leading-6 text-foreground/90">
            {part}
          </li>
        ))}
      </ul>
    </div>
  );
}
