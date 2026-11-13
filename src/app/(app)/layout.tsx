import { Shell, SignedOut } from "@/components/shell";
import { getSettings } from "@/lib/settings";
import { currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let member;
  try {
    member = await currentMember();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("mandara records:", message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://redacted"));
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
        <p className="font-heading text-3xl">Mandara AI cannot open its records.</p>
        <p className="mt-3 text-muted-foreground">The database did not respond. Try again in a moment.</p>
      </main>
    );
  }
  if (!member) return <SignedOut />;
  const settings = await getSettings(member.stage);
  return (
    <Shell member={member} companyName={settings.companyName}>
      {children}
    </Shell>
  );
}
