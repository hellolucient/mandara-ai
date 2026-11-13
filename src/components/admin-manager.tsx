"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function post(body: Record<string, string>) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "The change was not saved.");
}

export function SettingsForm({ companyName, model, currency }: { companyName: string; model: string; currency: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        try {
          await post({
            action: "settings",
            companyName: String(form.get("companyName") ?? ""),
            model: String(form.get("model") ?? ""),
            currency: String(form.get("currency") ?? ""),
          });
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The change was not saved.");
        }
      }}
    >
      <div>
        <Label htmlFor="companyName">Company name</Label>
        <Input id="companyName" name="companyName" defaultValue={companyName} className="mt-1 h-10" />
      </div>
      <div>
        <Label htmlFor="model">OpenRouter model id</Label>
        <Input id="model" name="model" defaultValue={model} className="mt-1 h-10" />
        <p className="mt-1 text-xs text-muted-foreground">Default is openrouter/auto, on the middle tier. Sales maths does not use this model.</p>
      </div>
      <div>
        <Label htmlFor="currency">Currency code</Label>
        <Input id="currency" name="currency" defaultValue={currency} className="mt-1 h-10" maxLength={3} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit">Save settings</Button>
    </form>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        try {
          await post({
            action: "invite",
            email: String(form.get("email") ?? ""),
            role: String(form.get("role") ?? "staff"),
          });
          event.currentTarget.reset();
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The invite was not saved.");
        }
      }}
    >
      <Input name="email" type="email" required placeholder="name@mandaraspa.com" className="h-10" />
      <select name="role" className="h-10 rounded-lg border bg-background px-3 text-sm" defaultValue="staff">
        <option value="staff">Staff</option>
        <option value="manager">Manager</option>
        <option value="admin">Administrator</option>
      </select>
      <Button type="submit">Set role</Button>
      {error ? <p className="text-sm text-destructive sm:basis-full">{error}</p> : null}
    </form>
  );
}

export function RoleSelect({ sub, role }: { sub: string; role: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div>
      <select
        className="h-9 rounded-lg border bg-background px-2 text-sm"
        defaultValue={role}
        onChange={async (event) => {
          setError("");
          try {
            await post({ action: "role", sub, role: event.target.value });
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The role was not changed.");
          }
        }}
      >
        <option value="staff">Staff</option>
        <option value="manager">Manager</option>
        <option value="admin">Administrator</option>
      </select>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
