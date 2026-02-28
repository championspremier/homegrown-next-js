/**
 * 12-month curriculum cycle:
 *   Jan–Mar → Build-Out
 *   Apr–Jun → Middle Third
 *   Jul–Sep → Final Third
 *   Oct–Dec → Wide Play
 */
const PERIOD_BY_QUARTER: Record<number, string> = {
  1: "build-out",
  2: "middle-third",
  3: "final-third",
  4: "wide-play",
};

export function getCurrentPeriod(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return PERIOD_BY_QUARTER[1];
  if (month <= 6) return PERIOD_BY_QUARTER[2];
  if (month <= 9) return PERIOD_BY_QUARTER[3];
  return PERIOD_BY_QUARTER[4];
}

export function getPeriodLabel(period: string): string {
  return period
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const ALL_PERIODS = ["build-out", "middle-third", "final-third", "wide-play"] as const;
