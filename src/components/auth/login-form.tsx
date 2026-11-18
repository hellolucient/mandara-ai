"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password"), next }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (!response.ok || !body.ok) {
        setError(body.error || "Sign-in did not work. Try again.");
        setBusy(false);
        return;
      }
      window.location.assign(body.next || "/");
    } catch {
      setError("No connection. Check your signal and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <label className="block">
        <span className="text-sm font-medium">Username or email</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-white/80 px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-white/80 px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-12 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-70"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function PasswordForm({ required }: { required: boolean }) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = String(form.get("next") ?? "");
    if (next !== String(form.get("confirm") ?? "")) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: required ? "" : form.get("current"), next }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => ({}))) as { ok?: boolean; error?: string } | undefined;
    setBusy(false);
    if (!response?.ok || !body?.ok) {
      setError(body?.error || "That did not work. Try again.");
      return;
    }
    setDone(true);
    window.setTimeout(() => window.location.assign("/"), 900);
  }

  const field =
    "mt-1.5 h-12 w-full rounded-xl border border-border bg-white/80 px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <form onSubmit={submit} className="space-y-4">
      {!required ? (
        <label className="block">
          <span className="text-sm font-medium">Current password</span>
          <input name="current" type="password" autoComplete="current-password" required className={field} />
        </label>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input name="next" type="password" autoComplete="new-password" minLength={10} required className={field} />
        <span className="mt-1 block text-xs text-muted-foreground">At least 10 characters. A short phrase works well.</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">New password again</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required className={field} />
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {done ? <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Saved. Opening Mandara AI…</p> : null}
      <button
        type="submit"
        disabled={busy || done}
        className="h-12 w-full rounded-xl bg-primary text-base font-medium text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-70"
      >
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
