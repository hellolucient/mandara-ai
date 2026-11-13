import { readFileSync } from "node:fs";
import { validateExtract } from "../src/lib/sales-validate";

type MapFile = {
  ready?: boolean;
  login?: { username?: string; password?: string; submit?: string; success?: string };
  reportPath?: string;
  date?: string;
  currency?: string;
  row?: string;
  cells?: { location?: string; netSales?: string; treatments?: string; budget?: string };
};

async function main() {
const baseUrl = process.env.DSR_BASE_URL?.trim() ?? "";
const username = process.env.DSR_USERNAME?.trim() ?? "";
const password = process.env.DSR_PASSWORD?.trim() ?? "";
const mapPath = process.env.DSR_MAP?.trim() || "config/dsr-map.json";

if (!baseUrl || !username || !password) {
  console.error("DSR extraction needs DSR_BASE_URL, DSR_USERNAME and DSR_PASSWORD. Nothing was guessed.");
  process.exit(2);
}

const map = JSON.parse(readFileSync(mapPath, "utf8")) as MapFile;
if (map.ready !== true) {
  console.error("The DSR page map is not confirmed. Inspect the live site and set ready to true before extraction. Nothing was guessed.");
  process.exit(3);
}

const required = [
  map.login?.username,
  map.login?.password,
  map.login?.submit,
  map.login?.success,
  map.date,
  map.currency,
  map.row,
  map.cells?.location,
  map.cells?.netSales,
];
if (required.some((value) => !value)) {
  console.error("The page map is missing a selector. Extraction stopped.");
  process.exit(3);
}

let chromium: typeof import("playwright").chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Install playwright to run the extractor. The web app does not browse DSR itself.");
  process.exit(4);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.fill(map.login!.username!, username);
  await page.fill(map.login!.password!, password);
  await page.click(map.login!.submit!);
  if (map.reportPath) {
    const target = new URL(map.reportPath, baseUrl).toString();
    if (!page.url().startsWith(target)) await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });
  }
  try {
    await page.waitForSelector(map.login!.success!, { timeout: 8000 });
  } catch {
    console.error("Sign-in did not reach the sales table. The page may have changed, or the credentials were refused.");
    process.exit(4);
  }
  const raw = await page.evaluate((selectors) => {
    const text = (selector: string) => document.querySelector(selector)?.textContent?.trim() ?? "";
    const rows = [...document.querySelectorAll(selectors.row)].map((row) => ({
      location: row.querySelector(selectors.location)?.textContent?.trim() ?? "",
      netSales: row.querySelector(selectors.netSales)?.textContent?.trim() ?? "",
      treatments: selectors.treatments ? row.querySelector(selectors.treatments)?.textContent?.trim() ?? "" : "",
      budget: selectors.budget ? row.querySelector(selectors.budget)?.textContent?.trim() ?? "" : "",
    }));
    return { businessDate: text(selectors.date), currency: text(selectors.currency), rows };
  }, {
    row: map.row!,
    location: map.cells!.location!,
    netSales: map.cells!.netSales!,
    treatments: map.cells?.treatments ?? "",
    budget: map.cells?.budget ?? "",
    date: map.date!,
    currency: map.currency!,
  });
  const validated = validateExtract(raw);
  if (!validated.ok) {
    console.error(validated.error);
    process.exit(5);
  }
  process.stdout.write(`${JSON.stringify(validated.extract, null, 2)}\n`);
} finally {
  await browser.close();
}
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Extraction failed.");
  process.exit(4);
});
