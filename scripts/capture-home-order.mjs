import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = process.env.OUT_DIR ?? "/opt/cursor/artifacts";
const base = process.env.BASE_URL ?? "http://127.0.0.1:4327/";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(base, { waitUntil: "networkidle", timeout: 60_000 });
await page.getByRole("heading", { name: "Performance" }).waitFor({ timeout: 30_000 });
await page.getByRole("heading", { name: "By spa" }).waitFor();

const headings = ["Performance", "By spa", "Revenue mix", "Promotions", "Ask Mandara AI"];
const order = [];
for (const name of headings) {
  const el = page.getByRole("heading", { name });
  if (await el.count()) {
    const y = (await el.first().boundingBox())?.y ?? -1;
    order.push({ name, y });
  }
}
order.sort((a, b) => a.y - b.y);
console.log("section order:", order.map((o) => o.name).join(" → "));

const desktopPath = `${outDir}/home-section-order-desktop.png`;
await page.screenshot({ path: desktopPath, fullPage: true });
console.log("saved", desktopPath);

await browser.close();