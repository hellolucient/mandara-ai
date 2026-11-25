import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = "/opt/cursor/artifacts";
const base = "http://127.0.0.1:4327";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const [name, path] of [
  ["promotions-daily", "/promotions?view=daily"],
  ["promotions-monthly", "/promotions?view=monthly"],
]) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Promotions", level: 1 }).waitFor({ timeout: 25000 });
  const file = `${outDir}/mandara-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

await browser.close();