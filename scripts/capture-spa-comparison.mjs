import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = process.env.OUT_DIR ?? "/opt/cursor/artifacts";
const base = process.env.BASE_URL ?? "http://127.0.0.1:4327";

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const [name, viewport] of [
  ["spa-comparison-home-desktop", { width: 1400, height: 900 }],
  ["spa-comparison-home-mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("heading", { name: "By spa" }).waitFor();
  if (viewport.width >= 768) await page.getByText("Cinnamon").first().waitFor({ timeout: 20_000 });
  else await page.getByText("Single resorts").first().waitFor({ timeout: 20_000 });
  await page.screenshot({ path: `${outDir}/mandara-${name}.png`, fullPage: true });
  console.log("saved", `${outDir}/mandara-${name}.png`);
}

await browser.close();