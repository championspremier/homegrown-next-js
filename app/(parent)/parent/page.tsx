import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import ParentHomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function ParentHomePage() {
  const { activeProfile } = await requireActiveRole("parent");
  const supabase = await createClient();
  const parentId = activeProfile.id;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Fetch linked players
  const { data: relationships } = await supabase
    .from("parent_player_relationships")
    .select("player_id")
    .eq("parent_id", parentId);

  const playerIds = (relationships || []).map(
    (r: Record<string, unknown>) => r.player_id as string
  );

  // Fetch player profiles
  const linkedPlayers: Record<
    string,
    { id: string; firstName: string; lastName: string }
  > = {};
  if (playerIds.length > 0) {
    const { data: playerProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", playerIds);
    (playerProfiles || []).forEach((p: Record<string, unknown>) => {
      linkedPlayers[p.id as string] = {
        id: p.id as string,
        firstName: (p.first_name as string) || "",
        lastName: (p.last_name as string) || "",
      };
    });
  }

  // Fetch group reservations for ALL linked players
  let groupReservations: unknown[] = [];
  if (playerIds.length > 0) {
    const { data } = await supabase
      .from("session_reservations")
      .select(
        `
        id, session_id, player_id, reservation_status, checked_in_at,
        session:sessions(
          id, session_type, session_date, session_time, duration_minutes,
          location_type, location, zoom_link, coach_id, attendance_limit, status,
          description
        )
      `
      )
      .in("player_id", playerIds)
      .in("reservation_status", ["reserved", "checked-in"]);
    groupReservations = data || [];
  }

  // Fetch individual bookings for ALL linked players
  let individualBookings: unknown[] = [];
  if (playerIds.length > 0) {
    const { data } = await supabase
      .from("individual_session_bookings")
      .select(
        `
        id, individual_session_type_id, coach_id, player_id, booking_date,
        booking_time, duration_minutes, status, checked_in_at, cancelled_at,
        zoom_link,
        session_type:individual_session_types(id, name, color, location_type, duration_minutes)
      `
      )
      .in("player_id", playerIds)
      .eq("status", "confirmed")
      .is("cancelled_at", null)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });
    individualBookings = data || [];
  }

  // Gather coach IDs and fetch profiles
  const coachIds = new Set<string>();
  (groupReservations as Record<string, unknown>[]).forEach((r) => {
    const session = r.session as Record<string, unknown> | null;
    if (session?.coach_id) coachIds.add(session.coach_id as string);
  });
  (individualBookings as Record<string, unknown>[]).forEach((b) => {
    if (b.coach_id) coachIds.add(b.coach_id as string);
  });

  const coaches: Record<
    string,
    { id: string; firstName: string; lastName: string }
  > = {};
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

  // Session type colors
  const { data: sessionTypes } = await supabase
    .from("session_types")
    .select("id, name, color");
  const sessionTypeColors: Record<string, string> = {};
  (sessionTypes || []).forEach((st: Record<string, unknown>) => {
    if (st.color) sessionTypeColors[st.name as string] = st.color as string;
  });

  // Quarterly leaderboard
  const currentMonth = today.getMonth() + 1;
  let quarter: number;
  if (currentMonth <= 3) quarter = 1;
  else if (currentMonth <= 6) quarter = 2;
  else if (currentMonth <= 9) quarter = 3;
  else quarter = 4;

  // @ts-expect-error - RPC args type not inferred from Database schema
  const { data: leaderboardData } = await supabase.rpc(
    "get_quarterly_leaderboard",
    {
      p_quarter_year: today.getFullYear(),
      p_quarter_number: quarter,
      p_limit: 25,
    }
  );

  const leaderboard = (leaderboardData || []).map(
    (player: Record<string, unknown>) => {
      const pid = player.player_id as string;
      const firstName = (player.player_first_name as string) || "";
      const lastName = (player.player_last_name as string) || "";
      const initials = (
        (player.avatar_initials as string) ||
        `${firstName.charAt(0)}${lastName.charAt(0)}`
      ).toUpperCase();
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
    }
  );

  // Unread notification count
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", parentId)
    .eq("is_read", false);

  // Notifications
  const { data: notifications } = await supabase
    .from("notifications")
    .select(
      "id, title, message, notification_type, is_read, read_at, created_at, data"
    )
    .eq("recipient_id", parentId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ParentHomeClient
      parentId={parentId}
      parentName={activeProfile.full_name || "Parent"}
      todayStr={todayStr}
      linkedPlayers={linkedPlayers}
      groupReservations={groupReservations as never[]}
      individualBookings={individualBookings as never[]}
      coaches={coaches}
      sessionTypeColors={sessionTypeColors}
      leaderboard={leaderboard}
      unreadNotificationCount={unreadCount || 0}
      notifications={(notifications || []) as never[]}
    />
  );
}
