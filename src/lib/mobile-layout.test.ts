import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("mobile page width containment", () => {
  it("prevents dashboard shell and Home from expanding past the viewport", () => {
    const shell = readFileSync("src/components/shell.tsx", "utf8");
    const home = readFileSync("src/app/(app)/page.tsx", "utf8");
    assert.match(shell, /overflow-x-hidden overflow-y-auto/);
    assert.match(home, /min-w-0 max-w-\[1200px\].*overflow-x-hidden/);
  });

  it("scrolls the By spa table inside an inset card, not with page-bleed margins", () => {
    const table = readFileSync("src/components/spa-by-location-table.tsx", "utf8");
    const inset = readFileSync("src/components/horizontal-scroll-inset.tsx", "utf8");
    assert.match(table, /HorizontalScrollInset/);
    assert.match(table, /scrollId="by-spa"/);
    assert.match(table, /sticky left-0/);
    assert.doesNotMatch(table, /-mx-5/);
    assert.match(inset, /overscroll-x-contain/);
    assert.match(inset, /min-w-0/);
  });

  it("contains wide promo tables on Promotions", () => {
    const page = readFileSync("src/app/(app)/promotions/page.tsx", "utf8");
    assert.match(page, /overflow-x-hidden/);
    assert.match(page, /HorizontalScrollInset/);
  });

  it("scrolls the mobile tab bar inside the header, not the page", () => {
    const shell = readFileSync("src/components/shell.tsx", "utf8");
    const nav = readFileSync("src/components/nav-links.tsx", "utf8");
    assert.match(shell, /min-w-0 shrink-0 overflow-x-hidden border-b bg-card md:hidden/);
    assert.match(nav, /overflow-x-auto overscroll-x-contain/);
    assert.match(nav, /min-w-0/);
  });
});