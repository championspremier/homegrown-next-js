import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

export interface LinkedPlayer {
  player_id: string;
  player: Profile;
}

export async function getLinkedPlayers(parentId: string): Promise<LinkedPlayer[]> {
  const supabase = await createClient();
  const { data: relsData, error: relError } = await supabase
    .from("parent_player_relationships")
    .select("player_id")
    .eq("parent_id", parentId);
  const rels = (relsData ?? []) as { player_id: string }[];
  if (relError || !rels.length) return [];
  const ids = rels.map((r) => r.player_id);
  const { data: profilesData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .in("id", ids);
  const profiles = (profilesData ?? []) as Profile[];
  if (profileError || !profiles.length) return [];
  return profiles.map((p) => ({
    player_id: p.id,
    player: p,
  }));
}

export interface PlayerDashboard {
  profile: Profile;
  upcomingGroupCount: number;
  upcomingIndividualCount: number;
}

export async function getPlayerDashboard(activePlayerId: string): Promise<PlayerDashboard | null> {
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", activePlayerId)
    .single();
  if (profileError || !profile) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { count: groupCount } = await supabase
    .from("group_reservations")
    .select("id", { count: "exact", head: true })
    .eq("player_id", activePlayerId)
    .gte("created_at", today);
  const { count: individualCount } = await supabase
    .from("individual_session_bookings")
    .select("id", { count: "exact", head: true })
    .eq("player_id", activePlayerId)
    .in("status", ["confirmed", "pending"])
    .gte("booking_date", today);
  return {
    profile: profile as Profile,
    upcomingGroupCount: groupCount ?? 0,
    upcomingIndividualCount: individualCount ?? 0,
  };
}

type GroupReservationRow = { id: string; status: string; created_at: string; group_session_id: string };

export async function getUpcomingGroupReservations(activePlayerId: string) {
  const supabase = await createClient();
  const { data: reservationsData, error } = await supabase
    .from("group_reservations")
    .select("id, status, created_at, group_session_id")
    .eq("player_id", activePlayerId)
    .order("created_at", { ascending: false })
    .limit(20);
  const reservations = (reservationsData ?? []) as GroupReservationRow[];
  if (error || !reservations.length) return [];
  const sessionIds = Array.from(new Set(reservations.map((r) => r.group_session_id)));
  const { data: sessionsData } = await supabase
    .from("group_sessions")
    .select("id, title, session_date, session_time")
    .in("id", sessionIds);
  const sessions = (sessionsData ?? []) as { id: string; title: string | null; session_date: string; session_time: string }[];
  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  return reservations.map((r) => ({
    ...r,
    group_session: sessionMap.get(r.group_session_id) ?? null,
  }));
}

type IndividualBookingRow = { id: string; booking_date: string; booking_time: string; status: string; coach_id: string; session_type_id: string };

export async function getUpcomingIndividualBookings(activePlayerId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: bookingsData, error } = await supabase
    .from("individual_session_bookings")
    .select("id, booking_date, booking_time, status, coach_id, session_type_id")
    .eq("player_id", activePlayerId)
    .gte("booking_date", today)
    .in("status", ["confirmed", "pending"])
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true })
    .limit(20);
  const bookings = (bookingsData ?? []) as IndividualBookingRow[];
  if (error || !bookings.length) return [];
  const coachIds = Array.from(new Set(bookings.map((b) => b.coach_id)));
  const typeIds = Array.from(new Set(bookings.map((b) => b.session_type_id)));
  const [{ data: coachesData }, { data: typesData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", coachIds),
    supabase.from("session_types").select("id, name, duration_minutes").in("id", typeIds),
  ]);
  const coaches = (coachesData ?? []) as { id: string; full_name: string | null }[];
  const types = (typesData ?? []) as { id: string; name: string; duration_minutes: number }[];
  const coachMap = new Map(coaches.map((c) => [c.id, c]));
  const typeMap = new Map(types.map((t) => [t.id, t]));
  return bookings.map((b) => ({
    ...b,
    coach: coachMap.get(b.coach_id) ?? null,
    session_type: typeMap.get(b.session_type_id) ?? null,
  }));
}

type CoachBookingRow = { id: string; booking_date: string; booking_time: string; status: string; player_id: string; session_type_id: string };

export async function getUpcomingBookingsForCoach(coachId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: bookingsData, error } = await supabase
    .from("individual_session_bookings")
    .select("id, booking_date, booking_time, status, player_id, session_type_id")
    .eq("coach_id", coachId)
    .gte("booking_date", today)
    .in("status", ["confirmed", "pending"])
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true })
    .limit(20);
  const bookings = (bookingsData ?? []) as CoachBookingRow[];
  if (error || !bookings.length) return [];
  const playerIds = Array.from(new Set(bookings.map((b) => b.player_id)));
  const typeIds = Array.from(new Set(bookings.map((b) => b.session_type_id)));
  const [{ data: playersData }, { data: typesData }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", playerIds),
    supabase.from("session_types").select("id, name, duration_minutes").in("id", typeIds),
  ]);
  const players = (playersData ?? []) as { id: string; full_name: string | null }[];
  const types = (typesData ?? []) as { id: string; name: string; duration_minutes: number }[];
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const typeMap = new Map(types.map((t) => [t.id, t]));
  return bookings.map((b) => ({
    ...b,
    player: playerMap.get(b.player_id) ?? null,
    session_type: typeMap.get(b.session_type_id) ?? null,
  }));
}
