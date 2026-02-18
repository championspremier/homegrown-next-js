import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const { profile } = await requireRole("admin");
  const supabase = await createClient();

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: groupSessions } = await supabase
    .from("sessions")
    .select(
      "id, session_type, session_date, session_time, duration_minutes, coach_id, assistant_coach_ids, gk_coach_id, attendance_limit, current_reservations, location, zoom_link, description, session_plan, status, location_type"
    )
    .eq("session_date", todayStr)
    .eq("status", "scheduled")
    .order("session_time", { ascending: true });

  const { data: individualBookings } = await supabase
    .from("individual_session_bookings")
    .select(
      "id, individual_session_type_id, coach_id, player_id, parent_id, booking_date, booking_time, duration_minutes, status, checked_in_at, cancelled_at, zoom_link, session_type:individual_session_types(id, name, color, location_type, duration_minutes)"
    )
    .eq("booking_date", todayStr)
    .eq("status", "confirmed")
    .is("cancelled_at", null)
    .order("booking_time", { ascending: true });

  const groupSessionIds = (groupSessions || []).map((s: { id: string }) => s.id);
  let reservations: Record<string, unknown>[] = [];
  if (groupSessionIds.length > 0) {
    const { data: resData, error: resError } = await supabase
      .from("session_reservations")
      .select("id, session_id, player_id, reservation_status, checked_in_at, checked_in_by")
      .in("session_id", groupSessionIds)
      .in("reservation_status", ["reserved", "checked-in"]);

    if (resError) {
      console.error("Reservations error:", resError);
    }

    if (resData && resData.length > 0) {
      const playerIds = [...new Set(resData.map((r) => r.player_id).filter(Boolean))];
      const { data: playerProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name")
        .in("id", playerIds);

      const playerMap: Record<string, Record<string, unknown>> = {};
      (playerProfiles || []).forEach((p: Record<string, unknown>) => {
        playerMap[p.id as string] = p;
      });

      reservations = resData.map((r) => ({
        ...r,
        player: playerMap[r.player_id] || null,
      }));
    }
  }

  const individualPlayerIds = (individualBookings || [])
    .map((b: { player_id: string }) => b.player_id)
    .filter(Boolean);
  let individualPlayers: Record<string, unknown>[] = [];
  if (individualPlayerIds.length > 0) {
    const { data: playersData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name")
      .in("id", individualPlayerIds);
    individualPlayers = (playersData || []) as Record<string, unknown>[];
  }

  const allCoachIds = new Set<string>();
  allCoachIds.add(profile.id);
  (groupSessions || []).forEach((s: Record<string, unknown>) => {
    if (s.coach_id) allCoachIds.add(s.coach_id as string);
    if (s.gk_coach_id) allCoachIds.add(s.gk_coach_id as string);
    if (Array.isArray(s.assistant_coach_ids)) {
      (s.assistant_coach_ids as string[]).forEach((id) => allCoachIds.add(id));
    }
  });
  (individualBookings || []).forEach((b: Record<string, unknown>) => {
    if (b.coach_id) allCoachIds.add(b.coach_id as string);
  });

  const { data: coachProfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, full_name, role")
    .in("id", Array.from(allCoachIds));

  const coaches: Record<string, { id: string; firstName: string; lastName: string; fullName: string; role: string }> = {};
  (coachProfiles || []).forEach((c: Record<string, unknown>) => {
    const id = c.id as string;
    coaches[id] = {
      id,
      firstName: (c.first_name as string) || "",
      lastName: (c.last_name as string) || "",
      fullName: (c.full_name as string) || `${(c.first_name as string) || ""} ${(c.last_name as string) || ""}`.trim(),
      role: (c.role as string) || "coach",
    };
  });

  const playerLookup: Record<string, Record<string, unknown>> = {};
  individualPlayers.forEach((p) => {
    playerLookup[p.id as string] = p;
  });

  const { data: sessionTypes } = await supabase.from("session_types").select("id, name, color");
  const sessionTypeColors: Record<string, string> = {};
  (sessionTypes || []).forEach((st: Record<string, unknown>) => {
    if (st.color) sessionTypeColors[st.name as string] = st.color as string;
  });

  return (
    <HomeClient
      profileId={profile.id}
      profileName={(profile as Record<string, unknown>).full_name as string || (profile as Record<string, unknown>).first_name as string || "Admin"}
      role="admin"
      todayStr={todayStr}
      groupSessions={(groupSessions || []) as never[]}
      individualBookings={(individualBookings || []) as never[]}
      reservations={reservations as never[]}
      coaches={coaches}
      playerLookup={playerLookup}
      sessionTypeColors={sessionTypeColors}
    />
  );
}
