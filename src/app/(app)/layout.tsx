import { Shell, SignedOut } from "@/components/shell";
import { hasAdministrator } from "@/lib/members";
import { getSettings } from "@/lib/settings";
import { authMode, currentMember } from "@/lib/session";
import { pageAllowed } from "@/lib/access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
  const local = authMode() === "local";
  const path = (await headers()).get("x-mandara-path") || "/";
  if (!member) {
    if (local) redirect(path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`);
    return <SignedOut />;
  }
  if (local && "mustChangePassword" in member && member.mustChangePassword) redirect("/account/password");
  if (!pageAllowed(member, path)) redirect("/chat");
  const [settings, needsOwner] = await Promise.all([
    getSettings(member.stage),
    member.role === "admin" ? Promise.resolve(false) : hasAdministrator(member.stage).then((found) => !found),
  ]);
  return (
    <Shell member={member} companyName={settings.companyName} needsOwner={needsOwner && !local} localAuth={local}>
      {children}
    </Shell>
  );
}
