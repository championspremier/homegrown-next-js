import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import PlayerHomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function PlayerHomePage() {
  const { activeProfile } = await requireActiveRole("player");
  const supabase = await createClient();
  const playerId = activeProfile.id;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data: groupReservations } = await supabase
    .from("session_reservations")
    .select(`
      id, session_id, player_id, reservation_status, checked_in_at,
      session:sessions(
        id, session_type, session_date, session_time, duration_minutes,
        location_type, location, zoom_link, coach_id, attendance_limit, status,
        description
      )
    `)
    .eq("player_id", playerId)
    .in("reservation_status", ["reserved", "checked-in"]);

  const { data: individualBookings } = await supabase
    .from("individual_session_bookings")
    .select(`
      id, individual_session_type_id, coach_id, player_id, booking_date,
      booking_time, duration_minutes, status, checked_in_at, cancelled_at,
      zoom_link,
      session_type:individual_session_types(id, name, color, location_type, duration_minutes)
    `)
    .eq("player_id", playerId)
    .eq("status", "confirmed")
    .is("cancelled_at", null)
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true });

  const { data: soloBookings } = await supabase
    .from("player_solo_session_bookings")
    .select(`
      id, player_id, solo_session_id, scheduled_date, scheduled_time,
      completion_photo_url, status, checked_in_at, checked_in_by,
      solo_session:solo_sessions(id, title, category, skill, sub_skill, period, main_exercises)
    `)
    .eq("player_id", playerId)
    .in("status", ["scheduled", "pending_review", "checked-in", "denied"])
    .gte("scheduled_date", todayStr)
    .order("scheduled_date", { ascending: true });

  const coachIds = new Set<string>();
  (groupReservations || []).forEach((r: Record<string, unknown>) => {
    const session = r.session as Record<string, unknown> | null;
    if (session?.coach_id) coachIds.add(session.coach_id as string);
  });
  (individualBookings || []).forEach((b: Record<string, unknown>) => {
    if (b.coach_id) coachIds.add(b.coach_id as string);
  });

  const coaches: Record<string, { id: string; firstName: string; lastName: string }> = {};
  if (coachIds.size > 0) {
    const { data: coachProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(coachIds));
    (coachProfiles || []).forEach((c: Record<string, unknown>) => {
      coaches[c.id as string] = {
        id: c.id as string,
        firstName: (c.first_name as string) || "",
        lastName: (c.last_name as string) || "",
      };
    });
  }

  const { data: sessionTypes } = await supabase.from("session_types").select("id, name, color");
  const sessionTypeColors: Record<string, string> = {};
  (sessionTypes || []).forEach((st: Record<string, unknown>) => {
    if (st.color) sessionTypeColors[st.name as string] = st.color as string;
  });

  const { data: objectives } = await supabase
    .from("player_objectives")
    .select("id, in_possession_objective, out_of_possession_objective, created_at, coach_id")
    .eq("player_id", playerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Unanswered quiz assignments
  const { data: quizAssignments } = await (supabase as any)
    .from("quiz_assignments")
    .select(`
      id,
      status,
      quiz_question_id,
      quiz_questions (
        id,
        question,
        options,
        period,
        category
      )
    `)
    .eq("player_id", playerId)
    .eq("status", "assigned")
    .order("assigned_at", { ascending: false })
    .limit(10);

  // Active objectives with coach name
  const { data: activeObjectives } = await (supabase as any)
    .from("player_objectives")
    .select("id, in_possession_objective, out_of_possession_objective, created_at, coach:coach_id(first_name, last_name)")
    .eq("player_id", playerId)
    .eq("is_active", true)
    .maybeSingle();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", playerId)
    .eq("is_read", false);

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, message, notification_type, is_read, read_at, created_at, data")
    .eq("recipient_id", playerId)
    .order("created_at", { ascending: false })
    .limit(50);

  const currentMonth = today.getMonth() + 1;
  let quarter: number;
  if (currentMonth <= 3) quarter = 1;
  else if (currentMonth <= 6) quarter = 2;
  else if (currentMonth <= 9) quarter = 3;
  else quarter = 4;
  const currentYear = today.getFullYear();

  // @ts-expect-error - RPC args type not inferred from Database schema
  const { data: leaderboardData } = await supabase.rpc("get_quarterly_leaderboard", {
    p_quarter_year: currentYear,
    p_quarter_number: quarter,
    p_limit: 25,
  });

  const leaderboard = (leaderboardData || []).map((player: Record<string, unknown>) => {
    const pid = player.player_id as string;
    const firstName = (player.player_first_name as string) || "";
    const lastName = (player.player_last_name as string) || "";
    const initials = ((player.avatar_initials as string) || `${firstName.charAt(0)}${lastName.charAt(0)}`).toUpperCase();
    const points = parseFloat(String(player.total_points || 0)).toFixed(1);
    const position = (player.position as number) || 0;

    const { data: photoData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(`${pid}/avatar.jpg`);

    return {
      playerId: pid,
      firstName,
      lastName,
      initials,
      points,
      position,
      photoUrl: photoData?.publicUrl || null,
    };
  });

  // Weekly training data for Elite Standard KPI
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMon);
  const mondayStr = weekStart.toISOString().split("T")[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const sundayStr = weekEnd.toISOString().split("T")[0];

  let weeklyTotalMinutes = 0;

  try {
    const { data: manualLogs } = await (supabase as any)
      .from("training_logs")
      .select("duration_minutes")
      .eq("player_id", playerId)
      .gte("training_date", mondayStr)
      .lte("training_date", sundayStr);
    for (const log of manualLogs || []) weeklyTotalMinutes += log.duration_minutes || 0;
  } catch { /* table may not exist */ }

  try {
    const { count: soloCheckIns } = await (supabase as any)
      .from("player_solo_session_bookings")
      .select("id", { count: "exact", head: true })
      .eq("player_id", playerId)
      .eq("status", "checked-in")
      .gte("scheduled_date", mondayStr)
      .lte("scheduled_date", sundayStr);
    weeklyTotalMinutes += (soloCheckIns ?? 0) * 30;
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
    weeklyTotalMinutes += (groupCount ?? 0) * 60;
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

  const weeklyTotalHours = parseFloat((weeklyTotalMinutes / 60).toFixed(1));

  return (
    <PlayerHomeClient
      playerId={playerId}
      playerName={activeProfile.full_name || "Player"}
      todayStr={todayStr}
      groupReservations={(groupReservations || []) as never[]}
      individualBookings={(individualBookings || []) as never[]}
      coaches={coaches}
      sessionTypeColors={sessionTypeColors}
      objectives={objectives as never}
      unreadNotificationCount={unreadCount || 0}
      notifications={(notifications || []) as never[]}
      leaderboard={leaderboard}
      soloBookings={(soloBookings || []) as never[]}
      weeklyTotalHours={weeklyTotalHours}
      eliteTargetHours={eliteTargetHours}
      quizAssignments={(quizAssignments || []) as never[]}
      activeObjectives={activeObjectives as never}
    />
  );
}
