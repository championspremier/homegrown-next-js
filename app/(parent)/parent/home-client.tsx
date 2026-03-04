"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, MapPin, Video, User, Users,
} from "lucide-react";
import { cancelReservation } from "@/app/actions/schedule";
import { useToast } from "@/components/ui/Toast";
import NotificationBell from "@/components/notifications/NotificationBell";
import styles from "./home.module.css";

/* ─── Types ─── */

interface GroupReservation {
  id: string;
  session_id: string;
  player_id: string;
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
  player_id: string;
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

interface UnifiedSession {
  id: string;
  type: "group" | "individual";
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
  reservationIds: string[];
  playerIds: string[];
  playerNames: string[];
  isPast: boolean;
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

interface LinkedPlayer {
  id: string;
  firstName: string;
  lastName: string;
}

interface CancelTarget {
  session: UnifiedSession;
  selectedReservationIds: Set<string>;
}

interface Props {
  parentId: string;
  parentName: string;
  todayStr: string;
  linkedPlayers: Record<string, LinkedPlayer>;
  groupReservations: GroupReservation[];
  individualBookings: IndividualBooking[];
  coaches: Record<string, { id: string; firstName: string; lastName: string }>;
  sessionTypeColors: Record<string, string>;
  leaderboard: LeaderboardPlayer[];
  unreadNotificationCount: number;
  notifications: Notification[];
  eliteDataByPlayer: {
    playerId: string;
    playerName: string;
    weeklyTotalHours: number;
    eliteTargetHours: number;
  }[];
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

/* ─── Component ─── */

export default function ParentHomeClient({
  parentId,
  todayStr,
  linkedPlayers,
  groupReservations,
  individualBookings,
  coaches,
  sessionTypeColors,
  leaderboard,
  unreadNotificationCount,
  notifications: initialNotifications,
  eliteDataByPlayer,
}: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"schedule" | "reservations">("schedule");
  const [bellPortalTarget, setBellPortalTarget] = useState<HTMLElement | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOfWeek(today));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(today));

  const selectedDateStr = formatDateString(selectedDate);

  void unreadNotificationCount;

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

    const bellSlot = document.createElement("div");
    bellSlot.style.cssText = "display: contents;";
    rightGroup.appendChild(bellSlot);
    setBellPortalTarget(bellSlot);

    topbar.appendChild(leftSpacer);
    topbar.appendChild(toggleBtn);
    topbar.appendChild(rightGroup);

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
      setBellPortalTarget(null);
      document.removeEventListener("click", handleClickOutside);

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
  }, []);

  /* ─── Build unified session list (grouped by session for group sessions) ─── */

  const allSessions = useMemo<UnifiedSession[]>(() => {
    const now = Date.now();

    // Group reservations by session_id so multiple players on same session → one card
    const groupMap = new Map<
      string,
      {
        session: GroupReservation["session"];
        reservationIds: string[];
        playerIds: string[];
      }
    >();
    for (const r of groupReservations) {
      if (!r.session || r.session.status !== "scheduled") continue;
      const sid = r.session_id;
      const existing = groupMap.get(sid);
      if (existing) {
        existing.reservationIds.push(r.id);
        existing.playerIds.push(r.player_id);
      } else {
        groupMap.set(sid, {
          session: r.session,
          reservationIds: [r.id],
          playerIds: [r.player_id],
        });
      }
    }

    const list: UnifiedSession[] = [];

    for (const [sid, { session: s, reservationIds, playerIds }] of groupMap) {
      if (!s) continue;
      const coach = s.coach_id ? coaches[s.coach_id] : null;
      const [sH, sM] = (s.session_time || "00:00").slice(0, 5).split(":").map(Number);
      const sessionStart = new Date(s.session_date + "T00:00:00");
      sessionStart.setHours(sH ?? 0, sM ?? 0, 0, 0);

      const names = playerIds.map((pid) => {
        const p = linkedPlayers[pid];
        return p ? `${p.firstName} ${p.lastName}`.trim() : "Player";
      });

      list.push({
        id: `group-${sid}`,
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
        sessionId: sid,
        reservationIds,
        playerIds,
        playerNames: names,
        isPast: sessionStart.getTime() + s.duration_minutes * 60000 < now,
      });
    }

    for (const b of individualBookings) {
      const coach = coaches[b.coach_id];
      const [bH, bM] = (b.booking_time || "00:00").slice(0, 5).split(":").map(Number);
      const bookingStart = new Date(b.booking_date + "T00:00:00");
      bookingStart.setHours(bH ?? 0, bM ?? 0, 0, 0);

      const playerName = linkedPlayers[b.player_id]
        ? `${linkedPlayers[b.player_id].firstName} ${linkedPlayers[b.player_id].lastName}`.trim()
        : "Player";

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
        reservationIds: [b.id],
        playerIds: [b.player_id],
        playerNames: [playerName],
        isPast: bookingStart.getTime() + b.duration_minutes * 60000 < now,
      });
    }

    list.sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return a.time.localeCompare(b.time);
    });

    return list;
  }, [groupReservations, individualBookings, coaches, sessionTypeColors, linkedPlayers]);

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

  const openCancelModal = useCallback((session: UnifiedSession) => {
    setCancelTarget({
      session,
      selectedReservationIds: new Set(session.reservationIds),
    });
  }, []);

  const toggleCancelPlayer = useCallback((resId: string) => {
    setCancelTarget((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.selectedReservationIds);
      if (next.has(resId)) next.delete(resId);
      else next.add(resId);
      return { ...prev, selectedReservationIds: next };
    });
  }, []);

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);

    try {
      const { session, selectedReservationIds } = cancelTarget;
      let successCount = 0;
      let lastError: string | null = null;

      if (session.type === "individual") {
        const resId = session.reservationIds[0];
        const result = await cancelReservation(resId, true, true);
        if (result.success) {
          successCount++;
        } else {
          lastError = result.error || "Failed to cancel";
        }
      } else {
        for (const resId of selectedReservationIds) {
          const result = await cancelReservation(resId, false, true);
          if (result.success) {
            successCount++;
          } else {
            lastError = result.error || "Failed to cancel";
          }
        }
      }

      if (successCount > 0) {
        showToast(
          `Cancelled ${successCount} reservation${successCount > 1 ? "s" : ""}`,
          "success"
        );
        router.refresh();
      } else {
        showToast(lastError || "Failed to cancel", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  }, [cancelTarget, cancelling, showToast, router]);

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
          <span className={styles.toggleCardLabel}>Schedule</span>
          <span className={styles.toggleCardCount}>
            {allSessions.filter((s) => s.date === todayStr).length}
          </span>
        </button>
      </div>

      {/* ─── Calendar Strip (only for Schedule tab) ─── */}
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
                </div>
                <h3 className={styles.sessionCardTitle}>{session.name}</h3>
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
                  {session.playerNames.length > 0 && (
                    <div className={styles.sessionCardRow}>
                      <Users size={14} className={styles.sessionCardIcon} />
                      <span className={styles.sessionPlayerName}>
                        {session.playerNames.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                {!session.isPast && (
                  <button
                    type="button"
                    className={styles.sessionCancelBtn}
                    onClick={() => openCancelModal(session)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Elite Standard KPI — widget carousel ─── */}
      {eliteDataByPlayer.length > 0 && (
        <EliteCarousel eliteDataByPlayer={eliteDataByPlayer} />
      )}

      {/* ─── Cancel Modal ─── */}
      {cancelTarget && (
        <div className={styles.modalOverlay} onClick={() => !cancelling && setCancelTarget(null)}>
          <div className={styles.cancelModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.cancelModalTitle}>Cancel Reservation</h3>

            {cancelTarget.session.type === "group" && cancelTarget.session.reservationIds.length > 1 ? (
              <>
                <p className={styles.cancelModalText}>
                  Select which player(s) to cancel for <strong>{cancelTarget.session.name}</strong>:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {cancelTarget.session.reservationIds.map((resId, i) => {
                    const checked = cancelTarget.selectedReservationIds.has(resId);
                    const playerName = cancelTarget.session.playerNames[i] || "Player";
                    return (
                      <label
                        key={resId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          border: `1px solid ${checked ? "#ef4444" : "var(--border)"}`,
                          borderRadius: 8,
                          cursor: "pointer",
                          background: checked
                            ? "color-mix(in srgb, #ef4444 6%, var(--background))"
                            : "var(--background)",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCancelPlayer(resId)}
                          style={{ width: 18, height: 18, accentColor: "#ef4444" }}
                        />
                        <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{playerName}</span>
                      </label>
                    );
                  })}
                </div>
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
                    disabled={cancelling || cancelTarget.selectedReservationIds.size === 0}
                  >
                    {cancelling
                      ? "Cancelling..."
                      : `Cancel ${cancelTarget.selectedReservationIds.size} Player${cancelTarget.selectedReservationIds.size !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.cancelModalText}>
                  Are you sure you want to cancel <strong>{cancelTarget.session.name}</strong>
                  {cancelTarget.session.playerNames.length > 0 && (
                    <> for {cancelTarget.session.playerNames[0]}</>
                  )}?
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Notification Bell (portaled into topbar) ─── */}
      {bellPortalTarget &&
        createPortal(
          <NotificationBell
            userId={parentId}
            role="parent"
            linkedPlayerIds={Object.keys(linkedPlayers)}
            initialNotifications={initialNotifications}
          />,
          bellPortalTarget
        )}
    </div>
  );
}

/* ─── Elite Carousel sub-component ─── */

interface ElitePlayer {
  playerId: string;
  playerName: string;
  weeklyTotalHours: number;
  eliteTargetHours: number;
}

function EliteCarousel({ eliteDataByPlayer }: { eliteDataByPlayer: ElitePlayer[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isMultiple = eliteDataByPlayer.length > 1;

  const applyScaleEffects = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !isMultiple) return;

    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    let closestIdx = 0;
    let closestDist = Infinity;

    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const dist = Math.abs(cardCenterY - centerY);
      const maxDist = containerRect.height / 2;
      const ratio = Math.min(dist / maxDist, 1);

      const scale = 1 - ratio * 0.08;
      const opacity = 1 - ratio * 0.35;
      card.style.transform = `scale(${scale})`;
      card.style.opacity = String(opacity);

      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    setActiveIndex(closestIdx);
  }, [isMultiple]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isMultiple) return;

    applyScaleEffects();
    container.addEventListener("scroll", applyScaleEffects, { passive: true });
    return () => container.removeEventListener("scroll", applyScaleEffects);
  }, [applyScaleEffects, isMultiple]);

  const scrollToCard = useCallback((index: number) => {
    const card = cardRefs.current[index];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }, []);

  return (
    <div className={`${styles.eliteWrapper} ${isMultiple ? "" : styles.eliteWrapperSingle}`}>
      <div
        ref={scrollRef}
        className={`${styles.eliteScroll} ${isMultiple ? styles.eliteScrollMultiple : ""}`}
      >
        {eliteDataByPlayer.map((player, i) => {
          const pct = player.eliteTargetHours > 0 ? (player.weeklyTotalHours / player.eliteTargetHours) * 100 : 0;
          const barColor = pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";
          return (
            <div
              key={player.playerId}
              ref={(el) => { cardRefs.current[i] = el; }}
              className={styles.eliteCard}
            >
              <div className={styles.eliteCardHeader}>
                <div className={styles.eliteCardLabels}>
                  <span className={styles.eliteCardName}>{player.playerName}</span>
                  <span className={styles.eliteCardLabel}>Elite Standard</span>
                </div>
                <span className={styles.eliteCardHours}>
                  <span className={styles.eliteHoursValue}>{player.weeklyTotalHours}</span>
                  <span className={styles.eliteHoursTarget}> / {player.eliteTargetHours} hrs</span>
                </span>
              </div>
              <div className={styles.eliteBarTrack}>
                <div
                  className={styles.eliteBarFill}
                  style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {isMultiple && (
        <div className={styles.eliteDots}>
          {eliteDataByPlayer.map((_, i) => (
            <button
              key={eliteDataByPlayer[i].playerId}
              type="button"
              className={`${styles.eliteDot} ${i === activeIndex ? styles.eliteDotActive : ""}`}
              onClick={() => scrollToCard(i)}
              aria-label={`View ${eliteDataByPlayer[i].playerName}'s stats`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
