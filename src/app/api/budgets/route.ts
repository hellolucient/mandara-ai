import { json } from "@/lib/http";
import { sql } from "@/lib/db";
import { currentMember } from "@/lib/session";
import { newId } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const member = await currentMember();
  if (!member || member.role !== "admin") {
    return json({ error: "Admin access required" }, 403);
  }

  const body = await req.json();
  const text = body.text as string;

  if (!text?.trim()) {
    return json({ error: "No budget data provided" }, 400);
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  let imported = 0;
  const errors: string[] = [];

  // Get all location names to resolve location_id
  const locations = await sql<{ location_id: string; location_name: string }>(
    `select distinct location_id, location_name
     from sales_lines l
     join sales_days d on d.id = l.day_id
     where d.stage = $1`,
    [member.stage],
  );
  const locationByName = new Map(locations.map((loc) => [loc.location_name.toLowerCase(), loc.location_id]));
  const locationById = new Map(locations.map((loc) => [loc.location_id.toLowerCase(), loc.location_id]));

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length !== 3) {
      errors.push(`Invalid format: ${line}`);
      continue;
    }

    const [locationInput, monthStr, amountStr] = parts;

    // Parse month (YYYY-MM)
    const monthMatch = monthStr.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) {
      errors.push(`Invalid month format '${monthStr}' in: ${line}`);
      continue;
    }
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);

    if (month < 1 || month > 12) {
      errors.push(`Invalid month ${month} in: ${line}`);
      continue;
    }

    // Parse amount
    const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ""));
    if (isNaN(amount)) {
      errors.push(`Invalid amount '${amountStr}' in: ${line}`);
      continue;
    }

    // Resolve location
    const locationId =
      locationById.get(locationInput.toLowerCase()) || locationByName.get(locationInput.toLowerCase());

    if (!locationId) {
      errors.push(`Unknown location '${locationInput}' in: ${line}`);
      continue;
    }

    const locationName = locations.find((loc) => loc.location_id === locationId)?.location_name || locationInput;

    // Insert or update budget
    try {
      await sql(
        `insert into budgets (id, stage, location_id, location_name, year, month, amount)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (stage, location_id, year, month)
         do update set amount = excluded.amount`,
        [newId(), member.stage, locationId, locationName, year, month, amount],
      );
      imported++;
    } catch (error) {
      errors.push(`Database error for ${line}: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  if (errors.length > 0) {
    return json(
      {
        count: imported,
        errors,
        message: `Imported ${imported} budget(s) with ${errors.length} error(s)`,
      },
      207,
    );
  }

  return json({ count: imported });
}
