"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UserRow = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff";
  chatOnly: boolean;
  disabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin: everything" },
  { value: "manager", label: "Management: contracts and resort data" },
  { value: "staff", label: "Spa: no contracts" },
] as const;

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
          await run(
            {
              action: "create",
              username,
              name: String(form.get("name") ?? ""),
              email: String(form.get("email") ?? ""),
              role: String(form.get("role") ?? "staff"),
              chatOnly: form.get("chatOnly") === "on",
            },
            username,
          );
          formElement.reset();
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
          <Label htmlFor="new-role">Access</Label>
          <select id="new-role" name="role" defaultValue="manager" className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="chatOnly" defaultChecked /> Chat only (they see just the chat)
        </label>
        <div className="sm:col-span-2">
          <Button type="submit">Add person</Button>
        </div>
      </form>
      {shown ? <OneTimePassword who={shown.who} password={shown.password} onClose={() => setShown(null)} /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y">
        {users.map((user) => (
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
                aria-label={`Access for ${user.username}`}
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
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  defaultChecked={user.chatOnly}
                  onChange={(event) => run({ action: "update", id: user.id, chatOnly: event.target.checked })}
                />
                Chat only
              </label>
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
        ))}
      </ul>
    </div>
  );
}
