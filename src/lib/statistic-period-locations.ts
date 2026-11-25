/** Map Steiners Statistic Summary spa column headers to Mandara short names. */
export const STATISTIC_SPA_MAP: Record<string, string> = {
  "Chavanaspa Dhonveli": "Dhonveli",
  "Hakuraa Huraa": "Hakuraa Huraa",
  "Chavanaspa Rannalhi": "Rannalhi",
  "Mandara Spa Meedhupparu": "Meedhupparu",
  "Adaaran Hudhuranfushi": "Hudhuranfushi",
  "Chavanaspa Ellaidoo": "Ellaidhoo",
  "Mandara Spa Vadoo": "Vadoo",
  "Cinnamon Velifushi": "Velifushi",
  "Madifushi Private Island": "Madifushi",
  "Nooe Kunaavashi": "Kunaavashi",
  "Melia Whale Lagoon": "Melia Whale Lagoon",
  "Barcelo Nasandhura Male": "Nasandhura",
};

/** Closed properties; omitted from imports and UI unless they have non-zero revenue. */
export const STATISTIC_CLOSED_SPAS = new Set(["Madifushi", "Melia Whale Lagoon"]);

export function mapStatisticSpaName(headerName: string): string {
  const trimmed = headerName.trim();
  return STATISTIC_SPA_MAP[trimmed] ?? trimmed;
}