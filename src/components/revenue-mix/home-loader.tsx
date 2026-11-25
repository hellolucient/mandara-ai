import { RevenueMixHomeSection } from "@/components/revenue-mix/home-section";
import { ensureDrilldownDemoSeed } from "@/lib/drilldown-demo-seed";
import { loadItemLinesForMix, loadRevenueMixHomeSnapshot } from "@/lib/revenue-mix";

export async function RevenueMixHomeLoader({ stage, latestDate }: { stage: string; latestDate: string }) {
  await ensureDrilldownDemoSeed(stage);
  const snapshot = await loadRevenueMixHomeSnapshot(stage, latestDate);
  if (!snapshot) return null;
  const monthStart = snapshot.monthStart;
  const lines = await loadItemLinesForMix(stage, monthStart, latestDate);
  return <RevenueMixHomeSection snapshot={snapshot} linesJson={JSON.stringify(lines)} />;
}