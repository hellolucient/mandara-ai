import { RevenueMixHomeSection } from "@/components/revenue-mix/home-section";
import { ensureDrilldownDemoSeed } from "@/lib/drilldown-demo-seed";
import { loadItemLinesForMix, loadRangeItemLinesForMix, loadRevenueMixHomeSnapshot } from "@/lib/revenue-mix";

export async function RevenueMixHomeLoader({ stage, latestDate }: { stage: string; latestDate: string }) {
  await ensureDrilldownDemoSeed(stage);
  const snapshot = await loadRevenueMixHomeSnapshot(stage, latestDate);
  if (!snapshot) return null;
  const monthStart = snapshot.monthStart;
  const [mtdLines, dayLines] = await Promise.all([
    loadRangeItemLinesForMix(stage, monthStart, latestDate),
    loadItemLinesForMix(stage, latestDate, latestDate),
  ]);
  return (
    <RevenueMixHomeSection
      snapshot={snapshot}
      linesJson={JSON.stringify(mtdLines)}
      dayLinesJson={JSON.stringify(dayLines)}
    />
  );
}