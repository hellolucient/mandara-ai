"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Radar, Search, X } from "lucide-react";
import { cn } from "cn";
import { PriorityBadge, StatusDot, StatusPill, SignalTypeTag } from "@/components/prospects/badges";
import {
  PROSPECT_STATUSES,
  STATUS_LABELS,
  type Priority,
  type ProspectStatus,
  type SignalType,
} from "@/lib/prospects-types";
import { atollGroup, matchesPriority, type PriorityFilter } from "@/lib/prospects-format";

export type ProspectListItem = {
  id: string;
  name: string;
  propertyType: string;
  atoll: string;
  brandGroup: string;
  spaOperator: string;
  spaName: string;
  priority: Priority;
  status: ProspectStatus;
  timing: string;
  timingDate: string | null;
  estFee: number | null;
  keys: number | null;
  gmName: string;
  updatedAt: string;
  latestSignal: { date: string; type: SignalType; summary: string } | null;
};

type StageFilter = "active" | "all" | ProspectStatus;
type Sort = "priority" | "timing" | "fee" | "name" | "updated";

const PRIORITY_ORDER: Record<Priority, number> = { A: 0, B: 1, C: 2, X: 3, "": 4 };
const STATUS_ORDER: Record<ProspectStatus, number> = {
  proposal: 0,
  in_talks: 1,
  ready: 2,
  researching: 3,
  watching: 4,
  won: 5,
  lost: 6,
};

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "priority", label: "Priority" },
  { value: "timing", label: "Timing" },
  { value: "fee", label: "Est. fee" },
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name" },
];

export function ProspectsBrowser({ prospects }: { prospects: ProspectListItem[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("active");
  const [atoll, setAtoll] = useState("");
  const [group, setGroup] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("");
  const [sort, setSort] = useState<Sort>("priority");

  // Stage counts follow the priority filter, so excluded (X) prospects are left out by default. All always counts everything.
  const counted = useMemo(() => prospects.filter((p) => matchesPriority(p.priority, priority, "")), [prospects, priority]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s, 0])) as Record<ProspectStatus, number>;
    for (const p of counted) c[p.status] += 1;
    return c;
  }, [counted]);
  const activeCount = counted.length - counts.won - counts.lost;
  const excludedCount = useMemo(() => prospects.filter((p) => p.priority === "X").length, [prospects]);

  const atolls = useMemo(() => options(prospects.map((p) => atollGroup(p.atoll))), [prospects]);
  const groups = useMemo(() => options(prospects.map((p) => p.brandGroup)), [prospects]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = prospects.filter((p) => {
      if (stage === "active" && (p.status === "won" || p.status === "lost")) return false;
      if (stage !== "active" && stage !== "all" && p.status !== stage) return false;
      if (atoll && atollGroup(p.atoll) !== atoll) return false;
      if (group && p.brandGroup !== group) return false;
      if (!matchesPriority(p.priority, priority, stage)) return false;
      if (q) {
        const hay = `${p.name} ${p.atoll} ${p.brandGroup} ${p.spaOperator} ${p.spaName} ${p.gmName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const byName = (a: ProspectListItem, b: ProspectListItem) => a.name.localeCompare(b.name);
    list.sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt) || byName(a, b);
      if (sort === "fee") return (b.estFee ?? -1) - (a.estFee ?? -1) || byName(a, b);
      if (sort === "timing") {
        if (a.timingDate && b.timingDate) return a.timingDate.localeCompare(b.timingDate) || byName(a, b);
        if (a.timingDate) return -1;
        if (b.timingDate) return 1;
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || byName(a, b);
      }
      return (
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (b.estFee ?? -1) - (a.estFee ?? -1) ||
        byName(a, b)
      );
    });
    return list;
  }, [prospects, query, stage, atoll, group, priority, sort]);

  const filtered = query || atoll || group || priority || stage !== "active";

  return (
    <div className="mt-8">
      {/* Stage strip */}
      <div className="-mx-5 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        <div role="tablist" aria-label="Stage" className="flex min-w-max gap-1.5">
          <StageChip active={stage === "active"} onClick={() => setStage("active")} label="Active" count={activeCount} />
          {PROSPECT_STATUSES.map((s) => (
            <StageChip
              key={s}
              active={stage === s}
              onClick={() => setStage(s)}
              label={STATUS_LABELS[s]}
              count={counts[s]}
              status={s}
            />
          ))}
          <StageChip active={stage === "all"} onClick={() => setStage("all")} label="All" count={prospects.length} />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
        <label className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 transition-shadow focus-within:border-primary/40 focus-within:shadow-[0_0_0_4px_rgba(40,90,85,0.08)]">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resort, group, spa operator or GM"
            aria-label="Search prospects"
            className="h-10 min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground/70 focus:outline-none"
          />
          {query ? (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </label>
        <div className="grid grid-cols-2 gap-2.5 md:contents">
          <Select label="Atoll" value={atoll} onChange={setAtoll} options={atolls} all="All atolls" />
          <Select label="Group" value={group} onChange={setGroup} options={groups} all="All groups" />
          <Select
            label="Priority"
            value={priority}
            onChange={(v) => setPriority(v as PriorityFilter)}
            options={[
              ["any", "All, incl. excluded"],
              ["AB", "A and B"],
              ["A", "A · in play"],
              ["B", "B · possible"],
              ["C", "C · occupied"],
              ["X", "X · excluded"],
            ]}
            all="Hide excluded (X)"
          />
          <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS.map((s): [string, string] => [s.value, s.label])} prefix="Sort: " />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted-foreground">
        <span>
          {shown.length} of {prospects.length} prospects
          {priority === "" && stage !== "all" && excludedCount > 0 ? (
            <>
              {" · "}
              {excludedCount} excluded (X) hidden{" · "}
              <button type="button" className="text-primary hover:underline" onClick={() => setPriority("any")}>
                Show
              </button>
            </>
          ) : null}
        </span>
        {filtered ? (
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => {
              setQuery("");
              setAtoll("");
              setGroup("");
              setPriority("");
              setStage("active");
            }}
          >
            Reset filters
          </button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-black/[0.06] bg-card px-6 py-12 text-center text-[14px] text-muted-foreground">
          No prospects match these filters.
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:block">
            <table className="w-full table-fixed border-collapse text-[14px]">
              <colgroup>
                <col className="w-[52px]" />
                <col />
                <col className="w-[13%]" />
                <col className="w-[17%]" />
                <col className="w-[150px]" />
                <col className="w-[19%]" />
                <col className="w-[32px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                  <th className="py-3 pl-5 font-medium" aria-label="Priority" />
                  <th className="px-3 py-3 font-medium">Prospect</th>
                  <th className="px-3 py-3 font-medium">Atoll</th>
                  <th className="px-3 py-3 font-medium">Spa today</th>
                  <th className="px-3 py-3 font-medium">Stage</th>
                  <th className="px-3 py-3 font-medium">Timing · signal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="group relative border-b border-black/[0.045] transition-colors last:border-0 hover:bg-primary/[0.03]">
                    <td className="py-3.5 pl-5 align-top">
                      <PriorityBadge priority={p.priority} />
                    </td>
                    <td className="min-w-0 px-3 py-3.5 align-top">
                      <Link href={`/prospects/${p.id}`} className="block truncate font-medium text-foreground after:absolute after:inset-0 group-hover:text-primary">
                        {p.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                        {[p.brandGroup, p.keys ? `${p.keys} keys` : ""].filter(Boolean).join(" · ") || p.propertyType}
                      </p>
                    </td>
                    <td className="truncate px-3 py-3.5 align-top text-[13px] text-muted-foreground">{atollGroup(p.atoll) || "—"}</td>
                    <td className="px-3 py-3.5 align-top">
                      <p className="truncate text-[13px] text-foreground/85">{p.spaOperator || p.spaName || "—"}</p>
                      {p.spaOperator && p.spaName && p.spaName !== p.spaOperator ? (
                        <p className="truncate text-[12px] text-muted-foreground">{p.spaName}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="px-3 py-3.5 align-top text-[13px]">
                      {p.latestSignal ? (
                        <p className="flex items-center gap-1.5 truncate">
                          <SignalTypeTag type={p.latestSignal.type} />
                          <span className="truncate text-foreground/85">{p.latestSignal.summary}</span>
                        </p>
                      ) : null}
                      {p.timing ? (
                        <p className={cn("truncate text-muted-foreground", p.latestSignal && "mt-1 text-[12px]")} title={p.timing}>
                          {p.timing}
                        </p>
                      ) : p.latestSignal ? null : (
                        <p className="text-muted-foreground/40">—</p>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 align-top">
                      <ChevronRight aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground/40 group-hover:text-primary" strokeWidth={1.75} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <ul className="mt-3 divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(20,40,35,0.04)] md:hidden">
            {shown.map((p) => (
              <li key={p.id}>
                <Link href={`/prospects/${p.id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-primary/[0.04]">
                  <span className="pt-px">
                    <PriorityBadge priority={p.priority} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-[14.5px] leading-snug font-medium text-foreground">{p.name}</p>
                      <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" strokeWidth={1.75} />
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                      {[atollGroup(p.atoll), p.spaOperator || p.spaName].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <StatusPill status={p.status} />
                      {p.timing ? <span className="truncate text-[12px] text-muted-foreground">{p.timing}</span> : null}
                    </div>
                    {p.latestSignal ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[12.5px]">
                        <SignalTypeTag type={p.latestSignal.type} />
                        <span className="truncate">{p.latestSignal.summary}</span>
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {prospects.length > 0 && counts.watching === prospects.length ? (
        <p className="mt-4 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Radar className="size-3.5" strokeWidth={1.75} /> Everything starts on Watching. Move a prospect along from its page.
        </p>
      ) : null}
    </div>
  );
}

function StageChip({
  active,
  onClick,
  label,
  count,
  status,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  status?: ProspectStatus;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-black/[0.07] bg-card text-foreground/80 hover:border-primary/25 hover:text-primary",
        !active && count === 0 && "text-muted-foreground/70",
      )}
    >
      {status ? <StatusDot status={status} className={active ? "bg-primary-foreground/80" : undefined} /> : null}
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/70" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  all,
  prefix = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]> | string[];
  all?: string;
  prefix?: string;
}) {
  const pairs: Array<[string, string]> = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-[42px] min-w-0 rounded-xl border border-input bg-card px-3 pr-8 text-[13.5px] text-foreground focus:border-primary/40 focus:outline-none md:max-w-[200px]",
        value && all ? "border-primary/30 text-primary" : "",
      )}
    >
      {all ? <option value="">{all}</option> : null}
      {pairs.map(([v, l]) => (
        <option key={v} value={v}>
          {prefix}
          {l}
        </option>
      ))}
    </select>
  );
}

function options(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
