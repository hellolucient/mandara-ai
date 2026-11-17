const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type ImportSaved = {
  businessDate: string;
  locations: number;
  netSales: number;
};

export function formatImportConfirmation({ businessDate, locations, netSales }: ImportSaved): string {
  const [year, month, day] = businessDate.split("-").map(Number);
  const dateLabel = `${day} ${MONTHS[month - 1]} ${year}`;
  const spaLabel = locations === 1 ? "1 spa" : `${locations} spas`;
  const total = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(netSales));
  return `Saved ${dateLabel} · ${spaLabel} · ${total}`;
}

export function importTotals(rows: { netSales: number | null }[]): { locations: number; netSales: number } {
  return {
    locations: rows.length,
    netSales: rows.reduce((sum, row) => sum + (row.netSales ?? 0), 0),
  };
}
