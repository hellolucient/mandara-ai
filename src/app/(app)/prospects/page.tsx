import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { ProspectImportDialog } from "@/components/prospects/import-dialog";
import { ProspectsBrowser, type ProspectListItem } from "@/components/prospects/prospects-browser";
import { canSeeProspects } from "@/lib/prospects-access";
import { listProspects } from "@/lib/prospects-store";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const member = await currentMember();
  if (!member) redirect("/");
  if (!canSeeProspects(member.role)) notFound();
  const prospects = await listProspects(member);
  const items: ProspectListItem[] = prospects.map((p) => ({
    id: p.id,
    name: p.name,
    propertyType: p.propertyType,
    atoll: p.atoll,
    brandGroup: p.brandGroup,
    spaOperator: p.spaOperator,
    spaName: p.spaName,
    priority: p.priority,
    status: p.status,
    timing: p.timing,
    timingDate: p.timingDate,
    estFee: p.estFee,
    keys: p.keys,
    gmName: p.gmName,
    updatedAt: p.updatedAt,
    latestSignal: p.latestSignal,
  }));

  return (
    <main className="mx-auto max-w-[1200px] px-5 pt-8 pb-16 md:px-10 md:pt-12">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
            <Lock className="size-3" strokeWidth={2} /> Administrators only
          </p>
          <h1 className="mt-2 font-heading text-[34px] leading-[1.1] font-normal tracking-[-0.01em] text-primary md:text-[44px]">
            Prospects
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-6 text-muted-foreground">
            Resorts we could win, from the resort intel workbook. Current clients are left out.
          </p>
        </div>
        <ProspectImportDialog />
      </header>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-black/[0.06] bg-card px-6 py-12 text-center shadow-[0_1px_2px_rgba(20,40,35,0.04)]">
          <p className="font-heading text-2xl">No prospects yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-muted-foreground">
            Use Import workbook and choose the prospects JSON built from the resort intel workbook.
          </p>
        </div>
      ) : (
        <ProspectsBrowser prospects={items} />
      )}
    </main>
  );
}
