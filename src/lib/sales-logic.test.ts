import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerSales } from "./sales-answers";
import { parseSalesQuestion } from "./sales-questions";
import { buildSampleDays } from "./sample-data";
import { parseCsv, validateExtract } from "./sales-validate";
import { chunkText } from "./chunk";

const days = buildSampleDays();
const names = days[0].lines.map((line) => line.locationName);
const today = "2026-11-13";

describe("sales questions", () => {
  it("answers yesterday from stored figures and excludes a missing location", () => {
    const intent = parseSalesQuestion("What were total spa sales yesterday?", names);
    assert.equal(intent?.kind, "total");
    const text = answerSales(intent!, days, today);
    assert.match(text, /\| Spa \| Treatment \| Retail \| Total \| vs budget \|/);
    assert.match(text, /Treatment and retail sales for 12 Nov 2026/);
    assert.match(text, /\$11,000/);
    assert.match(text, /Baa Atoll Spa/);
    assert.match(text, /sample figures/);
    assert.doesNotMatch(text, /\$13,100/);
    assert.doesNotMatch(text, /Month to date/);
  });

  it("does not mark a location below budget when no budget is stored", () => {
    const text = answerSales({ kind: "below-budget" }, days, today);
    assert.match(text, /North Malé Spa/);
    assert.match(text, /South Ari Spa/);
    assert.match(text, /Malé House Spa/);
    assert.match(text, /No budget is stored/);
    assert.doesNotMatch(text, /Malé House Spa \$/);
  });

  it("flags the sharp week-on-week drop and the missing figure", () => {
    const text = answerSales({ kind: "attention" }, days, today);
    assert.match(text, /North Malé Spa/);
    assert.match(text, /-41\.5%/);
    assert.match(text, /no sales figure/);
  });

  it("refuses a week percentage when the month does not contain both full windows", () => {
    const text = answerSales({ kind: "week" }, days, today);
    assert.match(text, /not compared/);
  });

  it("leaves an insurance question to the documents, not the sales tables", () => {
    assert.equal(parseSalesQuestion("What does our operating agreement say about insurance?", names), null);
  });

  it("rejects an extract that has no usable sales", () => {
    const result = validateExtract({
      businessDate: "2026-11-12",
      currency: "USD",
      rows: [{ location: "Cinnamon Velifushi", netSales: null, treatments: 1, budget: 100 }],
    });
    assert.equal(result.ok, false);
  });

  it("drops a negative figure instead of storing it", () => {
    const result = validateExtract({
      businessDate: "2026-11-12",
      currency: "USD",
      rows: [
        { location: "Cinnamon Velifushi", netSales: 10, treatments: 1, budget: 9 },
        { location: "South Ari Spa", netSales: -5, treatments: 1, budget: 9 },
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.extract.rows[1].netSales, null);
      assert.equal(result.extract.complete, false);
    }
  });

  it("reads one date from a csv and keeps a blank budget blank", () => {
    const result = parseCsv("business_date,location,net_sales,treatments,budget\n2026-11-10,Cinnamon Velifushi,100,4,\n");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.extract.rows[0].budget, null);
  });

  it("accepts treatment and retail sales in a csv and keeps old csv files working", () => {
    const split = parseCsv(
      "business_date,location,net_sales,treatments,budget,treatment_sales,retail_sales\n" +
        "2026-11-16,Dhonveli,1235.51,15,1338.87,1157.79,77.72\n" +
        "2026-11-16,Rannalhi,,,614.43,,\n",
    );
    assert.equal(split.ok, true);
    if (split.ok) {
      assert.equal(split.extract.rows[0].treatmentSales, 1157.79);
      assert.equal(split.extract.rows[0].retailSales, 77.72);
      assert.equal(split.extract.rows[1].treatmentSales, null);
      assert.equal(split.extract.rows[1].retailSales, null);
    }
    const old = parseCsv("business_date,location,net_sales,treatments,budget\n2026-11-10,Cinnamon Velifushi,100,4,\n");
    assert.equal(old.ok, true);
    if (old.ok) {
      assert.equal(old.extract.rows[0].retailSales, null);
      assert.equal(old.extract.rows[0].treatmentSales, null);
      assert.equal(old.extract.complete, true);
    }
  });

  it("accepts treatmentSales and retailSales in a JSON extract, optional and validated", () => {
    const result = validateExtract({
      businessDate: "2026-11-16",
      currency: "USD",
      rows: [
        { location: "Dhonveli", netSales: 1235.51, treatments: 15, budget: 1338.87, treatmentSales: 1157.79, retailSales: 77.72 },
        { location: "Vadoo", netSales: 656, treatments: 9, budget: 600 },
        { location: "Velifushi", netSales: 436, treatments: 5, budget: 650, treatmentSales: "420", retailSales: -16 },
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      const [dhonveli, vadoo, velifushi] = result.extract.rows;
      assert.equal(dhonveli.retailSales, 77.72);
      assert.equal(vadoo.retailSales, null);
      assert.equal(vadoo.treatmentSales, null);
      assert.equal(velifushi.treatmentSales, 420);
      assert.equal(velifushi.retailSales, null);
      assert.ok(result.extract.issues.some((issue) => /Velifushi: retail sales were negative/.test(issue)));
    }
    const bad = validateExtract({
      businessDate: "2026-11-16",
      currency: "USD",
      rows: [{ location: "Dhonveli", netSales: 10, treatments: 1, budget: 9, retailSales: "lots" }],
    });
    assert.equal(bad.ok, false);
  });

  it("chunks long text without dropping the ending", () => {
    const chunks = chunkText(`${"Alpha ".repeat(200)}\n\n${"Omega ".repeat(40)}`);
    assert.ok(chunks.length > 1);
    assert.match(chunks.at(-1) ?? "", /Omega/);
  });

  it("answers a treatment and retail breakdown with totals and month-to-date, and uses that table by default for a plain yesterday question", () => {
    const question =
      "I need a breakdown of treatment sales yesterday and retail sales yesterday and then compare them to where we're at budget";
    const names = ["Dhonveli", "Vadoo", "Hakuraa Huraa"];
    const intent = parseSalesQuestion(question, names);
    assert.deepEqual(intent, { kind: "mix", yesterday: true, mtd: true });

    const day = (
      date: string,
      lines: Array<[string, number | null, number | null, number | null, number | null]>,
    ) => ({
      businessDate: date,
      source: "import" as const,
      currency: "USD",
      complete: true,
      note: "",
      lines: lines.map(([name, netSales, treatmentSales, retailSales, budget]) => ({
        locationId: name.toLowerCase().replace(/ /g, "-"),
        locationName: name,
        netSales,
        treatments: 1,
        budget,
        treatmentSales,
        retailSales,
      })),
    });
    const days = [
      day("2026-11-16", [
        ["Dhonveli", 1000, 900, 100, 1100],
        ["Vadoo", 656, 600, 56, 600],
        ["Hakuraa Huraa", 2000, null, null, 1800],
      ]),
      day("2026-11-17", [
        ["Dhonveli", 1235.51, 1157.79, 77.72, 1338.87],
        ["Vadoo", 800, 720, 80, 700],
        ["Hakuraa Huraa", 2000, null, null, 1900],
      ]),
    ];

    const text = answerSales(intent!, days, "2026-11-18");
    assert.match(text, /\| Spa \| Treatment \| Retail \| Total \| vs budget \|/);
    assert.match(text, /\| Dhonveli \| \$1,157\.79 \| \$77\.72 \| \$1,235\.51 \| −\$103\.36 \|/);
    assert.match(text, /\| Vadoo \| \$720\.00 \| \$80\.00 \| \$800\.00 \| \+\$100\.00 \|/);
    assert.match(text, /\| Hakuraa Huraa \| — \| — \| \$2,000\.00 \| \+\$100\.00 \|/);
    assert.match(text, /\| Total \| \$1,877\.79 \| \$157\.72 \| \$4,035\.51 \| \+\$96\.64 \|/);
    assert.match(text, /Budget is only held as a total, not split into treatment and retail/);
    assert.match(text, /Month to date through 17 Nov 2026/);
    assert.match(text, /\| Dhonveli \| \$2,057\.79 \| \$177\.72 \| \$2,235\.51 \| −\$203\.36 \|/);
    assert.match(text, /\| Vadoo \| \$1,320\.00 \| \$136\.00 \| \$1,456\.00 \| \+\$156\.00 \|/);
    assert.match(text, /\| Hakuraa Huraa \| — \| — \| \$4,000\.00 \| \+\$300\.00 \|/);
    assert.match(text, /\| Total \| \$3,377\.79 \| \$313\.72 \| \$7,691\.51 \| \+\$252\.64 \|/);
    assert.match(text, /A dash means that figure is not stored/);

    const plain = parseSalesQuestion("What were total spa sales yesterday?", names);
    assert.equal(plain?.kind, "total");
    const totalText = answerSales(plain!, days, "2026-11-18");
    assert.match(totalText, /Treatment and retail sales for 17 Nov 2026/);
    assert.match(totalText, /\| Spa \| Treatment \| Retail \| Total \| vs budget \|/);
    assert.match(totalText, /\| Dhonveli \| \$1,157\.79 \| \$77\.72 \| \$1,235\.51 \| −\$103\.36 \|/);
    assert.match(totalText, /\| Total \| \$1,877\.79 \| \$157\.72 \| \$4,035\.51 \| \+\$96\.64 \|/);
    assert.doesNotMatch(totalText, /Month to date/);

    const yesterdayOnly = parseSalesQuestion("Show me treatment sales and retail sales yesterday", names);
    assert.deepEqual(yesterdayOnly, { kind: "mix", yesterday: true, mtd: false });
    assert.doesNotMatch(answerSales(yesterdayOnly!, days, "2026-11-18"), /Month to date/);
  });
});
