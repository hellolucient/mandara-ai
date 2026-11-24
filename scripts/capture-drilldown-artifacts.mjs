import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const outDir = "/opt/cursor/artifacts";
const base = "http://127.0.0.1:4327/";

await mkdir(outDir, { recursive: true });

async function assertHome(page) {
  if (!/\/$/.test(new URL(page.url()).pathname)) throw new Error(`Expected Home, got ${page.url()}`);
  await page.getByRole("heading", { name: "By spa" }).waitFor({ timeout: 20000 });
  await page.getByRole("heading", { name: "Performance" }).waitFor();
}

async function openDrilldown(page, spaName) {
  await page.goto(base, { waitUntil: "networkidle" });
  await assertHome(page);
  const viewport = page.viewportSize()?.width ?? 1280;
  const trigger =
    viewport >= 768
      ? page.locator(`table [data-spa-drilldown="${spaName}"]`)
      : page.locator(`ul.md\\:hidden [data-spa-drilldown="${spaName}"]`);
  await trigger.first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 10000 });
  await dialog.getByRole("heading", { name: spaName, level: undefined }).waitFor();
  return dialog;
}

const browser = await chromium.launch({ headless: true });

const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const vadooDialog = await openDrilldown(desktop, "Vadoo");
await vadooDialog.getByText("Treatments sold").waitFor();
await vadooDialog.getByText("Deep Tissue 45").waitFor();
await vadooDialog.getByText("Spa Gift Set").waitFor();
const desktopPath = `${outDir}/mandara-spa-drilldown-desktop.png`;
await desktop.screenshot({ path: desktopPath, fullPage: false });
console.log("saved", desktopPath);

const emptyDialog = await openDrilldown(desktop, "Hakuraa Huraa");
await emptyDialog.getByText("Item breakdown not loaded").waitFor();
const emptyPath = `${outDir}/mandara-spa-drilldown-empty.png`;
await desktop.screenshot({ path: emptyPath, fullPage: false });
console.log("saved", emptyPath);

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
const mobileDialog = await openDrilldown(mobile, "Vadoo");
await mobileDialog.getByText("Deep Tissue 45").waitFor();
const mobilePath = `${outDir}/mandara-spa-drilldown-mobile.png`;
await mobile.screenshot({ path: mobilePath, fullPage: false });
console.log("saved", mobilePath);

await desktop.goto(base, { waitUntil: "networkidle" });
await assertHome(desktop);
const bySpa = desktop.getByRole("heading", { name: "By spa" });
await bySpa.scrollIntoViewIfNeeded();
await desktop.locator('table [data-spa-drilldown="Vadoo"]').waitFor();
const homePath = `${outDir}/mandara-home-desktop.png`;
await desktop.screenshot({ path: homePath, fullPage: true });
console.log("saved", homePath);

await browser.close();
console.log("all captures verified in DOM before screenshot");