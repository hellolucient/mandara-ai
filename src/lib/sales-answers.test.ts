import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerSales } from "./sales-answers.js";
import { latestDayColumnLabels, shortWeekdayDate } from "./dates.js";
import { salesAnswerMarkdown, splitSalesSource } from "./chat-view.js";
import { readFileSync } from "node:fs";
import type { LoadedDay } from "./sales-types.js";

/** Exact Ellaidhoo figures from the 21 Nov 2026 DSR. */
const ELLAIDHOO = {
  locationId: "ellaidhoo",
  locationName: "Ellaidhoo",
  netSales: 657.33,
  treatments: 7,
  budget: 769.09,
  treatmentSales: 643.34,
  retailSales: 13.99,
};

const RANNALHI = {
  locationId: "rannalhi",
  locationName: "Rannalhi",
  netSales: 89.35,
  treatments: 1,
  budget: 100,
  treatmentSales: 89.35,
  retailSales: 0,
};

const DHONVELI = {
  locationId: "dhonveli",
  locationName: "Dhonveli",
  netSales: 757.2,
  treatments: 14,
  budget: 1338.87,
  treatmentSales: 716.79,
  retailSales: 40.41,
};

function day(date: string, lines: LoadedDay["lines"]): LoadedDay {
  return { businessDate: date, source: "import", currency: "USD", complete: true, note: "", lines };
}

const yesterday: LoadedDay = day("2026-11-21", [ELLAIDHOO, RANNALHI, DHONVELI]);
const earlier: LoadedDay = day("2026-11-20", [
  { ...ELLAIDHOO, netSales: 500, treatmentSales: 480, retailSales: 20, treatments: 6 },
  { ...RANNALHI, netSales: 80, treatmentSales: 80, retailSales: 0, treatments: 1 },
  { ...DHONVELI, netSales: 700, treatmentSales: 660, retailSales: 40, treatments: 12 },
]);

describe("sales answers label treatment, retail and total correctly", () => {
  it("states Ellaidhoo's yesterday treatment, retail and total, and does not swap them", () => {
    const text = answerSales({ kind: "location", name: "Ellaidhoo" }, [earlier, yesterday], "2026-11-22");
    assert.match(text, /\*\*Ellaidhoo · 21 Nov 2026\*\*/);
    assert.match(text, /Treatment: \$643\.34/);
    assert.match(text, /Retail: \$13\.99/);
    assert.match(text, /Total \(treatment \+ retail\): \$657\.33/);
    assert.match(text, /Treatment guests: 7/);
    // The bug was labelling the $657.33 total as treatment and the $643.34 treatment figure as retail.
    const treatmentLine = text.split("\n").find((line) => line.startsWith("Treatment:"));
    const retailLine = text.split("\n").find((line) => line.startsWith("Retail:"));
    const totalLine = text.split("\n").find((line) => line.startsWith("Total (treatment + retail):"));
    assert.equal(treatmentLine, "Treatment: $643.34");
    assert.equal(retailLine, "Retail: $13.99");
    assert.equal(totalLine, "Total (treatment + retail): $657.33");
    assert.ok(text.indexOf("Treatment: $643.34") < text.indexOf("Retail: $13.99"));
    assert.ok(text.indexOf("Retail: $13.99") < text.indexOf("Total (treatment + retail): $657.33"));
    assert.doesNotMatch(text, /Treatment: \$657/);
    assert.doesNotMatch(text, /Retail: \$643/);
    assert.doesNotMatch(text, /Treatments \$/);
  });

  it("shows $0.00 retail when a spa had treatment sales and no retail", () => {
    const text = answerSales({ kind: "location", name: "Rannalhi" }, [yesterday], "2026-11-22");
    assert.match(text, /Treatment: \$89\.35/);
    assert.match(text, /Retail: \$0\.00/);
    assert.match(text, /Total \(treatment \+ retail\): \$89\.35/);
  });

  it("keeps treatment, retail and total in the right columns for all spas yesterday", () => {
    const text = answerSales({ kind: "total" }, [yesterday], "2026-11-22");
    assert.match(text, /\| Spa \| Treatment \| Retail \| Total \| vs budget \|/);
    assert.match(text, /\| Ellaidhoo \| \$643\.34 \| \$13\.99 \| \$657\.33 \|/);
    assert.match(text, /\| Rannalhi \| \$89\.35 \| \$0\.00 \| \$89\.35 \|/);
    assert.match(text, /\| Dhonveli \| \$716\.79 \| \$40\.41 \| \$757\.20 \|/);
    assert.doesNotMatch(text, /\| Ellaidhoo \| \$657\.33 \| \$643\.34 \|/);
    const totalRow = text.split("\n").filter((line) => line.startsWith("| Total |"));
    assert.equal(totalRow.length, 1);
    // 643.34+89.35+716.79 = 1449.48 treatment; 13.99+0+40.41 = 54.40 retail; 657.33+89.35+757.20 = 1503.88 total
    assert.match(totalRow[0], /\| Total \| \$1,449\.48 \| \$54\.40 \| \$1,503\.88 \|/);
  });

  it("keeps the same order for one spa month to date and for group month-to-date totals", () => {
    const spa = answerSales({ kind: "location-month", name: "Ellaidhoo" }, [earlier, yesterday], "2026-11-22");
    assert.match(spa, /Treatment: \$1,123\.34/);
    assert.match(spa, /Retail: \$33\.99/);
    assert.match(spa, /Total \(treatment \+ retail\): \$1,157\.33/);
    assert.ok(spa.indexOf("Treatment: $1,123.34") < spa.indexOf("Retail: $33.99"));
    assert.ok(spa.indexOf("Retail: $33.99") < spa.indexOf("Total (treatment + retail): $1,157.33"));
    assert.doesNotMatch(spa, /Treatment: \$1,157/);
    assert.doesNotMatch(spa, /Retail: \$1,123/);

    const group = answerSales({ kind: "mtd" }, [earlier, yesterday], "2026-11-22");
    assert.match(group, /Treatment \$2,669\.48/);
    assert.match(group, /retail \$114\.40/);
    assert.match(group, /total \(treatment \+ retail\) \$2,783\.88/);
    assert.doesNotMatch(group, /Treatment \$2,983/);
  });
});

describe("Home By spa latest-day column labels", () => {
  it("says Yesterday when the latest DSR day is the day before today", () => {
    assert.deepEqual(latestDayColumnLabels("2026-11-21", "2026-11-22"), {
      treatment: "Yesterday treatment",
      retail: "Yesterday retail",
      day: "Yesterday",
      summary: "Yesterday's treatment and retail",
    });
  });

  it("uses the actual date when the latest DSR day is older than yesterday", () => {
    assert.equal(shortWeekdayDate("2026-11-21"), "Sat 21 Nov");
    assert.deepEqual(latestDayColumnLabels("2026-11-21", "2026-11-23"), {
      treatment: "Sat 21 Nov treatment",
      retail: "Sat 21 Nov retail",
      day: "Sat 21 Nov",
      summary: "Treatment and retail · Sat 21 Nov",
    });
  });

  it("wires the By spa table to treatment, retail and month-to-date total, not Latest day or Retail MTD", () => {
    const page = readFileSync("src/components/spa-by-location-table.tsx", "utf8");
    const home = readFileSync("src/app/(app)/page.tsx", "utf8");
    assert.match(home, /SpaByLocationTable/);
    assert.match(page, /latestDayColumnLabels/);
    assert.match(page, />Treatment</);
    assert.match(page, />Retail</);
    assert.match(page, /headings\.day/);
    assert.match(page, /Month to date/i);
    assert.match(page, /Year to date/i);
    assert.match(page, /TY from DSR and period imports/);
    assert.match(page, /latestTreatmentSales/);
    assert.match(page, /latestRetailSales/);
    assert.doesNotMatch(page, />Latest day</);
    assert.doesNotMatch(page, />Retail MTD</);
    const kpis = readFileSync("src/lib/home-kpis.ts", "utf8");
    assert.match(kpis, /latestTreatmentSales/);
    assert.match(kpis, /business_date === latestDate/);
  });
});


describe("sales answer layout and sparkline polish", () => {
  it("keeps each sales figure on its own Markdown line, with the source as a footnote", () => {
    const raw = [
      "**Ellaidhoo · 21 Nov 2026**",
      "Treatment: $643.34",
      "Retail: $13.99",
      "Total (treatment + retail): $657.33",
      "Treatment guests: 7",
      "Budget: $112 below the stored budget of $769.",
      "Same day last week (14 Nov): $1,029, -36.1%",
      "Source: Steiners DSR, imported from the daily export.",
    ].join("\n");
    const { body, source } = splitSalesSource(raw);
    assert.equal(source, "Source: Steiners DSR, imported from the daily export.");
    const md = salesAnswerMarkdown(body);
    const lines = md.split("\n").map((item) => item.replace(/ {2}$/, ""));
    assert.deepEqual(lines, [
      "**Ellaidhoo · 21 Nov 2026**",
      "Treatment: $643.34",
      "Retail: $13.99",
      "Total (treatment + retail): $657.33",
      "Treatment guests: 7",
      "Budget: $112 below the stored budget of $769.",
      "Same day last week (14 Nov): $1,029, -36.1%",
    ]);
        assert.doesNotMatch(md, /Treatment: \$643\.34 Retail:/);
  });

  it("renders those line breaks in both ChatPanel and ChatApp", () => {
    const panel = readFileSync("src/components/chat-panel.tsx", "utf8");
    assert.match(panel, /salesAnswerMarkdown/);
    assert.match(panel, /splitSalesSource/);
    assert.match(panel, /sales\?\.source/);
    const app = readFileSync("src/components/chat-app/chat-app.tsx", "utf8");
    assert.match(app, /salesAnswerMarkdown/);
    assert.match(app, /splitSalesSource/);
  });

  it("draws the sparkline end dot as a path on the last point, not a displaced circle", () => {
    const spark = readFileSync("src/components/sparkline.tsx", "utf8");
    assert.match(spark, /function dotPath/);
    assert.match(spark, /dotPath\(end\[0\], end\[1\]/);
    assert.doesNotMatch(spark, /<circle[\s/>]/);
    const kpis = readFileSync("src/lib/home-kpis.ts", "utf8");
    assert.match(kpis, /sparkDates/);
  });

  it("groups By spa columns with band headers and horizontal scroll on mobile", () => {
    const page = readFileSync("src/components/spa-by-location-table.tsx", "utf8");
    assert.match(page, /rowSpan=\{2\}/);
    assert.match(page, /Month to date/);
    assert.match(page, /overflow-x-auto/);
    assert.match(page, /whitespace-nowrap/);
    assert.match(page, /min-w-\[1040px\]/);
  });
});

describe("mobile chat history drawer", () => {
  it("opens chat into the conversation on mobile, with history in a drawer, for both views", () => {
    const dashboard = readFileSync("src/components/dashboard-chat.tsx", "utf8");
    assert.match(dashboard, /role="dialog"/);
    assert.match(dashboard, /Chat history/);
    assert.match(dashboard, /ConversationHistory/);
    assert.match(dashboard, /hidden.*md:flex|md:flex/);
    const panel = readFileSync("src/components/chat-panel.tsx", "utf8");
    assert.match(panel, /aria-label="Chat history"/);
    assert.match(panel, /onOpenHistory/);
    assert.match(panel, /safe-area-inset-bottom/);
    const app = readFileSync("src/components/chat-app/chat-app.tsx", "utf8");
    assert.match(app, /ConversationHistory/);
    assert.match(app, /aria-label="Chat history"/);
    assert.match(app, /safe-area-inset-bottom/);
    const history = readFileSync("src/components/conversation-history.tsx", "utf8");
    assert.match(history, /New chat/);
    assert.match(history, /history-badge/);
    assert.match(history, /Options for/);
    assert.match(history, /onTouchEnd/);
    assert.match(history, /Tap again to delete/);
    assert.doesNotMatch(history, /text-xs text-muted-foreground opacity-100/);
    const pages = ["src/app/(app)/chat/page.tsx", "src/app/(app)/chat/[id]/page.tsx"].map((f) => readFileSync(f, "utf8")).join("\n");
    assert.match(pages, /DashboardChat/);
    assert.doesNotMatch(pages, /ConversationList/);
  });
});
