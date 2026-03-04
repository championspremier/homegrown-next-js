import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import { getCurrentPeriod } from "@/lib/curriculum-period";
import SoloClient from "./solo-client";

export const dynamic = "force-dynamic";

export default async function PlayerSoloPage() {
  const { activeProfile } = await requireActiveRole("player");
  const supabase = await createClient();

  const currentPeriod = getCurrentPeriod();

  const { data: sessions } = await (supabase as any)
    .from("solo_sessions")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const { data: videos } = await (supabase as any)
    .from("solo_session_videos")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: thumbnails } = await (supabase as any)
    .from("skill_thumbnails")
    .select("*");

  let likedVideoIds: string[] = [];
  try {
    const { data: likedRows } = await (supabase as any)
      .from("video_likes")
      .select("video_id")
      .eq("player_id", activeProfile.id);
    likedVideoIds = (likedRows || []).map((r: { video_id: string }) => r.video_id);
  } catch {
    // video_likes table may not exist yet
  }

  let exerciseLibrary: { id: string; name: string; category: string | null; equipment: string | null }[] = [];
  try {
    const { data: exRows } = await (supabase as any)
      .from("exercise_library")
      .select("id, name, category, equipment")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    exerciseLibrary = exRows ?? [];
  } catch {
    // table may not exist yet
  }

  let recentTrainingLogs: unknown[] = [];
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: logRows } = await (supabase as any)
      .from("training_logs")
      .select("*")
      .eq("player_id", activeProfile.id)
      .gte("training_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("training_date", { ascending: false })
      .order("created_at", { ascending: false });
    recentTrainingLogs = logRows ?? [];
  } catch {
    // table may not exist yet
  }

  // Weekly HG minutes: solo check-ins + group/virtual sessions
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMon);
  const mondayStr = weekStart.toISOString().split("T")[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const sundayStr = weekEnd.toISOString().split("T")[0];

  let weeklyHgMinutes = 0;
  try {
    const { count: soloCount } = await (supabase as any)
      .from("player_solo_session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("player_id", activeProfile.id)
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
      .eq("player_id", activeProfile.id)
      .eq("status", "active")
      .in("session_type", PHYSICAL_SESSION_TYPES)
      .gte("checked_in_at", weekStartISO)
      .lte("checked_in_at", weekEndISO);
    weeklyHgMinutes += (groupCount ?? 0) * 60;
  } catch { /* */ }

  // Player birth year → elite target hours (age + 1)
  let eliteTargetHours = 8;
  try {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("birth_year")
      .eq("id", activeProfile.id)
      .single();
    if (profile?.birth_year) {
      const age = new Date().getFullYear() - profile.birth_year;
      eliteTargetHours = age + 1;
    }
  } catch { /* */ }

  return (
    <SoloClient
      playerId={activeProfile.id}
      sessions={sessions ?? []}
      videos={videos ?? []}
      thumbnails={thumbnails ?? []}
      currentPeriod={currentPeriod}
      likedVideoIds={likedVideoIds}
      exerciseLibrary={exerciseLibrary}
      recentTrainingLogs={recentTrainingLogs}
      weeklyHgMinutes={weeklyHgMinutes}
      eliteTargetHours={eliteTargetHours}
    />
  );
}
