import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/safe-next";
import { authMode, currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (authMode() !== "local") redirect("/");
  const next = safeNext((await searchParams).next);
  const member = await currentMember().catch(() => null);
  if (member) redirect(next);
  return (
    <AuthCard title="Mandara AI" subtitle="Sign in to continue">
      <LoginForm next={next} />
      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Forgot your password? Ask your administrator to reset it.</p>
    </AuthCard>
  );
}
