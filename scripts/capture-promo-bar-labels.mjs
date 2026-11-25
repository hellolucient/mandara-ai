import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = process.env.OUT_DIR ?? "/opt/cursor/artifacts";
const base = process.env.BASE_URL ?? "http://127.0.0.1:4327";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const [name, viewport, path] of [
  ["promo-bars-home-desktop", { width: 1280, height: 900 }, "/"],
  ["promo-bars-daily-desktop", { width: 1280, height: 900 }, "/promotions?view=daily"],
  ["promo-bars-daily-mobile", { width: 390, height: 844 }, "/promotions?view=daily"],
  ["promo-bars-monthly-mobile", { width: 390, height: 844 }, "/promotions?view=monthly"],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText("Total").first().waitFor({ timeout: 30_000 });
  const file = `${outDir}/mandara-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

await browser.close();