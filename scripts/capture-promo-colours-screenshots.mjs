import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = "/opt/cursor/artifacts";
const base = "http://127.0.0.1:4327";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const [name, path] of [
  ["home-promo-card", "/"],
  ["promotions-monthly-colours", "/promotions?view=monthly"],
]) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const file = `${outDir}/mandara-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

await browser.close();