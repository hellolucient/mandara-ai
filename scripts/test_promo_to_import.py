#!/usr/bin/env python3
import unittest
from pathlib import Path

from promo_to_import import convert_csv

ROOT = Path(__file__).resolve().parent.parent
BACKFILL = ROOT / "data" / "promo-backfill"

EXPECTED_TOTAL_USD = {
    "promo_treatment_2026-11-24_2026-11-24.csv": 10467.83,
    "promo_treatment_2026-11-01_2026-11-24.csv": 280082.01,
    "promo_treatment_2026-10-01_2026-10-31.csv": 358371.45,
    "promo_treatment_2026-09-01_2026-09-30.csv": 304705.07,
    "promo_retail_2026-11-01_2026-11-24.csv": 11911.48,
}


class PromoConverterTests(unittest.TestCase):
    def test_total_usd_matches_steiners(self):
        for name, expected in EXPECTED_TOTAL_USD.items():
            path = BACKFILL / name
            with self.subTest(file=name):
                self.assertTrue(path.is_file(), f"missing {path}")
                payload = convert_csv(path)
                recon = payload.pop("_reconciliation", {})
                mismatches = recon.get("mismatches", [])
                self.assertEqual(
                    len(mismatches),
                    0,
                    f"per-spa mismatch: {mismatches[:3]}",
                )
                got = payload["totals"]["total_usd"]
                self.assertAlmostEqual(got, expected, places=2, msg=f"Total USD for {name}")

    def test_spa_name_mapping(self):
        path = BACKFILL / "promo_treatment_2026-11-24_2026-11-24.csv"
        payload = convert_csv(path)
        payload.pop("_reconciliation", None)
        spas = {r["spa"] for r in payload["rows"]}
        self.assertIn("Ellaidhoo", spas)
        self.assertNotIn("Ellaidoo", spas)
        per = payload["totals"]["per_spa"]
        self.assertIn("Nasandhura", per)
        self.assertIn("Ellaidhoo", per)

    def test_blank_description_kept(self):
        path = BACKFILL / "promo_treatment_2026-11-01_2026-11-24.csv"
        payload = convert_csv(path)
        payload.pop("_reconciliation", None)
        potd = [r for r in payload["rows"] if r["promo_code"] == "POTD"]
        self.assertTrue(potd)
        self.assertEqual(potd[0]["description"], "")


if __name__ == "__main__":
    unittest.main()