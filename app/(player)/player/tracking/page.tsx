import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/curriculum-period";
import TrackingClient from "./tracking-client";

export const dynamic = "force-dynamic";

/* ── Spider pillar definitions ── */
const TACTICAL_AXES = ["build-out", "middle-third", "final-third", "wide-play"];
const TECHNICAL_AXES = ["ball-mastery", "turning", "escape-moves", "first-touch"];
const PHYSICAL_AXES = ["conditioning", "speed", "strength", "coordination"];
const MENTAL_AXES = ["solo", "objectives", "psychologist", "maturity", "socially", "work-ethic"];
const MENTAL_COACH_ONLY = new Set(["maturity", "socially", "work-ethic"]);

const TACTICAL_SESSION_TYPES = new Set([
  "Tec Tac", "Champions Player Progress (CPP)", "Group Film-Analysis",
]);

function periodForDate(dateStr: string): string {
  const m = new Date(dateStr).getMonth() + 1;
  if (m <= 3) return "build-out";
  if (m <= 6) return "middle-third";
  if (m <= 9) return "final-third";
  return "wide-play";
}

function inc(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export default async function PlayerTrackingPage() {
  const { activeProfile } = await requireActiveRole("player");
  const supabase = await createClient();
  const playerId = activeProfile.id;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentQuarter = Math.ceil((today.getMonth() + 1) / 3);
  const quarterStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
  const quarterEnd = new Date(currentYear, currentQuarter * 3, 0, 23, 59, 59);
  const quarterStartStr = quarterStart.toISOString().split("T")[0];
  const quarterEndIso = quarterEnd.toISOString();
  const quarterEndStr = quarterEnd.toISOString().split("T")[0];
  const currentPeriod = getCurrentPeriod();

  /* ── Leaderboard ── */
  let leaderboardPosition = 0;
  let quarterPoints = 0;
  try {
    // @ts-expect-error - RPC args type not inferred
    const { data: lbData } = await supabase.rpc("get_quarterly_leaderboard", {
      p_quarter_year: currentYear,
      p_quarter_number: currentQuarter,
      p_limit: 200,
    });
    const rows = lbData || [];
    const myRow = rows.find((r: Record<string, unknown>) => r.player_id === playerId);
    if (myRow) {
      leaderboardPosition = (myRow as Record<string, unknown>).position as number || 0;
      quarterPoints = parseFloat(String((myRow as Record<string, unknown>).total_points || 0));
    }
  } catch { /* */ }

  /* ── Activity data (last 365 days) ── */
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const yearAgoStr = oneYearAgo.toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];
  const activityMap = new Map<string, { count: number; types: Set<string> }>();

  try {
    const { data: progressRows } = await (supabase as any)
      .from("player_curriculum_progress")
      .select("completed_at")
      .eq("player_id", playerId)
      .gte("completed_at", oneYearAgo.toISOString());
    for (const r of progressRows || []) {
      if (!r.completed_at) continue;
      const d = r.completed_at.split("T")[0];
      if (!activityMap.has(d)) activityMap.set(d, { count: 0, types: new Set() });
      const entry = activityMap.get(d)!;
      entry.count++;
      entry.types.add("Solo");
    }
  } catch { /* */ }

  /* ── Points transactions (current quarter — for spider + history) ── */
  let transactions: Record<string, unknown>[] = [];
  try {
    const { data } = await (supabase as any)
      .from("points_transactions")
      .select("id, points, checked_in_at, session_type, session_id")
      .eq("player_id", playerId)
      .eq("quarter_year", currentYear)
      .eq("quarter_number", currentQuarter)
      .eq("status", "active")
      .order("checked_in_at", { ascending: false });
    transactions = data ?? [];
  } catch { /* */ }

  // Also feed transactions into activity map
  try {
    const { data: ptRows } = await (supabase as any)
      .from("points_transactions")
      .select("checked_in_at, session_type")
      .eq("player_id", playerId)
      .eq("status", "active")
      .gte("checked_in_at", oneYearAgo.toISOString());
    for (const r of ptRows || []) {
      if (!r.checked_in_at) continue;
      const d = r.checked_in_at.split("T")[0];
      if (!activityMap.has(d)) activityMap.set(d, { count: 0, types: new Set() });
      const entry = activityMap.get(d)!;
      entry.count++;
      entry.types.add(r.session_type || "Session");
    }
  } catch { /* */ }

  try {
    const { data: logRows } = await (supabase as any)
      .from("training_logs")
      .select("training_date, training_type")
      .eq("player_id", playerId)
      .gte("training_date", yearAgoStr)
      .lte("training_date", todayStr);
    for (const r of logRows || []) {
      const d = r.training_date;
      if (!activityMap.has(d)) activityMap.set(d, { count: 0, types: new Set() });
      const entry = activityMap.get(d)!;
      entry.count++;
      entry.types.add(r.training_type || "Training");
    }
  } catch { /* */ }

  const activityData = Array.from(activityMap.entries()).map(([date, val]) => ({
    date,
    count: val.count,
    types: Array.from(val.types),
  }));

  /* ── Curriculum progress (current quarter — for spider) ── */
  let progressRows: Record<string, unknown>[] = [];
  try {
    const { data } = await (supabase as any)
      .from("player_curriculum_progress")
      .select("period, category, skill, completed_at")
      .eq("player_id", playerId)
      .gte("completed_at", quarterStartStr)
      .lte("completed_at", quarterEndIso);
    progressRows = data ?? [];
  } catch { /* */ }

  /* ── Training logs (current quarter — for spider) ── */
  let quarterTrainingLogs: Record<string, unknown>[] = [];
  try {
    const { data } = await (supabase as any)
      .from("training_logs")
      .select("training_type, training_date")
      .eq("player_id", playerId)
      .gte("training_date", quarterStartStr)
      .lte("training_date", quarterEndStr);
    quarterTrainingLogs = data ?? [];
  } catch { /* */ }

  /* ── Solo sessions lookup (for mapping session_id → category/skill) ── */
  const soloSessionIds = new Set<string>();
  for (const t of transactions) {
    if ((t.session_type === "Solo Session" || t.session_type === "HG_TECHNICAL") && t.session_id) {
      soloSessionIds.add(t.session_id as string);
    }
  }

  const soloSessionMap = new Map<string, { category: string; skill: string }>();
  if (soloSessionIds.size > 0) {
    try {
      const { data: ssRows } = await (supabase as any)
        .from("solo_sessions")
        .select("id, category, skill")
        .in("id", Array.from(soloSessionIds));
      for (const ss of ssRows || []) {
        soloSessionMap.set(ss.id, { category: ss.category || "", skill: ss.skill || "" });
      }
    } catch { /* */ }
  }

  /* ── Compute spider scores ── */
  const rawScores = {
    tactical: Object.fromEntries(TACTICAL_AXES.map((a) => [a, 0])),
    technical: Object.fromEntries(TECHNICAL_AXES.map((a) => [a, 0])),
    physical: Object.fromEntries(PHYSICAL_AXES.map((a) => [a, 0])),
    mental: Object.fromEntries(MENTAL_AXES.map((a) => [a, 0])),
  };

  for (const t of transactions) {
    const st = t.session_type as string;
    const sid = t.session_id as string | null;
    const checkedAt = t.checked_in_at as string | null;

    // TACTICAL
    if (TACTICAL_SESSION_TYPES.has(st)) {
      const period = checkedAt ? periodForDate(checkedAt) : currentPeriod;
      if (TACTICAL_AXES.includes(period)) inc(rawScores.tactical, period);
    }

    // TECHNICAL — Solo Session or HG_TECHNICAL
    if (st === "Solo Session" || st === "HG_TECHNICAL") {
      const ss = sid ? soloSessionMap.get(sid) : null;
      if (ss?.category === "technical") {
        const skill = (ss.skill || "ball-mastery").toLowerCase().replace(/\s+/g, "-");
        const axis = TECHNICAL_AXES.includes(skill) ? skill : "ball-mastery";
        inc(rawScores.technical, axis);
      } else if (ss?.category === "mental") {
        inc(rawScores.mental, "solo");
      }
    }

    // PHYSICAL
    if (st === "Strength & Conditioning") {
      inc(rawScores.physical, "strength");
      inc(rawScores.physical, "conditioning");
    }
    if (st === "Speed Training" || st === "HG_SPEED") {
      inc(rawScores.physical, "speed");
    }
    if (st === "Free Nutrition Consultation") {
      inc(rawScores.physical, "conditioning");
    }

    // MENTAL
    if (st === "Psychologist") inc(rawScores.mental, "psychologist");
    if (st === "HG_MENTAL") inc(rawScores.mental, "solo");
    if (st === "HG_OBJECTIVE") inc(rawScores.mental, "objectives");
    if (st === "Pro Player Stories (PPS)") inc(rawScores.mental, "solo");
    if (st === "College Advising") inc(rawScores.mental, "solo");
  }

  // Curriculum progress → spider
  for (const p of progressRows) {
    const cat = (p.category as string || "").toLowerCase();
    const skill = (p.skill as string || "").toLowerCase().replace(/\s+/g, "-");
    const period = (p.period as string || currentPeriod).toLowerCase();

    if (cat === "tactical") {
      const axis = TACTICAL_AXES.includes(period) ? period : currentPeriod;
      inc(rawScores.tactical, axis);
    } else if (cat === "technical") {
      const axis = TECHNICAL_AXES.includes(skill) ? skill : "ball-mastery";
      inc(rawScores.technical, axis);
    } else if (cat === "physical") {
      if (skill === "conditioning") inc(rawScores.physical, "conditioning");
      else if (skill === "speed") inc(rawScores.physical, "speed");
      else if (["lower-body", "upper-body", "core"].includes(skill)) inc(rawScores.physical, "strength");
      else if (["plyometrics", "whole-body"].includes(skill)) inc(rawScores.physical, "coordination");
    } else if (cat === "mental") {
      inc(rawScores.mental, "solo");
    }
  }

  // Training logs → physical spider
  for (const l of quarterTrainingLogs) {
    const tt = l.training_type as string;
    if (tt === "strength") inc(rawScores.physical, "strength");
    if (tt === "speed") inc(rawScores.physical, "speed");
    if (tt === "team-training") inc(rawScores.physical, "conditioning");
  }

  /* ── Coach player ratings (for maturity/socially/work-ethic) ── */
  const effectivePlayerId = playerId;
  let coachRating: { maturity: number; socially: number; work_ethic: number } | null = null;
  try {
    const { data: ratingData, error } = await (supabase as any)
      .from("coach_player_ratings")
      .select("maturity, socially, work_ethic")
      .eq("player_id", effectivePlayerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log("[COACH RATINGS] effectivePlayerId:", effectivePlayerId);
    console.log("[COACH RATINGS] query result:", { data: ratingData, error });
    const ratingRow = Array.isArray(ratingData) ? ratingData[0] : ratingData;
    if (ratingRow) coachRating = ratingRow;
  } catch (e) {
    console.log("[COACH RATINGS] catch:", e);
  }

  const effectiveCoachOnly = new Set(MENTAL_COACH_ONLY);
  if (coachRating) {
    rawScores.mental["maturity"] = coachRating.maturity;
    rawScores.mental["socially"] = coachRating.socially;
    rawScores.mental["work-ethic"] = coachRating.work_ethic;
    effectiveCoachOnly.delete("maturity");
    effectiveCoachOnly.delete("socially");
    effectiveCoachOnly.delete("work-ethic");
  }

  function capScores(raw: Record<string, number>, coachOnly?: Set<string>): Record<string, number | null> {
    const out: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = coachOnly?.has(k) ? null : Math.min(10, v);
    }
    return out;
  }

  // [SPIDER DEBUG] — temporary, remove after verifying Film-Analysis data
  console.log("[SPIDER DEBUG] Tactical transactions:",
    transactions
      .filter((t) => TACTICAL_SESSION_TYPES.has(t.session_type as string))
      .map((t) => ({
        type: t.session_type,
        date: t.checked_in_at,
        period: periodForDate(t.checked_in_at as string),
      }))
  );
  console.log("[SPIDER DEBUG] Raw tactical scores:", rawScores.tactical);

  const spiderData = {
    tactical: {
      axes: TACTICAL_AXES.map((a) => ({ key: a, label: a.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), coachOnly: false })),
      scores: capScores(rawScores.tactical),
    },
    technical: {
      axes: TECHNICAL_AXES.map((a) => ({ key: a, label: a.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), coachOnly: false })),
      scores: capScores(rawScores.technical),
    },
    physical: {
      axes: PHYSICAL_AXES.map((a) => ({ key: a, label: a.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), coachOnly: false })),
      scores: capScores(rawScores.physical),
    },
    mental: {
      axes: MENTAL_AXES.map((a) => ({ key: a, label: a.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), coachOnly: effectiveCoachOnly.has(a) })),
      scores: capScores(rawScores.mental, effectiveCoachOnly),
    },
  };

  const pointsData = {
    total: quarterPoints,
    position: leaderboardPosition > 0 ? leaderboardPosition : null,
    quarterLabel: `Q${currentQuarter} ${currentYear}`,
    history: transactions.map((t) => ({
      checked_in_at: t.checked_in_at as string,
      session_type: t.session_type as string,
      points: parseFloat(String(t.points || 0)),
    })),
  };

  /* ── Exercise library + recent logs + weekly data ── */
  let exerciseLibrary: { id: string; name: string; category: string | null; equipment: string | null }[] = [];
  try {
    const { data: exRows } = await (supabase as any)
      .from("exercise_library")
      .select("id, name, category, equipment")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    exerciseLibrary = exRows ?? [];
  } catch { /* */ }

  let recentTrainingLogs: unknown[] = [];
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: logRows } = await (supabase as any)
      .from("training_logs")
      .select("*")
      .eq("player_id", playerId)
      .gte("training_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("training_date", { ascending: false })
      .order("created_at", { ascending: false });
    recentTrainingLogs = logRows ?? [];
  } catch { /* */ }

  const dayOfWeek = today.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + diffToMon);
  const mondayStr = weekStart.toISOString().split("T")[0];
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekStart.getDate() + 6);
  const sundayStr = weekEndDate.toISOString().split("T")[0];

  let weeklyHgMinutes = 0;
  try {
    const { count: soloCount } = await (supabase as any)
      .from("player_solo_session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("status", "checked-in")
      .gte("scheduled_date", mondayStr)
      .lte("scheduled_date", sundayStr);
    weeklyHgMinutes += (soloCount ?? 0) * 30;
  } catch { /* */ }

  try {
    const PHYSICAL_SESSION_TYPES = ["Tec Tac", "Speed Training", "Strength & Conditioning"];
    const weekStartISO = new Date(mondayStr + "T00:00:00Z").toISOString();
    const weekEndISO = new Date(sundayStr + "T23:59:59Z").toISOString();
    const { count: groupCount } = await (supabase as any)
      .from("points_transactions")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("status", "active")
      .in("session_type", PHYSICAL_SESSION_TYPES)
      .gte("checked_in_at", weekStartISO)
      .lte("checked_in_at", weekEndISO);
    weeklyHgMinutes += (groupCount ?? 0) * 60;
  } catch { /* */ }

  let eliteTargetHours = 8;
  try {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("birth_year")
      .eq("id", playerId)
      .single();
    if (profile?.birth_year) {
      eliteTargetHours = new Date().getFullYear() - profile.birth_year + 1;
    }
  } catch { /* */ }

  /* ── Quiz history (answered) ── */
  let quizHistory: unknown[] = [];
  try {
    const { data } = await (supabase as any)
      .from("quiz_assignments")
      .select(`
        id,
        selected_answer,
        is_correct,
        answered_at,
        points_awarded,
        status,
        quiz_question:quiz_questions (
          question,
          options,
          correct_answer,
          explanation,
          period,
          category
        )
      `)
      .eq("player_id", playerId)
      .eq("status", "answered")
      .order("answered_at", { ascending: false })
      .limit(20);
    quizHistory = data ?? [];
  } catch { /* table may not exist */ }

  /* ── Player objectives ── */
  let activeObjectives: unknown = null;
  try {
    const { data } = await (supabase as any)
      .from("player_objectives")
      .select("id, in_possession_objective, out_of_possession_objective, is_active, created_at")
      .eq("player_id", playerId)
      .eq("is_active", true)
      .maybeSingle();
    activeObjectives = data;
  } catch { /* */ }

  let pastObjectives: unknown[] = [];
  try {
    const { data } = await (supabase as any)
      .from("player_objectives")
      .select("id, in_possession_objective, out_of_possession_objective, completed_at, created_at")
      .eq("player_id", playerId)
      .eq("is_active", false)
      .order("completed_at", { ascending: false })
      .limit(10);
    pastObjectives = data ?? [];
  } catch { /* */ }

  return (
    <TrackingClient
      playerId={playerId}
      leaderboardPosition={leaderboardPosition}
      quarterPoints={quarterPoints}
      activityData={activityData}
      exerciseLibrary={exerciseLibrary}
      recentTrainingLogs={recentTrainingLogs}
      weeklyHgMinutes={weeklyHgMinutes}
      eliteTargetHours={eliteTargetHours}
      spiderData={spiderData}
      pointsData={pointsData}
      quizHistory={quizHistory}
      activeObjectives={activeObjectives}
      pastObjectives={pastObjectives}
    />
  );
}
