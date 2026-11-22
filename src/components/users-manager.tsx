"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_ACCESS_LABELS, APP_ACCESS_VALUES, appAccessFromFlags, type AppAccess } from "@/lib/access";

export type UserRow = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff";
  chatOnly: boolean;
  appAccess?: AppAccess;
  disabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin: everything" },
  { value: "manager", label: "Management: contracts and resort data" },
  { value: "staff", label: "Spa: no contracts" },
] as const;

const PAGE_OPTIONS = APP_ACCESS_VALUES.map((value) => ({
  value,
  label: APP_ACCESS_LABELS[value],
  short:
    value === "full" ? "All pages" : value === "dashboard" ? "Dashboard + chat" : "Chat only",
}));

async function call(body: Record<string, unknown>): Promise<{ temporaryPassword?: string }> {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; temporaryPassword?: string };
  if (!response.ok) throw new Error(payload.error || "The change was not saved.");
  return payload;
}

/** Shows a temporary password once, for the administrator to pass on in person or by phone. */
function OneTimePassword({ who, password, onClose }: { who: string; password: string; onClose: () => void }) {
  return (
    <div role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <p>
        Temporary password for <strong>{who}</strong>. It is shown only now. They choose their own at first sign-in.
      </p>
      <p className="mt-2 select-all rounded-lg bg-white px-3 py-2 font-mono text-base">{password}</p>
      <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={onClose}>
        Done, hide it
      </button>
    </div>
  );
}

export function UsersManager({ users, selfId }: { users: UserRow[]; selfId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [shown, setShown] = useState<{ who: string; password: string } | null>(null);
  const [newRole, setNewRole] = useState<"admin" | "manager" | "staff">("manager");

  async function run(body: Record<string, unknown>, who?: string) {
    setError("");
    try {
      const result = await call(body);
      if (result.temporaryPassword && who) setShown({ who, password: result.temporaryPassword });
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "The change was not saved.");
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          const form = new FormData(formElement);
          const username = String(form.get("username") ?? "");
          const role = String(form.get("role") ?? "staff");
          await run(
            {
              action: "create",
              username,
              name: String(form.get("name") ?? ""),
              email: String(form.get("email") ?? ""),
              role,
              appAccess: role === "admin" ? "full" : String(form.get("appAccess") ?? "chat"),
            },
            username,
          );
          formElement.reset();
          setNewRole("manager");
        }}
      >
        <div>
          <Label htmlFor="new-name">Name</Label>
          <Input id="new-name" name="name" placeholder="Tenille" required />
        </div>
        <div>
          <Label htmlFor="new-username">Username</Label>
          <Input id="new-username" name="username" placeholder="tenille" autoCapitalize="none" required />
        </div>
        <div>
          <Label htmlFor="new-email">Email (optional, can also sign in with it)</Label>
          <Input id="new-email" name="email" type="email" placeholder="name@mandaraspamaldives.com" />
        </div>
        <div>
          <Label htmlFor="new-role">Role</Label>
          <select
            id="new-role"
            name="role"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as "admin" | "manager" | "staff")}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="new-pages">Pages</Label>
          <select
            id="new-pages"
            name="appAccess"
            defaultValue="chat"
            disabled={newRole === "admin"}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:opacity-60"
          >
            {newRole === "admin" ? (
              <option value="full">Everything</option>
            ) : (
              PAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {newRole === "admin"
              ? "Administrators always have every page."
              : "Dashboard + chat shows Home (Performance, Ask Mandara AI and By spa) and Chat. Chat only keeps them in the chat."}
          </p>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Add person</Button>
        </div>
      </form>
      {shown ? <OneTimePassword who={shown.who} password={shown.password} onClose={() => setShown(null)} /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y">
        {users.map((user) => {
          const pages = user.role === "admin" ? "full" : appAccessFromFlags({ appAccess: user.appAccess, chatOnly: user.chatOnly });
          return (
            <li key={user.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className={user.disabled ? "text-muted-foreground line-through" : ""}>
                  {user.name || user.username} <span className="text-xs text-muted-foreground">@{user.username}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.email || "No email"} · {user.lastLoginAt ? `last in ${user.lastLoginAt} (Bangkok)` : "never signed in"}
                  {user.mustChangePassword ? " · temporary password" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Role for ${user.username}`}
                  defaultValue={user.role}
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                  onChange={(event) => run({ action: "update", id: user.id, role: event.target.value })}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label.split(":")[0]}
                    </option>
                  ))}
                </select>
                {user.role === "admin" ? (
                  <span className="text-xs text-muted-foreground">Everything</span>
                ) : (
                  <select
                    aria-label={`Pages for ${user.username}`}
                    defaultValue={pages}
                    className="h-9 rounded-lg border bg-background px-2 text-sm"
                    onChange={(event) => run({ action: "update", id: user.id, appAccess: event.target.value })}
                  >
                    {PAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.short}
                      </option>
                    ))}
                  </select>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => run({ action: "reset", id: user.id }, user.username)}>
                  Reset password
                </Button>
                {user.id !== selfId ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => run({ action: "update", id: user.id, disabled: !user.disabled })}>
                    {user.disabled ? "Switch on" : "Switch off"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
