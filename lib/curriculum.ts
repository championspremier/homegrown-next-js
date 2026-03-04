export type Category = "technical" | "tactical" | "physical" | "mental";

// ── TECHNICAL: skills vary by period ──
// Source: CURRICULUM_BACKBONE from old app — Object.keys() of each period's technical section
export const TECHNICAL_SKILLS_BY_PERIOD: Record<string, string[]> = {
  "build-out":    ["first-touch", "escape-moves", "juggling", "passing"],
  "middle-third": ["first-touch", "escape-moves", "ball-mastery", "juggling", "turning", "finishing", "passing"],
  "final-third":  ["first-touch", "escape-moves", "ball-mastery", "juggling", "turning", "finishing", "passing"],
  "wide-play":    ["first-touch", "escape-moves", "ball-mastery", "juggling", "finishing", "passing"],
  "all":          ["first-touch", "escape-moves", "ball-mastery", "juggling", "turning", "finishing", "passing"],
};

// ── PHYSICAL: same across all periods ──
export const PHYSICAL_SKILLS = [
  "conditioning", "lower-body", "upper-body", "core", "speed", "plyometrics", "whole-body", "nutrition"
];

// Speed has sub-skills
export const PHYSICAL_SUB_SKILLS: Record<string, string[]> = {
  "speed": ["lateral", "linear"],
};

// ── MENTAL: same across all periods ──
export const MENTAL_SKILLS = [
  "meditation", "prayer", "breathing", "stretching", "sleep", "objectives"
];

// Mental skills that show Rest/Reps/Sets params (exercise-based)
export const MENTAL_EXERCISE_SKILLS = new Set(["stretching"]);

// ── TECHNICAL SUB-SKILLS ──
export const TECHNICAL_SUB_SKILLS: Record<string, string[]> = {
  "first-touch": ["on-ground", "half-volley", "full-volley", "weak-foot", "deception"],
  "escape-moves": ["fake-shots", "escaping-side-pressure", "fancy-escape"],
  "ball-mastery": ["slow-1v1s", "fast-dribbling"],
  "juggling": ["both-feet", "strong-foot", "blind-foot"],
  "turning": ["on-ground", "half-volley", "full-volley"],
  "finishing": ["on-ground", "half-volley", "full-volley"],
  "passing": ["on-ground", "half-volley", "full-volley"],
};

// All 7 unique technical skills (union across all periods)
export const ALL_TECHNICAL_SKILLS = TECHNICAL_SKILLS_BY_PERIOD["all"];

// Primary skills shown as session categories in the player view.
// Other skills (juggling, passing, finishing) are used as warm-up/finishing
// exercises within these sessions, not as standalone training categories.
export const PRIMARY_TECHNICAL_SKILLS_BY_PERIOD: Record<string, string[]> = {
  "build-out":    ["first-touch", "escape-moves"],
  "middle-third": ["first-touch", "escape-moves", "ball-mastery", "turning"],
  "final-third":  ["first-touch", "escape-moves", "ball-mastery", "turning"],
  "wide-play":    ["first-touch", "escape-moves", "ball-mastery"],
  "all":          ["first-touch", "escape-moves", "ball-mastery", "turning"],
};

// ── Helpers ──
export function getTechnicalSkillsForPeriod(period: string): string[] {
  return TECHNICAL_SKILLS_BY_PERIOD[period] ?? TECHNICAL_SKILLS_BY_PERIOD["all"];
}

export function getPrimaryTechnicalSkills(period: string): string[] {
  return PRIMARY_TECHNICAL_SKILLS_BY_PERIOD[period] ?? PRIMARY_TECHNICAL_SKILLS_BY_PERIOD["all"];
}

export function getSkillsForCategory(category: Category, period?: string): string[] {
  switch (category) {
    case "technical":
      return getTechnicalSkillsForPeriod(period ?? "all");
    case "physical":
      return PHYSICAL_SKILLS;
    case "mental":
      return MENTAL_SKILLS;
    case "tactical":
      return [];
  }
}

export function getDefaultPhysicalSeason(): string {
  const month = new Date().getMonth();
  return month >= 5 && month <= 6 ? "off-season" : "in-season";
}

export function formatLabel(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
