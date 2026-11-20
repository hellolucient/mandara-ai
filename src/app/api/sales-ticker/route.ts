import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Phones (especially a Home Screen app) must never show yesterday's copy.
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

type SalesLine = {
  location_name: string;
  treatment_sales: number | null;
  retail_sales: number | null;
};

export async function GET(request: NextRequest) {
  try {
    const stage = request.headers.get("x-mandara-stage") || "production";
    
    const latestDate = await sql<{ business_date: string }>(
      `select business_date::text
       from sales_days
       where stage = $1 and complete = true
       order by business_date desc
       limit 1`,
      [stage]
    );

    if (latestDate.length === 0) {
      return NextResponse.json({ spas: [] }, { headers: NO_STORE });
    }

    const date = latestDate[0].business_date;

    const lines = await sql<SalesLine>(
      `select sl.location_name, sl.treatment_sales, sl.retail_sales
       from sales_lines sl
       join sales_days sd on sd.id = sl.day_id
       where sd.stage = $1 and sd.business_date = $2
       order by sl.location_name`,
      [stage, date]
    );

    const spas = lines.map((line) => ({
      name: line.location_name,
      treatment: line.treatment_sales ?? 0,
      retail: line.retail_sales ?? 0,
      total: (line.treatment_sales ?? 0) + (line.retail_sales ?? 0),
    }));

    return NextResponse.json({ spas, date }, { headers: NO_STORE });
  } catch (error) {
    console.error("Sales ticker error:", error);
    return NextResponse.json({ spas: [] }, { headers: NO_STORE });
  }
}
