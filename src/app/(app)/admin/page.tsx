import { CompanyProfileForm, InviteForm, RoleSelect, SettingsForm } from "@/components/admin-manager";
import { BudgetForm } from "@/components/budget-form";
import { getCompanyProfile, profileToForm } from "@/lib/company-profile";
import { listInvites, listMembers } from "@/lib/members";
import { integrationStatus } from "@/lib/secrets";
import { currentMember } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { usageSummary } from "@/lib/usage";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const member = await currentMember();
  if (!member) redirect("/");
  if (member.role !== "admin") redirect("/chat");
  const [settings, profile, people, invites, usage, status] = await Promise.all([
    getSettings(member.stage),
    getCompanyProfile(member.stage),
    listMembers(member.stage),
    listInvites(member.stage),
    usageSummary(member.stage),
    Promise.resolve(integrationStatus()),
  ]);
  const company = profileToForm(profile);
  const rows = [
    ["OpenRouter", status.openRouter],
    ["Schedule secret", status.cron],
    ["DSR address", status.dsrUrl],
    ["DSR username", status.dsrUsername],
    ["DSR password", status.dsrPassword],
    ["DSR page map", status.dsrMapReady],
    ["Workspace owner", status.workspaceOwner],
  ] as const;
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8">
      <div>
        <h1 className="font-heading text-3xl">Admin</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          People sign in through the host. Roles here decide what they can see after that. Secrets are never shown.
        </p>
      </div>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border bg-card p-4">
          <h2 className="font-heading text-2xl">Workspace</h2>
          <div className="mt-4">
            <SettingsForm companyName={settings.companyName} model={settings.model} imageModel={settings.imageModel} reasoningModel={settings.reasoningModel} visionModel={settings.visionModel} currency={settings.currency} />
          </div>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <h2 className="font-heading text-2xl">This month&apos;s model use</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {usage.calls} model call{usage.calls === 1 ? "" : "s"}. Reported cost {money(usage.known)}. Estimated, where the gateway did not report a cost: {money(usage.estimated)}.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Sales reports and plain document excerpts do not call a model.</p>
          {usage.byModel.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {usage.byModel.map((row) => (
                <li key={row.model} className="flex justify-between gap-3 border-b pb-2">
                  <span>{row.model}</span>
                  <span>{row.calls} calls</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">No model calls yet this month.</p>
          )}
        </article>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-heading text-2xl">Company profile</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          This starting profile is loaded only while the saved profile is still empty. Edit any field and save. Notes at the bottom stay in Admin and are not shown to the assistant.
        </p>
        <div className="mt-4">
          <CompanyProfileForm
            description={company.description}
            spasText={company.spasText}
            peopleText={company.peopleText}
            contactsText={company.contactsText}
            contractsText={company.contractsText}
            keywordsText={company.keywordsText}
            adminNotes={company.adminNotes}
          />
        </div>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-heading text-2xl">Monthly Budgets</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Set monthly revenue targets for each spa. The home dashboard will show progress as a percentage of budget. Paste budget data in CSV format below.
        </p>
        <div className="mt-4">
          <BudgetForm />
        </div>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-heading text-2xl">Connections</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This list is what the server running now can see. Secrets saved in Cursor are available on the published workspace. A local preview does not receive them.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map(([label, on]) => (
            <li key={label} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span>{label}</span>
              <span>{on ? "Configured" : "Not configured"}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-heading text-2xl">People</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A role set by email applies when that person signs in with a verified email. An unverified address stays on staff.
        </p>
        <div className="mt-3">
          <InviteForm />
        </div>
        {invites.length > 0 ? (
          <ul className="mt-3 text-sm text-muted-foreground">
            {invites.map((invite) => (
              <li key={invite.email}>
                {invite.email} · {invite.role} · waiting for a verified sign-in
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="mt-4 divide-y">
          {people.map((person) => (
            <li key={person.sub} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p>{person.name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">{person.email || "No email on the sign-in"}</p>
              </div>
              <RoleSelect sub={person.sub} role={person.role} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
}
