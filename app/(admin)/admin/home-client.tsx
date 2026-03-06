"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { UserRoundPen, CalendarClock, CalendarDays, Trash2, Pencil, X, Camera, CheckCircle2, XCircle } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import styles from "./home.module.css";

interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
}

interface GroupSession {
  id: string;
  session_type: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  coach_id: string;
  assistant_coach_ids: string[];
  gk_coach_id: string | null;
  attendance_limit: number;
  location: string | null;
  zoom_link: string | null;
  description: string | null;
  session_plan: string | null;
  status: string;
  location_type: string;
}

interface IndividualBooking {
  id: string;
  individual_session_type_id: string;
  coach_id: string;
  player_id: string;
  parent_id: string | null;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  status: string;
  checked_in_at: string | null;
  cancelled_at: string | null;
  zoom_link: string | null;
  session_type: {
    id: string;
    name: string;
    color: string | null;
    location_type: string;
    duration_minutes: number;
  } | null;
}

interface Reservation {
  id: string;
  session_id: string;
  player_id: string;
  reservation_status: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  player: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    positions?: string[] | null;
  } | null;
}

interface PlayerInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  positions?: string[] | null;
}

interface SoloBooking {
  id: string;
  player_id: string;
  solo_session_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  completion_photo_url: string | null;
  status: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  solo_sessions: {
    id: string;
    title: string;
    skill: string;
    category: string;
  } | null;
}

interface Props {
  profileId: string;
  profileName: string;
  role: "admin" | "coach";
  todayStr: string;
  groupSessions: GroupSession[];
  individualBookings: IndividualBooking[];
  reservations: Reservation[];
  coaches: Record<string, Coach>;
  playerLookup: Record<string, PlayerInfo>;
  sessionTypeColors: Record<string, string>;
  soloBookings?: SoloBooking[];
}

type TabFilter = "all" | "my-day" | "past";

interface UnifiedPlayer {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  reservationId: string;
  status: string;
  checkedInAt: string | null;
  positions: string[];
}

interface UnifiedSession {
  id: string;
  type: "group" | "individual" | "solo";
  name: string;
  time: string;
  date?: string;
  endTime: string;
  duration: number;
  coachId: string;
  coachName: string;
  coachInitials: string;
  assistantCoachIds: string[];
  gkCoachId: string | null;
  locationType: string;
  location: string | null;
  zoomLink: string | null;
  attendanceLimit: number;
  color: string;
  players: UnifiedPlayer[];
  raw?: Record<string, unknown>;
  soloPhotoUrl?: string | null;
  soloStatus?: string;
  soloCategory?: string;
  soloSkill?: string;
}

function formatTime12(time24: string): string {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function addMinutesToTime(time24: string, minutes: number): string {
  const [h, m] = time24.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function getInitials(first?: string | null, last?: string | null): string {
  return `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase() || "?";
}

export default function HomeClient({
  profileId,
  profileName,
  role,
  todayStr,
  groupSessions,
  individualBookings,
  reservations,
  coaches,
  playerLookup,
  sessionTypeColors,
  soloBookings = [],
}: Props) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedSession, setSelectedSession] = useState<UnifiedSession | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(3);

  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [changeStaffOpen, setChangeStaffOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [availableCoaches, setAvailableCoaches] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [selectedNewCoachId, setSelectedNewCoachId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [saving, setSaving] = useState(false);

  const [pastSessions, setPastSessions] = useState<UnifiedSession[]>([]);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);

  const allSessions = useMemo<UnifiedSession[]>(() => {
    const unified: UnifiedSession[] = [];
    const safeGroupSessions = groupSessions ?? [];
    const safeIndividualBookings = individualBookings ?? [];
    const safeReservations = reservations ?? [];
    const safeSoloBookings = soloBookings ?? [];

    safeGroupSessions.forEach((session) => {
      const sessionReservations = safeReservations.filter((r) => r.session_id === session.id);
      const coach = coaches[session.coach_id];
      unified.push({
        id: session.id,
        type: "group",
        name: session.session_type,
        time: session.session_time,
        endTime: addMinutesToTime(session.session_time, session.duration_minutes),
        duration: session.duration_minutes,
        coachId: session.coach_id,
        coachName: coach ? `Coach ${coach.firstName}` : "Coach",
        coachInitials: coach ? getInitials(coach.firstName, coach.lastName) : "??",
        assistantCoachIds: session.assistant_coach_ids || [],
        gkCoachId: session.gk_coach_id,
        locationType: session.location_type,
        location: session.location,
        zoomLink: session.zoom_link,
        attendanceLimit: session.attendance_limit,
        color: sessionTypeColors[session.session_type] || "#3b82f6",
        players: sessionReservations.map((r) => ({
          id: r.player?.id || r.player_id,
          firstName: r.player?.first_name || "",
          lastName: r.player?.last_name || "",
          initials: getInitials(r.player?.first_name, r.player?.last_name),
          reservationId: r.id,
          status: r.reservation_status,
          checkedInAt: r.checked_in_at,
          positions: r.player?.positions || [],
        })),
        raw: session as unknown as Record<string, unknown>,
      });
    });

    safeIndividualBookings.forEach((booking) => {
      const coach = coaches[booking.coach_id];
      const player = playerLookup[booking.player_id];
      unified.push({
        id: booking.id,
        type: "individual",
        name: booking.session_type?.name || "Individual Session",
        time: booking.booking_time,
        endTime: addMinutesToTime(booking.booking_time, booking.duration_minutes),
        duration: booking.duration_minutes,
        coachId: booking.coach_id,
        coachName: coach ? `Coach ${coach.firstName}` : "Coach",
        coachInitials: coach ? getInitials(coach.firstName, coach.lastName) : "??",
        assistantCoachIds: [],
        gkCoachId: null,
        locationType: booking.session_type?.location_type || "virtual",
        location: null,
        zoomLink: booking.zoom_link,
        attendanceLimit: 1,
        color: booking.session_type?.color || "#4a90d9",
        players: player
          ? [{
              id: player.id,
              firstName: player.first_name || "",
              lastName: player.last_name || "",
              initials: getInitials(player.first_name, player.last_name),
              reservationId: booking.id,
              status: booking.checked_in_at ? "checked-in" : "reserved",
              checkedInAt: booking.checked_in_at,
              positions: player.positions || [],
            }]
          : [],
        raw: booking as unknown as Record<string, unknown>,
      });
    });

    safeSoloBookings.forEach((booking) => {
      const player = playerLookup[booking.player_id];
      const soloSession = booking.solo_sessions;
      const skillLabel = soloSession
        ? `${soloSession.category?.charAt(0).toUpperCase()}${soloSession.category?.slice(1)} · ${soloSession.skill}`
        : "Solo Session";

      unified.push({
        id: booking.id,
        type: "solo",
        name: soloSession?.title || "Solo Session",
        time: booking.scheduled_time || "00:00",
        endTime: addMinutesToTime(booking.scheduled_time || "00:00", 30),
        duration: 30,
        coachId: "",
        coachName: "",
        coachInitials: "",
        assistantCoachIds: [],
        gkCoachId: null,
        locationType: "field",
        location: null,
        zoomLink: null,
        attendanceLimit: 1,
        color: "#f59e0b",
        players: player
          ? [{
              id: player.id,
              firstName: player.first_name || "",
              lastName: player.last_name || "",
              initials: getInitials(player.first_name, player.last_name),
              reservationId: booking.id,
              status: booking.status,
              checkedInAt: booking.checked_in_at,
              positions: player.positions || [],
            }]
          : [],
        raw: booking as unknown as Record<string, unknown>,
        soloPhotoUrl: booking.completion_photo_url,
        soloStatus: booking.status,
        soloCategory: soloSession?.category || "",
        soloSkill: skillLabel,
      });
    });

    unified.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    return unified;
  }, [groupSessions, individualBookings, reservations, coaches, playerLookup, sessionTypeColors, soloBookings]);

  const filteredSessions = useMemo(() => {
    if (activeTab === "past") return pastSessions;
    if (activeTab === "my-day") {
      return allSessions.filter(
        (s) =>
          s.coachId === profileId ||
          (s.assistantCoachIds || []).includes(profileId) ||
          s.gkCoachId === profileId
      );
    }
    return allSessions;
  }, [allSessions, pastSessions, activeTab, profileId]);

  async function loadPastSessions() {
    if (pastLoaded) return;
    setLoadingPast(true);
    const supabase = createClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const startStr = thirtyDaysAgo.toISOString().split("T")[0];
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: pastGroup } = await supabase
      .from("sessions")
      .select("id, session_type, session_date, session_time, duration_minutes, coach_id, assistant_coach_ids, gk_coach_id, attendance_limit, location_type")
      .gte("session_date", startStr)
      .lte("session_date", yesterdayStr)
      .eq("status", "scheduled")
      .order("session_date", { ascending: false })
      .order("session_time", { ascending: true })
      .limit(20);

    const { data: pastIndividual } = await supabase
      .from("individual_session_bookings")
      .select(
        "id, individual_session_type_id, coach_id, player_id, booking_date, booking_time, duration_minutes, status, checked_in_at, session_type:individual_session_types(id, name, color, location_type)"
      )
      .gte("booking_date", startStr)
      .lte("booking_date", yesterdayStr)
      .in("status", ["confirmed", "completed"])
      .is("cancelled_at", null)
      .order("booking_date", { ascending: false })
      .limit(20);

    const past: UnifiedSession[] = [];
    (pastGroup || []).forEach((s: Record<string, unknown>) => {
      const coach = coaches[s.coach_id as string];
      past.push({
        id: s.id as string,
        type: "group",
        name: s.session_type as string,
        time: s.session_time as string,
        date: s.session_date as string,
        endTime: addMinutesToTime(s.session_time as string, s.duration_minutes as number),
        duration: s.duration_minutes as number,
        coachId: s.coach_id as string,
        coachName: coach ? `Coach ${coach.firstName}` : "Coach",
        coachInitials: coach ? getInitials(coach.firstName, coach.lastName) : "??",
        assistantCoachIds: (s.assistant_coach_ids as string[]) || [],
        gkCoachId: (s.gk_coach_id as string) || null,
        locationType: s.location_type as string,
        location: null,
        zoomLink: null,
        attendanceLimit: s.attendance_limit as number,
        color: sessionTypeColors[s.session_type as string] || "#3b82f6",
        players: [],
      });
    });
    (pastIndividual || []).forEach((b: Record<string, unknown>) => {
      const coach = coaches[b.coach_id as string];
      const player = playerLookup[b.player_id as string];
      const st = b.session_type as { id: string; name: string; color: string | null; location_type: string } | null;
      past.push({
        id: b.id as string,
        type: "individual",
        name: st?.name || "Individual",
        time: b.booking_time as string,
        date: b.booking_date as string,
        endTime: addMinutesToTime(b.booking_time as string, b.duration_minutes as number),
        duration: b.duration_minutes as number,
        coachId: b.coach_id as string,
        coachName: coach ? `Coach ${coach.firstName}` : "Coach",
        coachInitials: coach ? getInitials(coach.firstName, coach.lastName) : "??",
        assistantCoachIds: [],
        gkCoachId: null,
        locationType: st?.location_type || "virtual",
        location: null,
        zoomLink: null,
        attendanceLimit: 1,
        color: st?.color || "#4a90d9",
        players: player
          ? [{
              id: player.id,
              firstName: player.first_name || "",
              lastName: player.last_name || "",
              initials: getInitials(player.first_name, player.last_name),
              reservationId: b.id as string,
              status: b.checked_in_at ? "checked-in" : "confirmed",
              checkedInAt: (b.checked_in_at as string) || null,
              positions: player.positions || [],
            }]
          : [],
      });
    });
    past.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (a.time || "").localeCompare(b.time || ""));
    setPastSessions(past);
    setPastLoaded(true);
    setLoadingPast(false);
  }

  const POINTS_MAP: Record<string, number> = {
    "Tec Tac": 6,
    "Speed Training": 5,
    "Strength & Conditioning": 5,
    "Champions Player Progress (CPP)": 10,
    "Group Film-Analysis": 4,
    "Free Nutrition Consultation": 7,
    "Psychologist": 8,
    "Pro Player Stories (PPS)": 4,
    "College Advising": 8,
  };

  async function insertPointsForCheckIn(
    supabase: ReturnType<typeof createClient>,
    playerId: string,
    session: UnifiedSession,
    reservationId: string,
    checkedAt: string,
  ) {
    const sessionType = session.name;
    const points = POINTS_MAP[sessionType] || 0;
    if (points <= 0) return;

    const now = new Date();
    const quarterNumber = Math.ceil((now.getMonth() + 1) / 3);
    const quarterYear = now.getFullYear();

    await (supabase as any).from("points_transactions").insert({
      player_id: playerId,
      points,
      session_type: sessionType,
      session_id: session.id,
      reservation_id: reservationId,
      checked_in_by: profileId,
      checked_in_at: checkedAt,
      quarter_year: quarterYear,
      quarter_number: quarterNumber,
      status: "active",
    });
  }

  async function handleCheckIn(session: UnifiedSession, player: UnifiedPlayer) {
    setCheckingIn(player.reservationId);
    const supabase = createClient();
    const checkedAt = new Date().toISOString();
    try {
      if (session.type === "group") {
        const { error } = await supabase
          .from("session_reservations")
          .update({ reservation_status: "checked-in", checked_in_at: checkedAt, checked_in_by: profileId })
          .eq("id", player.reservationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("individual_session_bookings")
          .update({ checked_in_at: checkedAt })
          .eq("id", player.reservationId);
        if (error) throw error;
      }

      try {
        await insertPointsForCheckIn(supabase, player.id, session, player.reservationId, checkedAt);
      } catch (err) {
        console.error("Failed to award points:", err);
      }

      showToast(`${player.firstName} checked in!`, "success");
      player.status = "checked-in";
      player.checkedInAt = checkedAt;
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Check-in failed", "error");
    } finally {
      setCheckingIn(null);
    }
  }

  async function handleRemoveCheckIn(session: UnifiedSession, player: UnifiedPlayer) {
    setCheckingIn(player.reservationId);
    const supabase = createClient();
    try {
      if (session.type === "group") {
        const { error } = await supabase
          .from("session_reservations")
          .update({ reservation_status: "reserved", checked_in_at: null, checked_in_by: null })
          .eq("id", player.reservationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("individual_session_bookings")
          .update({ checked_in_at: null })
          .eq("id", player.reservationId);
        if (error) throw error;
      }

      try {
        await (supabase as any)
          .from("points_transactions")
          .delete()
          .eq("reservation_id", player.reservationId)
          .eq("player_id", player.id)
          .eq("status", "active");
      } catch (err) {
        console.error("Failed to remove points:", err);
      }

      showToast(`Check-in removed for ${player.firstName}`, "info");
      player.status = "reserved";
      player.checkedInAt = null;
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to remove check-in", "error");
    } finally {
      setCheckingIn(null);
    }
  }

  async function handleCheckInAll(session: UnifiedSession) {
    const reserved = session.players.filter((p) => p.status === "reserved");
    if (reserved.length === 0) { showToast("No players to check in", "info"); return; }
    setCheckingIn("all");
    const supabase = createClient();
    let success = 0;
    for (const player of reserved) {
      try {
        const checkedAt = new Date().toISOString();
        if (session.type === "group") {
          await supabase.from("session_reservations").update({
            reservation_status: "checked-in",
            checked_in_at: checkedAt,
            checked_in_by: profileId,
          }).eq("id", player.reservationId);
        } else {
          await supabase.from("individual_session_bookings")
            .update({ checked_in_at: checkedAt })
            .eq("id", player.reservationId);
        }

        try {
          await insertPointsForCheckIn(supabase, player.id, session, player.reservationId, checkedAt);
        } catch (err) {
          console.error("Failed to award points:", err);
        }

        player.status = "checked-in";
        player.checkedInAt = checkedAt;
        success++;
      } catch { /* skip failures */ }
    }
    showToast(`Checked in ${success} player${success !== 1 ? "s" : ""}`, "success");
    setCheckingIn(null);
    setRefreshKey((k) => k + 1);
  }

  async function openChangeStaff() {
    setEditMenuOpen(false);
    if (!selectedSession) return;
    setSaving(true);
    const supabase = createClient();
    const sessionTypeId = (selectedSession.raw as Record<string, unknown>)?.individual_session_type_id as string | undefined;
    if (sessionTypeId) {
      const { data } = await supabase
        .from("coach_individual_availability")
        .select("coach_id")
        .eq("individual_session_type_id", sessionTypeId)
        .eq("is_active", true);
      const coachIds = (data || []).map((d: { coach_id: string }) => d.coach_id);
      const available = coachIds
        .map((id: string) => coaches[id])
        .filter(Boolean)
        .map((c: Coach) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName }));
      setAvailableCoaches(available);
    }
    setSelectedNewCoachId(selectedSession.coachId);
    setSaving(false);
    setChangeStaffOpen(true);
  }

  async function saveChangeStaff() {
    if (!selectedSession || !selectedNewCoachId) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("individual_session_bookings")
      .update({ coach_id: selectedNewCoachId })
      .eq("id", selectedSession.id);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Coach updated", "success");
      selectedSession.coachId = selectedNewCoachId;
      const c = coaches[selectedNewCoachId];
      if (c) {
        selectedSession.coachName = `Coach ${c.firstName}`;
        selectedSession.coachInitials = getInitials(c.firstName, c.lastName);
      }
    }
    setSaving(false);
    setChangeStaffOpen(false);
    setRefreshKey((k) => k + 1);
  }

  function openReschedule() {
    setEditMenuOpen(false);
    if (!selectedSession) return;
    const raw = selectedSession.raw as Record<string, unknown> | undefined;
    setRescheduleDate((raw?.booking_date as string) || todayStr);
    setRescheduleTime(((raw?.booking_time as string) || "").slice(0, 5));
    setRescheduleOpen(true);
  }

  async function saveReschedule() {
    if (!selectedSession || !rescheduleDate || !rescheduleTime) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("individual_session_bookings")
      .update({ booking_date: rescheduleDate, booking_time: rescheduleTime })
      .eq("id", selectedSession.id);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Session rescheduled", "success");
      setSelectedSession(null);
    }
    setSaving(false);
    setRescheduleOpen(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleCancelIndividual() {
    setEditMenuOpen(false);
    if (!selectedSession) return;
    if (!window.confirm("Cancel this session? This cannot be undone.")) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("individual_session_bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", selectedSession.id);
    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Session cancelled", "success");
      setSelectedSession(null);
    }
    setSaving(false);
    setRefreshKey((k) => k + 1);
  }

  const pendingReviewCount = useMemo(
    () => (soloBookings ?? []).filter((b) => b.status === "pending_review").length,
    [soloBookings]
  );

  async function deleteSoloPhoto(photoUrl: string | null | undefined, bookingId: string) {
    if (!photoUrl) return;
    try {
      const url = new URL(photoUrl);
      const pathParts = url.pathname.split("/solo-session-photos/");
      if (pathParts.length > 1) {
        const storagePath = pathParts[1];
        const supabase = createClient();
        const { error } = await supabase.storage.from("solo-session-photos").remove([storagePath]);
        if (error) console.warn("Photo cleanup failed:", error.message);
        else console.log("Solo photo deleted from storage:", storagePath);
      }
    } catch (e) {
      console.warn("Photo cleanup error:", e);
    }
    if (bookingId) {
      const supabase = createClient();
      await (supabase as any).from("player_solo_session_bookings").update({ completion_photo_url: null }).eq("id", bookingId);
    }
  }

  async function handleSoloCheckIn(session: UnifiedSession) {
    if (!session.players[0]) return;
    const player = session.players[0];
    setCheckingIn(player.reservationId);
    const supabase = createClient();
    try {
      const { error } = await (supabase as any)
        .from("player_solo_session_bookings")
        .update({ status: "checked-in", checked_in_at: new Date().toISOString(), checked_in_by: profileId })
        .eq("id", session.id);
      if (error) throw error;

      try {
        await (supabase as any).from("points_transactions").insert({
          player_id: player.id,
          points: 8,
          session_type: "Solo Session",
          session_id: (session.raw as Record<string, unknown>)?.solo_session_id as string || null,
          quarter_year: new Date().getFullYear(),
          quarter_number: Math.ceil((new Date().getMonth() + 1) / 3),
          status: "active",
          checked_in_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to award solo points:", err);
      }

      deleteSoloPhoto(session.soloPhotoUrl, session.id);

      showToast(`${player.firstName} solo session checked in! +8 points`, "success");
      session.soloStatus = "checked-in";
      player.status = "checked-in";
      player.checkedInAt = new Date().toISOString();
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Check-in failed", "error");
    } finally {
      setCheckingIn(null);
    }
  }

  async function handleSoloDeny(session: UnifiedSession) {
    if (!session.players[0]) return;
    const player = session.players[0];
    setCheckingIn(player.reservationId);
    const supabase = createClient();
    try {
      const { error } = await (supabase as any)
        .from("player_solo_session_bookings")
        .update({ status: "denied" })
        .eq("id", session.id);
      if (error) throw error;

      deleteSoloPhoto(session.soloPhotoUrl, session.id);

      showToast(`Photo denied for ${player.firstName}. They can re-upload.`, "info");
      session.soloStatus = "denied";
      player.status = "denied";
      session.soloPhotoUrl = null;
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Deny failed", "error");
    } finally {
      setCheckingIn(null);
    }
  }

  const visibleSessions = filteredSessions.slice(0, visibleCount);
  const hasMore = filteredSessions.length > visibleCount;

  const today = new Date();
  const dateDisplay = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className={styles.page} key={refreshKey}>
      <div className={styles.welcomeSection}>
        <div>
          <h1 className={styles.welcomeTitle}>
            Welcome, <span className={styles.nameAccent}>{profileName.split(" ")[0]}</span>
          </h1>
          <p className={styles.dateLabel}>{dateDisplay}</p>
        </div>
        <div className={styles.desktopOnly}>
          <NotificationBell userId={profileId} role={role} />
        </div>
      </div>

      <div className={styles.checkinSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Player Check-in</h2>
          <div className={styles.tabRow}>
            {(["all", "my-day", "past"] as TabFilter[]).map((tab) => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
                onClick={() => {
                  setVisibleCount(3);
                  setActiveTab(tab);
                  if (tab === "past" && !pastLoaded) loadPastSessions();
                }}
              >
                {tab === "all" ? "Full Schedule" : tab === "my-day" ? "My Day" : "Past"}
              </button>
            ))}
          </div>
        </div>
        <p className={styles.sectionHint}>
          {role === "admin"
            ? "Check in players after sessions for their points."
            : "Check in your players after sessions."}
        </p>
        {pendingReviewCount > 0 && (
          <div className={styles.pendingBanner}>
            <Camera size={14} />
            <span>{pendingReviewCount} solo photo{pendingReviewCount !== 1 ? "s" : ""} pending review</span>
          </div>
        )}

        {activeTab === "past" && loadingPast ? (
          <div className={styles.emptyState}><p>Loading past sessions...</p></div>
        ) : filteredSessions.length === 0 ? (
          <div className={styles.emptyState}>
            <CalendarDays size={32} className={styles.emptyIcon} />
            <p>{activeTab === "past" ? "No past sessions found" : "No sessions scheduled for today"}</p>
          </div>
        ) : (
          <div className={styles.sessionsList}>
            {visibleSessions.map((session, i) => {
              const reservedCount = session.players.filter((p) => p.status === "reserved").length;
              const checkedInCount = session.players.filter((p) => p.status === "checked-in").length;
              const isIndividual = session.type === "individual";
              const isSolo = session.type === "solo";

              return (
                <div key={session.id}>
                  {activeTab === "past" && (i === 0 || session.date !== filteredSessions[i - 1]?.date) && (
                    <div className={styles.dateGroup}>
                      {new Date((session.date || "") + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "long", month: "short", day: "numeric",
                      })}
                    </div>
                  )}
                  <div
                    className={styles.sessionItem}
                    style={{ borderLeftColor: session.color }}
                    onClick={() => setSelectedSession(session)}
                  >
                    <div className={styles.sessionItemHeader}>
                      <div className={styles.sessionItemLeft}>
                        <span className={styles.sessionItemName}>
                          {session.name}
                          {isIndividual && <span className={styles.sessionTypeBadge}> 1-on-1</span>}
                          {isSolo && <span className={styles.soloTypeBadge}> Solo</span>}
                        </span>
                        <span className={styles.sessionItemTime}>
                          {isSolo && session.soloSkill ? `${session.soloSkill} · ` : ""}
                          {formatTime12(session.time)}{!isSolo && ` – ${formatTime12(session.endTime)}`}
                        </span>
                        {isIndividual && session.players[0] && (
                          <span className={styles.sessionItemPlayer}>
                            {session.players[0].firstName} {session.players[0].lastName}
                          </span>
                        )}
                        {isSolo && session.players[0] && (
                          <span className={styles.sessionItemPlayer}>
                            {session.players[0].firstName} {session.players[0].lastName}
                          </span>
                        )}
                        {isSolo && session.soloStatus === "pending_review" && (
                          <span className={styles.soloPhotoBadge}>📷 Photo Ready for Review</span>
                        )}
                        {isSolo && session.soloStatus === "checked-in" && (
                          <span className={styles.soloCheckedInBadge}>✓ Checked In</span>
                        )}
                        {isSolo && session.soloStatus === "denied" && (
                          <span className={styles.soloDeniedBadge}>✗ Denied</span>
                        )}
                        {!isIndividual && !isSolo && (
                          <span className={styles.sessionItemAttendees}>
                            {checkedInCount + reservedCount} / {session.attendanceLimit || "∞"} attendees
                            {checkedInCount > 0 && ` · ${checkedInCount} checked in`}
                          </span>
                        )}
                      </div>
                      <div className={styles.sessionItemRight}>
                        {!isSolo && (
                          <div className={styles.sessionCoachBubble} title={session.coachName}>
                            {session.coachInitials}
                          </div>
                        )}
                        {(isIndividual || isSolo) && session.players[0] && (
                          <div className={styles.sessionPlayerBubble} title={`${session.players[0].firstName} ${session.players[0].lastName}`}>
                            {session.players[0].initials}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasMore && (
          <button
            className={styles.loadMoreBtn}
            onClick={() => setVisibleCount((c) => c + 5)}
          >
            Load more ({filteredSessions.length - visibleCount} remaining)
          </button>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className={styles.modalOverlay} onClick={() => { setSelectedSession(null); setEditMenuOpen(false); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>{selectedSession.name}</h2>
                <span className={styles.modalBadge}>
                  {selectedSession.type === "solo"
                    ? "SOLO SESSION"
                    : selectedSession.type === "individual"
                    ? "1-ON-1 SESSION"
                    : "GROUP SESSION"}
                </span>
              </div>
              <div className={styles.modalHeaderActions}>
                {selectedSession.type === "individual" && (
                  <button className={styles.modalEditBtn} onClick={() => setEditMenuOpen(!editMenuOpen)}><Pencil size={16} /></button>
                )}
                <button className={styles.modalCloseBtn} onClick={() => { setSelectedSession(null); setEditMenuOpen(false); }}><X size={18} /></button>
              </div>
            </div>

            <div className={styles.modalMeta}>
              {selectedSession.type === "solo" && selectedSession.soloSkill && (
                <div className={styles.modalMetaRow}>
                  <span className={styles.modalMetaLabel}>Skill</span>
                  <span className={styles.modalMetaValue}>{selectedSession.soloSkill}</span>
                </div>
              )}
              <div className={styles.modalMetaRow}>
                <span className={styles.modalMetaLabel}>Time</span>
                <span className={styles.modalMetaValue}>
                  {formatTime12(selectedSession.time)}{selectedSession.type !== "solo" && ` – ${formatTime12(selectedSession.endTime)}`}
                </span>
              </div>
              {selectedSession.type !== "solo" && (
                <div className={styles.modalMetaRow}>
                  <span className={styles.modalMetaLabel}>Location</span>
                  <span className={styles.modalMetaValue}>
                    {selectedSession.locationType === "virtual" ? "Virtual" : selectedSession.location || "On-Field"}
                  </span>
                </div>
              )}
              {selectedSession.type === "solo" && (
                <div className={styles.modalMetaRow}>
                  <span className={styles.modalMetaLabel}>Status</span>
                  <span className={styles.modalMetaValue}>
                    <span className={styles.soloStatusBadge} data-status={selectedSession.soloStatus}>
                      {selectedSession.soloStatus === "scheduled" && "Scheduled"}
                      {selectedSession.soloStatus === "pending_review" && "📷 Photo Pending Review"}
                      {selectedSession.soloStatus === "checked-in" && "✓ Checked In"}
                      {selectedSession.soloStatus === "denied" && "✗ Denied"}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {selectedSession.type !== "solo" && (
              <div className={styles.modalStaff}>
                <div className={styles.staffMember}>
                  <div className={styles.staffAvatar}>{selectedSession.coachInitials}</div>
                  <div className={styles.staffInfo}>
                    <span className={styles.staffName}>{selectedSession.coachName}</span>
                    <span className={styles.staffRole}>Head Coach</span>
                  </div>
                </div>
                {selectedSession.assistantCoachIds?.map((id) => {
                  const c = coaches[id];
                  if (!c) return null;
                  return (
                    <div key={id} className={styles.staffMember}>
                      <div className={styles.staffAvatarAssistant}>{getInitials(c.firstName, c.lastName)}</div>
                      <div className={styles.staffInfo}>
                        <span className={styles.staffName}>Coach {c.firstName}</span>
                        <span className={styles.staffRole}>Assistant</span>
                      </div>
                    </div>
                  );
                })}
                {selectedSession.gkCoachId && coaches[selectedSession.gkCoachId] && (
                  <div className={styles.staffMember}>
                    <div className={styles.staffAvatarGk}>
                      {getInitials(coaches[selectedSession.gkCoachId].firstName, coaches[selectedSession.gkCoachId].lastName)}
                    </div>
                    <div className={styles.staffInfo}>
                      <span className={styles.staffName}>Coach {coaches[selectedSession.gkCoachId].firstName}</span>
                      <span className={styles.staffRole}>GK Coach</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedSession.type === "solo" && (
              <div className={styles.soloSection}>
                {selectedSession.players[0] && (
                  <div className={styles.soloPlayer}>
                    <div className={styles.playerAvatar}>{selectedSession.players[0].initials}</div>
                    <div className={styles.playerInfo}>
                      <span className={styles.playerName}>
                        {selectedSession.players[0].firstName} {selectedSession.players[0].lastName}
                      </span>
                    </div>
                  </div>
                )}

                {selectedSession.soloPhotoUrl && (
                  <div className={styles.soloPhotoWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedSession.soloPhotoUrl} alt="Completion photo" className={styles.soloPhoto} />
                  </div>
                )}

                {selectedSession.soloStatus === "pending_review" && (
                  <div className={styles.soloActions}>
                    <button
                      className={styles.soloCheckInBtn}
                      onClick={() => handleSoloCheckIn(selectedSession)}
                      disabled={checkingIn !== null}
                    >
                      <CheckCircle2 size={16} />
                      {checkingIn ? "Processing..." : "Check In (+8 pts)"}
                    </button>
                    <button
                      className={styles.soloDenyBtn}
                      onClick={() => handleSoloDeny(selectedSession)}
                      disabled={checkingIn !== null}
                    >
                      <XCircle size={16} />
                      Deny Photo
                    </button>
                  </div>
                )}

                {selectedSession.soloStatus === "scheduled" && (
                  <p className={styles.soloWaiting}>Waiting for player to upload completion photo.</p>
                )}

                {selectedSession.soloStatus === "checked-in" && (
                  <p className={styles.soloCheckedIn}>
                    <CheckCircle2 size={16} /> Player checked in and points awarded.
                  </p>
                )}

                {selectedSession.soloStatus === "denied" && (
                  <p className={styles.soloDeniedMsg}>Photo denied. Waiting for player to re-upload.</p>
                )}
              </div>
            )}

            {selectedSession.type !== "solo" && (
              <div className={styles.modalPlayers}>
                <div className={styles.modalPlayersHeader}>
                  <h4 className={styles.playersSectionTitle}>Players ({selectedSession.players.length})</h4>
                  {selectedSession.type === "group" && selectedSession.players.some((p) => p.status === "reserved") && (
                    <button
                      className={styles.checkInAllBtn}
                      onClick={() => handleCheckInAll(selectedSession)}
                      disabled={checkingIn === "all"}
                    >
                      {checkingIn === "all" ? "Checking in..." : "Check in All"}
                    </button>
                  )}
                </div>
                <div className={styles.modalPlayersList}>
                  {selectedSession.players.length === 0 ? (
                    <p className={styles.noPlayers}>No players reserved</p>
                  ) : (
                    selectedSession.players.map((player) => {
                      const isCheckedIn = player.status === "checked-in";
                      const isLoading = checkingIn === player.reservationId;
                      return (
                        <div key={player.reservationId} className={styles.playerRow}>
                          <div className={styles.playerAvatar}>{player.initials}</div>
                          <div className={styles.playerInfo}>
                            <span className={styles.playerName}>{player.firstName} {player.lastName}</span>
                            {player.positions.length > 0 && (
                              <span className={styles.playerPositions}>{player.positions.join(", ")}</span>
                            )}
                          </div>
                          <button
                            className={`${styles.checkInBtn} ${isCheckedIn ? styles.checkInBtnDone : ""}`}
                            onClick={() => isCheckedIn ? handleRemoveCheckIn(selectedSession, player) : handleCheckIn(selectedSession, player)}
                            disabled={isLoading}
                          >
                            {isLoading ? "..." : isCheckedIn ? "Undo" : "Check-in"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {editMenuOpen && selectedSession.type === "individual" && (
            <div className={styles.editMenu} onClick={(e) => e.stopPropagation()}>
              <button className={styles.editMenuItem} onClick={openChangeStaff}>
                <UserRoundPen size={18} /> Change Staff
              </button>
              <button className={styles.editMenuItem} onClick={openReschedule}>
                <CalendarClock size={18} /> Reschedule
              </button>
              <button className={`${styles.editMenuItem} ${styles.editMenuItemDanger}`} onClick={handleCancelIndividual}>
                <Trash2 size={18} /> Cancel Session
              </button>
            </div>
          )}
        </div>
      )}

      {changeStaffOpen && (
        <div className={styles.modalOverlay} onClick={() => setChangeStaffOpen(false)}>
          <div className={styles.subModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.subModalHeader}>
              <h3>Change Staff</h3>
              <button className={styles.modalCloseBtn} onClick={() => setChangeStaffOpen(false)}><X size={18} /></button>
            </div>
            <div className={styles.subModalBody}>
              {availableCoaches.map((c) => (
                <label key={c.id} className={styles.staffRadioRow}>
                  <input type="radio" name="newCoach" checked={selectedNewCoachId === c.id} onChange={() => setSelectedNewCoachId(c.id)} />
                  <div className={styles.staffAvatar}>{getInitials(c.firstName, c.lastName)}</div>
                  <span className={styles.staffName}>Coach {c.firstName} {c.lastName}</span>
                </label>
              ))}
              {availableCoaches.length === 0 && <p className={styles.noPlayers}>No coaches available for this session type</p>}
            </div>
            <div className={styles.subModalFooter}>
              <button className={styles.saveBtn} onClick={saveChangeStaff} disabled={saving || !selectedNewCoachId}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleOpen && (
        <div className={styles.modalOverlay} onClick={() => setRescheduleOpen(false)}>
          <div className={styles.subModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.subModalHeader}>
              <h3>Reschedule</h3>
              <button className={styles.modalCloseBtn} onClick={() => setRescheduleOpen(false)}><X size={18} /></button>
            </div>
            <div className={styles.subModalBody}>
              <label className={styles.formLabel}>When</label>
              <div className={styles.rescheduleInputs}>
                <input type="date" className={styles.formInput} value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                <input type="time" className={styles.formInput} value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
              </div>
            </div>
            <div className={styles.subModalFooter}>
              <button className={styles.saveBtn} onClick={saveReschedule} disabled={saving || !rescheduleDate || !rescheduleTime}>
                {saving ? "Saving..." : "Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
