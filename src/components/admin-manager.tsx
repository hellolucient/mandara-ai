"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function post(body: Record<string, string>) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "The change was not saved.");
}

export function SettingsForm({ companyName, model, imageModel, reasoningModel, visionModel, currency }: { companyName: string; model: string; imageModel: string; reasoningModel: string; visionModel: string; currency: string }) {
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
            imageModel: String(form.get("imageModel") ?? ""),
            reasoningModel: String(form.get("reasoningModel") ?? ""),
            visionModel: String(form.get("visionModel") ?? ""),
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
        <Label htmlFor="model">OpenRouter model id (fast)</Label>
        <Input id="model" name="model" defaultValue={model} className="mt-1 h-10" />
        <p className="mt-1 text-xs text-muted-foreground">Default is deepseek/deepseek-v4.1-flash. Used for everyday prompts.</p>
      </div>
      <div>
        <Label htmlFor="reasoningModel">Reasoning model id (hard questions)</Label>
        <Input id="reasoningModel" name="reasoningModel" defaultValue={reasoningModel} className="mt-1 h-10" />
        <p className="mt-1 text-xs text-muted-foreground">Default is deepseek/deepseek-v4-pro. Used for calculations, what-ifs, and complex analysis.</p>
      </div>
      <div>
        <Label htmlFor="visionModel">Vision model id</Label>
        <Input id="visionModel" name="visionModel" defaultValue={visionModel} className="mt-1 h-10" />
        <p className="mt-1 text-xs text-muted-foreground">Default is google/gemini-2.5-flash. Used when a photo is attached and the chat model cannot see images.</p>
      </div>
      <div>
        <Label htmlFor="imageModel">Image model id</Label>
        <Input id="imageModel" name="imageModel" defaultValue={imageModel} className="mt-1 h-10" />
        <p className="mt-1 text-xs text-muted-foreground">Default is google/gemini-2.5-flash-image. Used for concept drawings.</p>
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

export function CompanyProfileForm({
  description,
  spasText,
  peopleText,
  contactsText,
  contractsText,
  keywordsText,
  adminNotes,
}: {
  description: string;
  spasText: string;
  peopleText: string;
  contactsText: string;
  contractsText: string;
  keywordsText: string;
  adminNotes: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError("");
        try {
          await post({
            action: "profile",
            description: String(form.get("description") ?? ""),
            spasText: String(form.get("spasText") ?? ""),
            peopleText: String(form.get("peopleText") ?? ""),
            contactsText: String(form.get("contactsText") ?? ""),
            contractsText: String(form.get("contractsText") ?? ""),
            keywordsText: String(form.get("keywordsText") ?? ""),
            adminNotes: String(form.get("adminNotes") ?? ""),
          });
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "The profile was not saved.");
        }
      }}
    >
      <div className="md:col-span-2">
        <Label htmlFor="description">Who we are</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={description}
          placeholder="A short description of the company and what it does."
          className="mt-1 min-h-24"
        />
      </div>
      <div>
        <Label htmlFor="spasText">Spas and resorts</Label>
        <Textarea
          id="spasText"
          name="spasText"
          defaultValue={spasText}
          placeholder={"Mandara Spa at Adaaran Prestige Vadoo | open | Vadoo, Vaadhoo"}
          className="mt-1 min-h-32"
        />
        <p className="mt-1 text-xs text-muted-foreground">Name, status (open, closed, former, negotiation, or declined), then aliases.</p>
      </div>
      <div>
        <Label htmlFor="peopleText">People and roles</Label>
        <Textarea id="peopleText" name="peopleText" defaultValue={peopleText} placeholder={"Tenille Jade Keats | Country Manager Maldives | Tenille"} className="mt-1 min-h-32" />
      </div>
      <div>
        <Label htmlFor="contactsText">Partner contacts</Label>
        <Textarea
          id="contactsText"
          name="contactsText"
          defaultValue={contactsText}
          placeholder={"Suresh Athukorala | General Manager | Adaaran Select Meedhupparu"}
          className="mt-1 min-h-32"
        />
        <p className="mt-1 text-xs text-muted-foreground">Name, role, organisation, then aliases. No phone numbers or emails.</p>
      </div>
      <div>
        <Label htmlFor="contractsText">Hotel partner contracts</Label>
        <Textarea
          id="contractsText"
          name="contractsText"
          defaultValue={contractsText}
          placeholder={"Adaaran Prestige Vadoo | Unique Resorts Pvt Ltd | signed"}
          className="mt-1 min-h-28"
        />
      </div>
      <div>
        <Label htmlFor="keywordsText">Extra keywords</Label>
        <Textarea id="keywordsText" name="keywordsText" defaultValue={keywordsText} placeholder={"DSR\nSteiners"} className="mt-1 min-h-28" />
        <p className="mt-1 text-xs text-muted-foreground">One keyword or phrase per line.</p>
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="adminNotes">Notes for Admin</Label>
        <Textarea id="adminNotes" name="adminNotes" defaultValue={adminNotes} className="mt-1 min-h-28" />
        <p className="mt-1 text-xs text-muted-foreground">Kept in Admin only. The assistant does not see these notes.</p>
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit">Save company profile</Button>
      </div>
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
