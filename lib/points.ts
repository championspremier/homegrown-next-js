export function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return { year, quarter };
}

export function getSessionType(
  category: string,
  skill?: string | null
): string {
  switch (category) {
    case "technical":
      return "HG_TECHNICAL";
    case "physical":
      return skill === "speed" ? "HG_SPEED" : "Strength & Conditioning";
    case "mental":
      return "HG_MENTAL";
    case "tactical":
      return "HG_TACTICAL_REEL";
    default:
      return "Solo Session";
  }
}
