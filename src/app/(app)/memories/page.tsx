import { getMemories } from "@/lib/memory";
import { currentMember } from "@/lib/session";
import { redirect } from "next/navigation";
import { MemoryList } from "@/components/memory-list";

export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const member = await currentMember();
  if (!member) redirect("/");
  
  const memories = await getMemories(member.stage, member.sub);
  
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8">
      <div>
        <h1 className="font-heading text-3xl">My Memories</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          These are facts and preferences you&apos;ve told me to remember. They&apos;re included in all your chats so I can recall them when needed.
          The most recent 30 memories are kept.
        </p>
      </div>
      
      <MemoryList initialMemories={memories} />
      
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium">How to add memories:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Say &quot;Remember that...&quot; or &quot;Don&apos;t forget...&quot;</li>
          <li>State preferences: &quot;My favourite treatment is...&quot;</li>
          <li>Share personal facts: &quot;I&apos;m Trent. I run Mandara Spa Maldives.&quot;</li>
        </ul>
      </div>
    </main>
  );
}
