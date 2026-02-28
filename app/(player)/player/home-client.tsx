"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, MapPin, Video, User, Target, HelpCircle,
  X, Bell, BellOff, Ban, AlarmClock, CalendarCheck, Info, Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cancelReservation } from "@/app/actions/schedule";
import { useToast } from "@/components/ui/Toast";
import styles from "./home.module.css";

/* ─── Types ─── */

interface GroupReservation {
  id: string;
  session_id: string;
  reservation_status: string;
  checked_in_at: string | null;
  session: {
    id: string;
    session_type: string;
    session_date: string;
    session_time: string;
    duration_minutes: number;
    location_type: string;
    location: string | null;
    zoom_link: string | null;
    coach_id: string | null;
    attendance_limit: number;
    status: string;
    description: string | null;
  } | null;
}

interface IndividualBooking {
  id: string;
  individual_session_type_id: string;
  coach_id: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number;
  status: string;
  checked_in_at: string | null;
  zoom_link: string | null;
  session_type: {
    id: string;
    name: string;
    color: string;
    location_type: string;
  } | null;
}

interface Objectives {
  id: string;
  in_possession_objective: string | null;
  out_of_possession_objective: string | null;
  created_at: string;
  coach_id: string | null;
}

interface Notification {
  id: string;
  title: string | null;
  message: string | null;
  notification_type: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
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
  solo_session: {
    id: string;
    title: string;
    category: string;
    skill: string;
    sub_skill: string | null;
    period: string | null;
    main_exercises: unknown[] | null;
  } | null;
}

interface UnifiedSession {
  id: string;
  type: "group" | "individual" | "solo";
  name: string;
  date: string;
  time: string;
  durationMinutes: number;
  locationType: string;
  location: string | null;
  zoomLink: string | null;
  coachId: string | null;
  coachName: string;
  color: string;
  sessionId: string | null;
  reservationId: string;
  isPast: boolean;
  soloStatus?: string;
  soloPhotoUrl?: string | null;
  soloCategory?: string;
  soloSkill?: string;
}

interface LeaderboardPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
  initials: string;
  points: string;
  position: number;
  photoUrl: string | null;
}

interface Props {
  playerId: string;
  playerName: string;
  todayStr: string;
  groupReservations: GroupReservation[];
  individualBookings: IndividualBooking[];
  coaches: Record<string, { id: string; firstName: string; lastName: string }>;
  sessionTypeColors: Record<string, string>;
  objectives: Objectives | null;
  unreadNotificationCount: number;
  notifications: Notification[];
  leaderboard: LeaderboardPlayer[];
  soloBookings: SoloBooking[];
}

/* ─── Helpers ─── */

function formatTime12(time: string): string {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "PM" : "AM";
  const h12 = (h ?? 0) % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
        ? "nd"
        : day === 3 || day === 23
          ? "rd"
          : "th";
  return `${month} ${day}${suffix}`;
}

function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCurrentFocus(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (month === 12) {
    if (day <= 7) return "BUILD-OUT";
    if (day <= 14) return "FINAL THIRD";
    if (day <= 21) return "MIDDLE THIRD";
    return "WIDE PLAY";
  }

  const schedule: [number, number, number, number, string][] = [
    [1, 1, 2, 14, "BUILD-OUT"],
    [2, 15, 3, 31, "FINAL THIRD"],
    [4, 1, 5, 15, "MIDDLE THIRD"],
    [5, 16, 6, 30, "WIDE PLAY"],
    [7, 1, 8, 15, "11V11 FORMATIONS"],
    [8, 16, 9, 30, "SET PIECES"],
    [10, 1, 10, 15, "BUILD-OUT"],
    [10, 16, 10, 31, "FINAL THIRD"],
    [11, 1, 11, 15, "MIDDLE THIRD"],
    [11, 16, 11, 30, "WIDE PLAY"],
  ];

  for (const [sm, sd, em, ed, focus] of schedule) {
    const start = new Date(now.getFullYear(), sm - 1, sd);
    const end = new Date(now.getFullYear(), em - 1, ed);
    if (now >= start && now <= end) return focus;
  }
  return "BUILD-OUT";
}

function getNotifIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    cancellation: <Ban size={20} />,
    time_change: <AlarmClock size={20} />,
    popup_session: <CalendarCheck size={20} />,
    information: <Info size={20} />,
    veo_link: <Video size={20} />,
    merch: <Tag size={20} />,
    announcement: <Info size={20} />,
  };
  return icons[type] || <Bell size={20} />;
}

function getNotifTitle(type: string, fallback?: string | null) {
  const titles: Record<string, string> = {
    information: "Information",
    time_change: "Time Change",
    cancellation: "Cancellation",
    popup_session: "Additional Session",
    veo_link: "Veo Link",
    merch: "Merch",
    announcement: "Information",
  };
  return titles[type] || fallback || "Notification";
}

/* ─── Component ─── */

export default function PlayerHomeClient({
  playerId,
  todayStr,
  groupReservations,
  individualBookings,
  coaches,
  sessionTypeColors,
  objectives,
  unreadNotificationCount,
  notifications: initialNotifications,
  leaderboard,
  soloBookings,
}: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"schedule" | "reservations">("schedule");
  const [bottomTab, setBottomTab] = useState<"objectives" | "quiz">("objectives");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifList, setNotifList] = useState<Notification[]>(initialNotifications);
  const [cancelTarget, setCancelTarget] = useState<UnifiedSession | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOfWeek(today));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(today));

  const selectedDateStr = formatDateString(selectedDate);
  const currentFocus = getCurrentFocus();
  const unreadCount = notifList.filter((n) => !n.is_read).length;

  /* ─── Restyle layout topbar as Homegrown header ─── */

  useEffect(() => {
    const topbar = document.querySelector('[class*="layout_topbar__"]') as HTMLElement;
    if (!topbar) return;

    const originalClassName = topbar.className;
    const originalStyle = topbar.style.cssText;

    const existingForm = topbar.querySelector("form");
    const formParent = existingForm?.parentElement ?? null;
    const formNextSibling = existingForm?.nextSibling ?? null;
    if (existingForm) existingForm.remove();

    const label = topbar.querySelector('[class*="accountSwitcherLabel"]') as HTMLElement | null;
    const labelOriginalDisplay = label?.style.display ?? "";
    if (label) label.style.display = "none";

    const savedChildren: ChildNode[] = [];
    while (topbar.firstChild) {
      savedChildren.push(topbar.removeChild(topbar.firstChild));
    }

    topbar.style.display = "flex";
    topbar.style.justifyContent = "space-between";
    topbar.style.alignItems = "center";
    topbar.style.padding = "12px 16px";
    topbar.style.background = "var(--background)";
    topbar.style.borderBottom = "1px solid var(--border)";
    topbar.style.position = "relative";

    const leftSpacer = document.createElement("div");
    leftSpacer.style.width = "40px";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.id = "homegrownToggle";
    toggleBtn.style.cssText = `
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; cursor: pointer;
      font-size: 1.2rem; font-weight: 600; color: var(--foreground);
      font-family: inherit;
    `;
    toggleBtn.innerHTML = `
      Homegrown
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s;">
        <path d="m6 9 6 6 6-6"></path>
      </svg>
    `;

    const rightGroup = document.createElement("div");
    rightGroup.style.cssText = "display: flex; align-items: center; gap: 8px;";

    const bellBtn = document.createElement("button");
    bellBtn.type = "button";
    bellBtn.id = "homeBellBtn";
    bellBtn.style.cssText = `
      position: relative; width: 40px; height: 40px; border-radius: 50%;
      background: transparent; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--foreground); transition: background 0.15s;
    `;
    bellBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.268 21a2 2 0 0 0 3.464 0"></path>
        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>
      </svg>
    `;
    rightGroup.appendChild(bellBtn);

    topbar.appendChild(leftSpacer);
    topbar.appendChild(toggleBtn);
    topbar.appendChild(rightGroup);

    // Bell badge (managed via DOM so it updates with notif count)
    const updateBadge = () => {
      const existing = bellBtn.querySelector("span");
      if (existing) existing.remove();
      const count = unreadCount;
      if (count > 0) {
        const badge = document.createElement("span");
        badge.style.cssText = `
          position: absolute; top: 2px; right: 2px;
          min-width: 18px; height: 18px; padding: 0 5px;
          border-radius: 50%; background: #ef4444; color: white;
          font-size: 11px; font-weight: 600;
          display: flex; align-items: center; justify-content: center;
          line-height: 1;
        `;
        badge.textContent = count > 99 ? "99+" : String(count);
        bellBtn.appendChild(badge);
      }
    };
    updateBadge();

    // Bell opens notification sheet
    const handleBellClick = () => {
      setNotifOpen((prev) => !prev);
    };
    bellBtn.addEventListener("click", handleBellClick);

    // Dropdown for account switcher
    const dropdown = document.createElement("div");
    dropdown.id = "homegrownSwitcherDropdown";
    dropdown.style.cssText = `
      display: none; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
      min-width: 240px; padding: 12px;
      background: rgba(255,255,255,0.85); backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      z-index: 1000;
    `;

    if (existingForm) {
      dropdown.appendChild(existingForm);
      existingForm.style.cssText = "display: flex; flex-direction: column; gap: 8px;";
      const formLabels = existingForm.querySelectorAll("label, span");
      formLabels.forEach((el) => {
        if ((el as HTMLElement).textContent?.includes("Acting as")) {
          (el as HTMLElement).style.display = "none";
        }
      });
      const select = existingForm.querySelector("select") as HTMLElement | null;
      if (select) {
        select.style.cssText = `
          width: 100%; padding: 10px 12px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--background);
          color: var(--foreground); font-size: 0.85rem; font-family: inherit;
        `;
      }
      const submitBtn = existingForm.querySelector('button[type="submit"]') as HTMLElement | null;
      if (submitBtn) {
        submitBtn.style.cssText = `
          padding: 8px 16px; border-radius: 8px; border: none;
          background: var(--accent); color: white;
          font-size: 0.82rem; font-weight: 600; cursor: pointer;
          font-family: inherit;
        `;
      }
    }

    topbar.appendChild(dropdown);

    topbar.style.opacity = "1";
    topbar.style.pointerEvents = "";

    const chevron = toggleBtn.querySelector("svg");
    let isOpen = false;

    const handleToggle = () => {
      isOpen = !isOpen;
      dropdown.style.display = isOpen ? "block" : "none";
      if (chevron) chevron.style.transform = isOpen ? "rotate(180deg)" : "";
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (!topbar.contains(e.target as Node)) {
        isOpen = false;
        dropdown.style.display = "none";
        if (chevron) chevron.style.transform = "";
      }
    };

    toggleBtn.addEventListener("click", handleToggle);
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      bellBtn.removeEventListener("click", handleBellClick);

      if (existingForm) {
        existingForm.style.cssText = "";
        const select = existingForm.querySelector("select") as HTMLElement | null;
        if (select) select.style.cssText = "";
        const submitBtn = existingForm.querySelector('button[type="submit"]') as HTMLElement | null;
        if (submitBtn) submitBtn.style.cssText = "";
        const formLabels = existingForm.querySelectorAll("label, span");
        formLabels.forEach((el) => {
          if ((el as HTMLElement).textContent?.includes("Acting as")) {
            (el as HTMLElement).style.display = "";
          }
        });
        if (formParent) {
          if (formNextSibling && formNextSibling.parentNode === formParent) {
            formParent.insertBefore(existingForm, formNextSibling);
          } else {
            formParent.appendChild(existingForm);
          }
        }
      }

      while (topbar.firstChild) topbar.removeChild(topbar.firstChild);
      for (const child of savedChildren) topbar.appendChild(child);

      if (label) label.style.display = labelOriginalDisplay;
      topbar.className = originalClassName;
      topbar.style.cssText = originalStyle;
    };
  }, [unreadCount]);

  /* ─── Notifications ─── */

  const markAsRead = useCallback(
    async (notifId: string) => {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notifId);

      setNotifList((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
    },
    []
  );

  /* ─── Build unified session list ─── */

  const allSessions = useMemo<UnifiedSession[]>(() => {
    const list: UnifiedSession[] = [];
    const now = Date.now();

    for (const r of groupReservations) {
      if (!r.session || r.session.status !== "scheduled") continue;
      const s = r.session;
      const coach = s.coach_id ? coaches[s.coach_id] : null;
      const [sH, sM] = (s.session_time || "00:00").slice(0, 5).split(":").map(Number);
      const sessionStart = new Date(s.session_date + "T00:00:00");
      sessionStart.setHours(sH ?? 0, sM ?? 0, 0, 0);

      list.push({
        id: `group-${r.id}`,
        type: "group",
        name: s.session_type || "Session",
        date: s.session_date,
        time: s.session_time,
        durationMinutes: s.duration_minutes,
        locationType: s.location_type,
        location: s.location,
        zoomLink: s.zoom_link,
        coachId: s.coach_id,
        coachName: coach ? `Coach ${coach.firstName}` : "Coach",
        color: sessionTypeColors[s.session_type] || "#3b82f6",
        sessionId: s.id,
        reservationId: r.id,
        isPast: sessionStart.getTime() + s.duration_minutes * 60000 < now,
      });
    }

    for (const b of individualBookings) {
      const coach = coaches[b.coach_id];
      const [bH, bM] = (b.booking_time || "00:00").slice(0, 5).split(":").map(Number);
      const bookingStart = new Date(b.booking_date + "T00:00:00");
      bookingStart.setHours(bH ?? 0, bM ?? 0, 0, 0);

      list.push({
        id: `ind-${b.id}`,
        type: "individual",
        name: b.session_type?.name || "1-on-1 Session",
        date: b.booking_date,
        time: b.booking_time,
        durationMinutes: b.duration_minutes,
        locationType: b.session_type?.location_type || "virtual",
        location: null,
        zoomLink: b.zoom_link,
        coachId: b.coach_id,
        coachName: coach ? `Coach ${coach.firstName}` : "Coach",
        color: b.session_type?.color || "#4a90d9",
        sessionId: null,
        reservationId: b.id,
        isPast: bookingStart.getTime() + b.duration_minutes * 60000 < now,
      });
    }

    const CATEGORY_COLORS: Record<string, string> = {
      technical: "#3b82f6",
      physical: "#ef4444",
      mental: "#8b5cf6",
    };

    for (const sb of soloBookings) {
      const ss = sb.solo_session;
      const category = ss?.category || "technical";
      const skillFormatted = (ss?.skill || "Solo Session")
        .split(/[-_]/)
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      list.push({
        id: `solo-${sb.id}`,
        type: "solo",
        name: ss?.title || skillFormatted,
        date: sb.scheduled_date,
        time: sb.scheduled_time || "00:00",
        durationMinutes: 30,
        locationType: "field",
        location: null,
        zoomLink: null,
        coachId: null,
        coachName: "",
        color: CATEGORY_COLORS[category] || "#f59e0b",
        sessionId: sb.solo_session_id,
        reservationId: sb.id,
        isPast: false,
        soloStatus: sb.status,
        soloPhotoUrl: sb.completion_photo_url,
        soloCategory: category.charAt(0).toUpperCase() + category.slice(1),
        soloSkill: skillFormatted,
      });
    }

    list.sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return a.time.localeCompare(b.time);
    });

    return list;
  }, [groupReservations, individualBookings, coaches, sessionTypeColors, soloBookings]);

  const filteredSessions = useMemo(() => {
    if (activeTab === "reservations") {
      return allSessions.filter((s) => !s.isPast);
    }
    return allSessions.filter((s) => s.date === selectedDateStr);
  }, [allSessions, activeTab, selectedDateStr]);

  /* ─── Calendar ─── */

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const goToPrevWeek = useCallback(() => {
    setWeekStart((ws) => {
      const d = new Date(ws);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((ws) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  /* ─── Cancel ─── */

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);

    try {
      if (cancelTarget.type === "group" && cancelTarget.sessionId) {
        const supabase = createClient();
        const { data: resRow } = await supabase
          .from("session_reservations")
          .select("id")
          .eq("session_id", cancelTarget.sessionId)
          .eq("player_id", playerId)
          .eq("reservation_status", "reserved")
          .maybeSingle() as { data: { id: string } | null };

        if (!resRow) {
          showToast("Reservation not found", "error");
          setCancelling(false);
          setCancelTarget(null);
          return;
        }
        const result = await cancelReservation(resRow.id, false, true);
        if (!result.success) {
          showToast(result.error || "Failed to cancel", "error");
          setCancelling(false);
          setCancelTarget(null);
          return;
        }
      } else {
        const result = await cancelReservation(cancelTarget.reservationId, true, true);
        if (!result.success) {
          showToast(result.error || "Failed to cancel", "error");
          setCancelling(false);
          setCancelTarget(null);
          return;
        }
      }
      showToast("Reservation cancelled", "success");
      setCancelling(false);
      setCancelTarget(null);
      router.refresh();
    } catch {
      showToast("Something went wrong", "error");
      setCancelling(false);
      setCancelTarget(null);
    }
  }, [cancelTarget, cancelling, playerId, showToast, router]);

  /* ─── Render ─── */

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className={styles.page}>
      {/* ─── Leaderboard ─── */}
      {leaderboard.length > 0 && (
        <div className={styles.leaderboard}>
          {leaderboard.map((player) => (
            <div key={player.playerId} className={styles.leaderboardItem}>
              <div className={styles.leaderboardAvatar}>
                {player.photoUrl ? (
                  <img
                    src={player.photoUrl}
                    alt={player.firstName}
                    className={styles.leaderboardPhoto}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const initialsEl = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                      if (initialsEl) initialsEl.style.display = "flex";
                    }}
                  />
                ) : null}
                <span
                  className={styles.leaderboardInitials}
                  style={{ display: player.photoUrl ? "none" : "flex" }}
                >
                  {player.initials}
                </span>
                <span className={styles.leaderboardPosition}>{player.position}</span>
              </div>
              <span className={styles.leaderboardName}>{player.firstName}</span>
              <span className={styles.leaderboardPoints}>{player.points} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Toggle Cards ─── */}
      <div className={styles.toggleContainer}>
        <button
          type="button"
          className={`${styles.toggleCard} ${activeTab === "reservations" ? styles.toggleCardActive : styles.toggleCardInactive}`}
          style={{ zIndex: activeTab === "reservations" ? 3 : 1 }}
          onClick={() => setActiveTab("reservations")}
        >
          <span className={styles.toggleCardLabel}>Reservations</span>
          <span className={styles.toggleCardCount}>
            {allSessions.filter((s) => !s.isPast).length}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.toggleCard} ${activeTab === "schedule" ? styles.toggleCardActive : styles.toggleCardInactive}`}
          style={{ zIndex: activeTab === "schedule" ? 3 : 1 }}
          onClick={() => setActiveTab("schedule")}
        >
          <span className={styles.toggleCardLabel}>My Schedule</span>
          <span className={styles.toggleCardCount}>
            {allSessions.filter((s) => s.date === todayStr).length}
          </span>
        </button>
      </div>

      {/* ─── Calendar Strip (only for My Schedule tab) ─── */}
      {activeTab === "schedule" && (
        <div className={styles.calendarStrip}>
          <button type="button" className={styles.calNavBtn} onClick={goToPrevWeek} aria-label="Previous week">
            <ChevronLeft size={18} />
          </button>
          <div className={styles.calDays}>
            {weekDays.map((day) => {
              const dayStr = formatDateString(day);
              const isToday = dayStr === todayStr;
              const isSelected = dayStr === selectedDateStr;
              return (
                <button
                  key={dayStr}
                  type="button"
                  className={`${styles.calDay} ${isToday ? styles.calDayToday : ""} ${isSelected ? styles.calDaySelected : ""}`}
                  onClick={() => setSelectedDate(new Date(day))}
                >
                  <span className={styles.calDayLabel}>{DAY_LABELS[day.getDay()]}</span>
                  <span className={styles.calDayNum}>{day.getDate()}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className={styles.calNavBtn} onClick={goToNextWeek} aria-label="Next week">
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ─── Session Cards ─── */}
      <div className={styles.sessionsSection}>
        {filteredSessions.length === 0 ? (
          <p className={styles.emptyState}>
            {activeTab === "schedule"
              ? "No Sessions Reserved Today"
              : "No upcoming reservations"}
          </p>
        ) : (
          <div className={styles.sessionsScroll} ref={scrollRef}>
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className={styles.sessionCard}
                style={{ borderLeftColor: session.color }}
              >
                <div className={styles.sessionCardHeader}>
                  <span className={styles.sessionCardDate}>
                    {formatDateLabel(session.date)} &bull; {formatTime12(session.time)}
                  </span>
                  {session.type === "individual" && (
                    <span className={styles.sessionCardBadge}>1-on-1</span>
                  )}
                  {session.type === "solo" && (
                    <span className={styles.sessionCardBadgeSolo}>{session.soloCategory}</span>
                  )}
                </div>
                <h3 className={styles.sessionCardTitle}>{session.name}</h3>

                {session.type === "solo" ? (
                  <div className={styles.sessionCardMeta}>
                    {session.soloSkill && (
                      <div className={styles.sessionCardRow}>
                        <Target size={14} className={styles.sessionCardIcon} />
                        <span>{session.soloSkill}</span>
                      </div>
                    )}
                    <div className={styles.soloStatusRow}>
                      {session.soloStatus === "scheduled" && (
                        <span className={styles.soloStatusScheduled}>Scheduled</span>
                      )}
                      {session.soloStatus === "pending_review" && (
                        <span className={styles.soloStatusPending}>
                          📷 Pending Review
                          {session.soloPhotoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={session.soloPhotoUrl} alt="" className={styles.soloStatusThumb} />
                          )}
                        </span>
                      )}
                      {session.soloStatus === "checked-in" && (
                        <span className={styles.soloStatusCheckedIn}>
                          ✓ Completed <span className={styles.soloPointsEarned}>+8 pts</span>
                        </span>
                      )}
                      {session.soloStatus === "denied" && (
                        <span className={styles.soloStatusDenied}>Photo Denied — Re-upload in Solo</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.sessionCardMeta}>
                    {session.locationType === "virtual" ? (
                      <div className={styles.sessionCardRow}>
                        <Video size={14} className={styles.sessionCardIcon} />
                        <span>Virtual Session</span>
                        {session.zoomLink && (
                          <a
                            href={session.zoomLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.sessionCardZoomLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Join →
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className={styles.sessionCardRow}>
                        <MapPin size={14} className={styles.sessionCardIcon} />
                        <span>{session.location || "On-Field"}</span>
                      </div>
                    )}
                    <div className={styles.sessionCardRow}>
                      <User size={14} className={styles.sessionCardIcon} />
                      <span>{session.coachName}</span>
                    </div>
                  </div>
                )}
                {!session.isPast && session.type !== "solo" && (
                  <button
                    type="button"
                    className={styles.sessionCancelBtn}
                    onClick={() => setCancelTarget(session)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Bottom Section: Objectives / Quiz ─── */}
      <div className={styles.bottomSection}>
        <div className={styles.bottomTabs}>
          <button
            type="button"
            className={`${styles.bottomTab} ${bottomTab === "objectives" ? styles.bottomTabActive : ""}`}
            onClick={() => setBottomTab("objectives")}
          >
            <Target size={16} />
            Objectives
          </button>
          <button
            type="button"
            className={`${styles.bottomTab} ${bottomTab === "quiz" ? styles.bottomTabActive : ""}`}
            onClick={() => setBottomTab("quiz")}
          >
            <HelpCircle size={16} />
            Quiz
          </button>
        </div>

        {bottomTab === "objectives" ? (
          <div className={styles.objectivesContent}>
            <div className={styles.focusBanner}>
              <span className={styles.focusLabel}>CURRENT FOCUS</span>
              <span className={styles.focusText}>{currentFocus}</span>
            </div>
            {objectives ? (
              <div className={styles.objectivesList}>
                {objectives.in_possession_objective && (
                  <div className={styles.objectiveItem}>
                    <span className={styles.objectiveTag}>In Possession</span>
                    <p className={styles.objectiveText}>{objectives.in_possession_objective}</p>
                  </div>
                )}
                {objectives.out_of_possession_objective && (
                  <div className={styles.objectiveItem}>
                    <span className={styles.objectiveTag}>Out of Possession</span>
                    <p className={styles.objectiveText}>{objectives.out_of_possession_objective}</p>
                  </div>
                )}
                {!objectives.in_possession_objective && !objectives.out_of_possession_objective && (
                  <p className={styles.objectivesEmpty}>No objectives set yet</p>
                )}
              </div>
            ) : (
              <p className={styles.objectivesEmpty}>No objectives yet</p>
            )}
          </div>
        ) : (
          <div className={styles.quizContent}>
            <HelpCircle size={40} className={styles.quizEmptyIcon} />
            <p className={styles.quizEmptyText}>No quizzes yet</p>
          </div>
        )}
      </div>

      {/* ─── Cancel Confirmation Modal ─── */}
      {cancelTarget && (
        <div className={styles.modalOverlay} onClick={() => !cancelling && setCancelTarget(null)}>
          <div className={styles.cancelModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.cancelModalTitle}>Cancel Reservation</h3>
            <p className={styles.cancelModalText}>
              Are you sure you want to cancel <strong>{cancelTarget.name}</strong>?
            </p>
            <div className={styles.cancelModalActions}>
              <button
                type="button"
                className={styles.cancelModalKeep}
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                Keep
              </button>
              <button
                type="button"
                className={styles.cancelModalConfirm}
                onClick={confirmCancel}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Notification Bottom Sheet ─── */}
      {notifOpen && (
        <div className={styles.notifOverlay} onClick={() => setNotifOpen(false)}>
          <div className={styles.notifSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.notifHandle} />
            <div className={styles.notifHeader}>
              <h3 className={styles.notifTitle}>Notifications</h3>
              <button type="button" className={styles.notifClose} onClick={() => setNotifOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.notifList}>
              {notifList.length === 0 ? (
                <div className={styles.notifEmpty}>
                  <BellOff size={40} style={{ opacity: 0.4 }} />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifList.map((notif) => (
                  <div
                    key={notif.id}
                    className={`${styles.notifItem} ${!notif.is_read ? styles.notifItemUnread : ""}`}
                    onClick={() => markAsRead(notif.id)}
                  >
                    <div className={styles.notifIcon}>
                      {getNotifIcon(notif.notification_type)}
                    </div>
                    <div className={styles.notifContent}>
                      <span className={styles.notifItemTitle}>
                        {getNotifTitle(notif.notification_type, notif.title)}
                      </span>
                      {notif.message && (
                        <span className={styles.notifMessage}>{notif.message}</span>
                      )}
                      <span className={styles.notifDate}>
                        {new Date(notif.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {!notif.is_read && <div className={styles.notifDot} />}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
