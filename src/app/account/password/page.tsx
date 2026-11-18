import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordForm } from "@/components/auth/login-form";
import { authMode, currentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  if (authMode() !== "local") redirect("/");
  const member = await currentMember();
  if (!member) redirect("/login");
  const required = "mustChangePassword" in member && Boolean(member.mustChangePassword);
  return (
    <AuthCard
      title={required ? "Welcome" : "Password"}
      subtitle={required ? "Choose your own password to finish signing in." : "Change your Mandara AI password."}
    >
      <PasswordForm required={required} />
      {!required ? (
        <p className="mt-4 text-center text-sm">
          <Link href="/" className="text-muted-foreground underline-offset-4 hover:underline">
            Back
          </Link>
        </p>
      ) : null}
    </AuthCard>
  );
}
