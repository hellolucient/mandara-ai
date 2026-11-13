import type { LoadedDay } from "@/lib/sales-types";

export const SAMPLE_LOCATIONS = [
  { id: "velifushi", name: "Cinnamon Velifushi", sort: 1 },
  { id: "north-male", name: "North Malé Spa", sort: 2 },
  { id: "south-ari", name: "South Ari Spa", sort: 3 },
  { id: "baa", name: "Baa Atoll Spa", sort: 4 },
  { id: "male-house", name: "Malé House Spa", sort: 5 },
] as const;

const BUDGET: Record<string, number | null> = {
  velifushi: 4500,
  "north-male": 3000,
  "south-ari": 2900,
  baa: 2100,
  "male-house": null,
};

const BASE: Record<string, number> = {
  velifushi: 4800,
  "north-male": 3100,
  "south-ari": 2800,
  baa: 2200,
  "male-house": 1500,
};

const OVERRIDES: Record<string, number | null> = {
  "2026-11-12:velifushi": 5100,
  "2026-11-12:north-male": 1900,
  "2026-11-12:south-ari": 2400,
  "2026-11-12:baa": null,
  "2026-11-12:male-house": 1600,
  "2026-11-11:velifushi": 4900,
  "2026-11-11:north-male": 3050,
  "2026-11-11:south-ari": 2750,
  "2026-11-11:baa": 2150,
  "2026-11-11:male-house": 1550,
  "2026-11-05:velifushi": 4700,
  "2026-11-05:north-male": 3250,
  "2026-11-05:south-ari": 2700,
  "2026-11-05:baa": 2300,
  "2026-11-05:male-house": 1400,
};

function salesFor(locationId: string, date: string): number | null {
  const key = `${date}:${locationId}`;
  if (key in OVERRIDES) return OVERRIDES[key];
  const day = Number(date.slice(-2));
  const wobble = ((day * 3) % 5) - 2;
  return BASE[locationId] + wobble * 50;
}

export function buildSampleDays(): LoadedDay[] {
  const days: LoadedDay[] = [];
  for (let day = 1; day <= 12; day += 1) {
    const businessDate = `2026-11-${String(day).padStart(2, "0")}`;
    days.push({
      businessDate,
      source: "sample",
      currency: "USD",
      complete: businessDate !== "2026-11-12",
      note: "Demonstration figures for the proof of concept. Not extracted from DSR.",
      lines: SAMPLE_LOCATIONS.map((location) => {
        const netSales = salesFor(location.id, businessDate);
        return {
          locationId: location.id,
          locationName: location.name,
          netSales,
          treatments: netSales == null ? null : Math.max(1, Math.round(netSales / 150)),
          budget: BUDGET[location.id],
        };
      }),
    });
  }
  return days;
}

export const SAMPLE_DOCUMENTS = [
  {
    id: "sample-opening",
    title: "Sample — treatment room opening",
    filename: "sample-treatment-room-opening.txt",
    visibility: "company" as const,
    body: `SAMPLE DOCUMENT. This is not a Mandara operating procedure. It is here so staff can try document questions before real files are uploaded.

Treatment room opening

Open the room 20 minutes before the first booking. Set the air to a comfortable cool temperature, light the room without a direct glare on the bed, and lay a fresh sheet set. Check the robe, slippers and water carafe. Confirm the booking name and the treatment length on the day sheet before greeting the guest. If a product allergy is noted on the booking, leave the matching product out of the room and tell the therapist before they begin.

Close of room

Strip used linen into the covered hamper, wipe the bed frame and sinks, and reset the room only after it is dry. Record any broken equipment on the same day's maintenance note.`,
  },
  {
    id: "sample-insurance",
    title: "Sample — insurance clause extract",
    filename: "sample-insurance-clause.txt",
    visibility: "restricted" as const,
    body: `SAMPLE DOCUMENT. This is not Mandara's operating agreement and it is not legal advice. It is an illustrative extract so the assistant can show a grounded answer with a source.

Insurance

The operator maintains public liability insurance of not less than the amount stated in schedule 4. The owner is named as an additional insured. The operator provides a current certificate within 14 days of each renewal. Deductibles are for the operator's account. The operator notifies the owner within 7 days of any cancellation, material reduction, or claim that is likely to exceed the deductible.`,
  },
  {
    id: "sample-locations",
    title: "Sample — demonstration locations",
    filename: "sample-locations.txt",
    visibility: "company" as const,
    body: `SAMPLE DOCUMENT. These names are a demonstration set for Mandara AI, not a confirmed list of Mandara Spa Maldives sites.

The sales examples use five labels: Cinnamon Velifushi, North Malé Spa, South Ari Spa, Baa Atoll Spa and Malé House Spa. Replace them with the live DSR location names after the first successful extract. Cinnamon Velifushi is included because managers already ask about that location. The other four names are placeholders.`,
  },
];
