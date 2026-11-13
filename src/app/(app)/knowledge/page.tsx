import { DeleteDocument, KnowledgeManager } from "@/components/knowledge-manager";
import { Badge } from "@/components/ui/badge";
import { formatMaldives } from "@/lib/dates";
import { listDocuments } from "@/lib/knowledge";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const member = await currentMember();
  if (!member) redirect("/");
  const documents = await listDocuments(member.stage, member.role);
  const privileged = member.role !== "staff";
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 md:grid-cols-[280px_1fr] md:px-8">
      <section>
        <h1 className="font-heading text-3xl">Knowledge</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Documents uploaded here are searched when someone asks about company information. Answers name the source. Sample files are labeled and are not live Mandara records.
        </p>
        <div className="mt-5">
          <KnowledgeManager canRestrict={privileged} canDelete={member.role === "admin"} />
        </div>
      </section>
      <section className="space-y-3">
        {documents.length === 0 ? (
          <p className="rounded-xl border bg-card px-4 py-6 text-sm">No documents yet.</p>
        ) : (
          documents.map((document) => (
            <article key={document.id} className="rounded-xl border bg-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base">{document.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {document.filename} · {document.visibility === "restricted" ? "Managers and administrators" : "All staff"} · {formatMaldives(document.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {document.sample ? <Badge variant="secondary">Sample</Badge> : null}
                  {member.role === "admin" || document.uploaded_by === member.sub ? <DeleteDocument id={document.id} /> : null}
                </div>
              </div>
            </article>
          ))
        )}
        {member.role === "staff" ? (
          <p className="text-sm text-muted-foreground">Restricted documents are hidden from this role, including in answers.</p>
        ) : null}
      </section>
    </main>
  );
}
