#!/usr/bin/env python3
"""Convert Steiners Promotion Summary CSV to Mandara import JSON (stdlib only)."""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

# Must match DSR / sales import location short names in the app.
SPA_MAP = {
    "Ellaidoo": "Ellaidhoo",
    "Barcelo Nasandhura Male": "Nasandhura",
}

QTY_SUFFIX = " qty"
USD_SUFFIX = " usd"

TOTAL_MARKERS = {
    "total qty",
    "guest",
    "avg price",
    "nett",
    "tax",
    "service",
    "total usd",
    "total",
    "supplier",
}


def parse_money(value: str) -> float:
    if value is None:
        return 0.0
    text = str(value).strip().replace(",", "")
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def parse_qty(value: str) -> float:
    if value is None:
        return 0.0
    text = str(value).strip()
    if not text:
        return 0.0
    try:
        return float(text.replace(",", ""))
    except ValueError:
        return 0.0


def map_spa(name: str) -> str:
    return SPA_MAP.get(name.strip(), name.strip())


def period_from_filename(path: Path) -> tuple[str, str, str]:
    """Return (kind, period_from, period_to) from promo_{kind}_YYYY-MM-DD_YYYY-MM-DD.csv"""
    m = re.match(
        r"promo_(treatment|retail)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$",
        path.name,
        re.I,
    )
    if not m:
        raise ValueError(f"Filename must be promo_treatment_YYYY-MM-DD_YYYY-MM-DD.csv: {path.name}")
    return m.group(1).lower(), m.group(2), m.group(3)


def spa_columns(headers: list[str]) -> list[tuple[str, int, int]]:
    """List of (spa label, qty index, usd index)."""
    lower = [h.strip().lower() for h in headers]
    pairs: list[tuple[str, int, int]] = []
    for i, h in enumerate(headers):
        hl = h.strip()
        if not hl.endswith(QTY_SUFFIX):
            continue
        spa_label = hl[: -len(QTY_SUFFIX)].strip()
        usd_col = f"{spa_label}{USD_SUFFIX}"
        try:
            j = lower.index(usd_col.lower())
        except ValueError:
            continue
        if spa_label.lower() in TOTAL_MARKERS or spa_label.lower() == "total":
            continue
        pairs.append((spa_label, i, j))
    return pairs


def find_total_row(rows: list[dict[str, str]], headers: list[str]) -> dict[str, str] | None:
    for row in rows:
        no = (row.get(headers[0]) or row.get("No") or "").strip().lower()
        id_val = (row.get(headers[1]) if len(headers) > 1 else row.get("Id") or "").strip().lower()
        if no.startswith("total") or id_val == "total:" or no == "total:":
            return row
    return None


def aggregate_rows(
    data_rows: list[dict[str, str]],
    headers: list[str],
    spas: list[tuple[str, int, int]],
) -> tuple[list[dict], dict[str, dict[str, float]]]:
    out_rows: list[dict] = []
    per_spa: dict[str, dict[str, float]] = {
        map_spa(s[0]): {"qty": 0.0, "usd": 0.0} for s in spas
    }
    id_key = headers[1] if len(headers) > 1 else "Id"
    desc_key = headers[2] if len(headers) > 2 else "Description"

    for row in data_rows:
        code = (row.get(id_key) or "").strip()
        if not code or code.lower().startswith("total"):
            continue
        description = (row.get(desc_key) or "").strip()

        for spa_label, qi, ui in spas:
            qty_raw = row.get(headers[qi]) if qi < len(headers) else ""
            usd_raw = row.get(headers[ui]) if ui < len(headers) else ""
            qty = parse_qty(qty_raw)
            usd = parse_money(usd_raw)
            if qty_raw is not None and str(qty_raw).strip() == "" and (
                usd_raw is None or str(usd_raw).strip() == ""
            ):
                continue
            if qty == 0 and usd == 0:
                continue
            spa = map_spa(spa_label)
            out_rows.append(
                {
                    "spa": spa,
                    "promo_code": code,
                    "description": description,
                    "qty": qty,
                    "usd": round(usd, 2),
                }
            )
            per_spa[spa]["qty"] += qty
            per_spa[spa]["usd"] += usd

    for spa in per_spa:
        per_spa[spa]["qty"] = round(per_spa[spa]["qty"], 4)
        per_spa[spa]["usd"] = round(per_spa[spa]["usd"], 2)
    return out_rows, per_spa


def totals_from_row(
    total_row: dict[str, str],
    headers: list[str],
    spas: list[tuple[str, int, int]],
) -> dict:
    per_spa: dict[str, dict[str, float]] = {}
    values = [total_row.get(h, "") for h in headers]

    # The Total row is shifted: Id/Description hold the first spa pair, then each header spa pair is +1 spa.
    for k, (spa_label, _qi, _ui) in enumerate(spas):
        tqi = 1 + 2 * k
        tui = 2 + 2 * k
        spa = map_spa(spa_label)
        qty = parse_qty(values[tqi] if tqi < len(values) else "")
        usd = parse_money(values[tui] if tui < len(values) else "")
        per_spa[spa] = {"qty": qty, "usd": round(usd, 2)}

    base = 1 + 2 * len(spas)

    def at(offset: int) -> float:
        idx = base + offset
        if idx >= len(values):
            return 0.0
        raw = values[idx]
        return parse_qty(raw) if offset == 0 else parse_money(raw)

    # Footer fields sit two columns left of the header names on the Total row.
    return {
        "per_spa": per_spa,
        "total_qty": at(0),
        "guest": at(1),
        "nett": at(3),
        "tax": at(4),
        "service": at(5),
        "total_usd": at(6),
    }


def check_spa_mismatch(
    summed: dict[str, dict[str, float]],
    reported: dict[str, dict[str, float]],
    threshold: float = 0.01,
) -> list[str]:
    issues: list[str] = []
    all_spas = set(summed) | set(reported)
    for spa in sorted(all_spas):
        s = summed.get(spa, {"qty": 0, "usd": 0})
        r = reported.get(spa, {"qty": 0, "usd": 0})
        if abs(s["usd"] - r["usd"]) > threshold:
            issues.append(
                f"{spa}: summed USD {s['usd']:.2f} vs Total row {r['usd']:.2f} "
                f"(diff {s['usd'] - r['usd']:.2f})"
            )
    return issues


def convert_csv(path: Path, kind: str | None = None, period_from: str | None = None, period_to: str | None = None) -> dict:
    if kind is None or period_from is None or period_to is None:
        fk, ff, ft = period_from_filename(path)
        kind = kind or fk
        period_from = period_from or ff
        period_to = period_to or ft

    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError("CSV has no header")
        headers = list(reader.fieldnames)
        raw_rows = list(reader)

    spas = spa_columns(headers)
    if not spas:
        raise ValueError("No spa qty/usd column pairs found in header")

    total_row = find_total_row(raw_rows, headers)
    if not total_row:
        raise ValueError("No Total row found")

    data_rows = [r for r in raw_rows if r is not total_row]
    rows, summed_spa = aggregate_rows(data_rows, headers, spas)
    totals = totals_from_row(total_row, headers, spas)
    mismatches = check_spa_mismatch(summed_spa, totals["per_spa"])

    return {
        "period_from": period_from,
        "period_to": period_to,
        "kind": kind,
        "currency": "USD",
        "rows": rows,
        "totals": {
            "total_qty": totals["total_qty"],
            "guest": totals["guest"],
            "nett": round(totals["nett"], 2),
            "tax": round(totals["tax"], 2),
            "service": round(totals["service"], 2),
            "total_usd": round(totals["total_usd"], 2),
            "per_spa": totals["per_spa"],
        },
        "_reconciliation": {"summed_per_spa_usd": summed_spa, "mismatches": mismatches},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Steiners promo CSV → Mandara import JSON")
    parser.add_argument("csv", type=Path, help="Promotion summary CSV")
    parser.add_argument("-o", "--output", type=Path, help="Write JSON here (default stdout)")
    parser.add_argument("--check-only", action="store_true", help="Print reconciliation only")
    args = parser.parse_args(argv)

    payload = convert_csv(args.csv)
    mismatches = payload.pop("_reconciliation", {}).get("mismatches", [])
    for msg in mismatches:
        print(msg, file=sys.stderr)

    total = payload["totals"]["total_usd"]
    print(
        f"OK {payload['kind']} {payload['period_from']}..{payload['period_to']} "
        f"rows={len(payload['rows'])} Total USD {total:,.2f}",
        file=sys.stderr,
    )

    if args.check_only:
        return 1 if mismatches else 0

    text = json.dumps(payload, indent=2)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)
    return 1 if mismatches else 0


if __name__ == "__main__":
    raise SystemExit(main())