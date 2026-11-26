import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = process.env.OUT_DIR ?? "/opt/cursor/artifacts";
const base = process.env.BASE_URL ?? "http://127.0.0.1:4327";
const width = Number(process.env.VIEWPORT_W ?? 390);

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height: 844 } });

await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 90_000 });

const docOverflow = await page.evaluate(() => {
  const doc = document.documentElement;
  return doc.scrollWidth > doc.clientWidth + 1;
});
if (docOverflow) {
  console.warn("warning: document still scrolls horizontally at", width, "px");
}

await page.screenshot({ path: `${outDir}/mandara-home-mobile-${width}-top.png` });
console.log("saved", `${outDir}/mandara-home-mobile-${width}-top.png`);

const bySpa = page.getByRole("heading", { name: "By spa" });
if (await bySpa.count()) {
  await bySpa.scrollIntoViewIfNeeded();
  const scroller = page.locator('[data-table-scroll="by-spa"]');
  if (await scroller.count()) {
    await scroller.evaluate((el) => {
      el.scrollLeft = Math.min(420, el.scrollWidth - el.clientWidth);
    });
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `${outDir}/mandara-home-mobile-${width}-by-spa-scrolled.png` });
  console.log("saved", `${outDir}/mandara-home-mobile-${width}-by-spa-scrolled.png`);
}

await browser.close();