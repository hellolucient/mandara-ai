import { cache } from "react";
import { sql } from "@/lib/db";

export type Settings = {
  companyName: string;
  model: string;
  imageModel: string;
  reasoningModel: string;
  visionModel: string;
  currency: string;
};

const DEFAULTS: Settings = {
  companyName: "Mandara Spa Maldives",
  model: "deepseek/deepseek-v4.1-flash",
  imageModel: "google/gemini-2.5-flash-image",
  reasoningModel: "deepseek/deepseek-v4-pro",
  visionModel: "google/gemini-2.5-flash",
  currency: "USD",
};

const ALLOWED = new Set(["companyName", "model", "imageModel", "reasoningModel", "visionModel", "currency"]);

async function readSettings(stage: string): Promise<Settings> {
  const rows = await sql<{ key: string; value: string }>(
    "select key, value from settings where stage = $1",
    [stage],
  );
  const settings = { ...DEFAULTS };
  for (const row of rows) {
    if (row.key === "companyName") settings.companyName = row.value;
    if (row.key === "model") settings.model = row.value;
    if (row.key === "imageModel") settings.imageModel = row.value;
    if (row.key === "reasoningModel") settings.reasoningModel = row.value;
    if (row.key === "visionModel") settings.visionModel = row.value;
    if (row.key === "currency") settings.currency = row.value;
  }
  return settings;
}

export const getSettings = cache(readSettings);

export async function updateSettings(stage: string, patch: Record<string, string>): Promise<Settings> {
  for (const [key, value] of Object.entries(patch)) {
    if (!ALLOWED.has(key)) continue;
    const clean = value.trim();
    if (!clean || clean.length > 80) continue;
    if (key === "model" && !/^[\w./:-]{3,80}$/.test(clean)) continue;
    if (key === "imageModel" && !/^[\w./:-]{3,80}$/.test(clean)) continue;
    if (key === "reasoningModel" && !/^[\w./:-]{3,80}$/.test(clean)) continue;
    if (key === "visionModel" && !/^[\w./:-]{3,80}$/.test(clean)) continue;
    if (key === "currency" && !/^[A-Z]{3}$/.test(clean)) continue;
    await sql(
      `insert into settings (stage, key, value) values ($1, $2, $3)
       on conflict (stage, key) do update set value = excluded.value`,
      [stage, key, clean],
    );
  }
  return readSettings(stage);
}
