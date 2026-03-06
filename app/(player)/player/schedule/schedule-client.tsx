"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { reserveGroupSession, bookIndividualSessionForPlayer, cancelReservation } from "@/app/actions/schedule";
import { useToast } from "@/components/ui/Toast";
import { PlanGate } from "@/components/plan-gate/PlanGate";
import { usePlanAccess } from "@/components/plan-gate/PlanAccessContext";
import styles from "./schedule.module.css";

import { mapSessionTypeNameToKey } from "@/lib/session-usage";
import { Lock } from "lucide-react";

const SESSION_LABEL_TO_KEY: Record<string, string> = {
  "1:1 Sessions": "one_on_one",
  "Tec Tac": "tec_tac",
  "Sprint Training": "sprint_training",
  "Strength & Conditioning": "strength_conditioning",
  "CPP": "cpp",
  "College Advising": "college_advising",
  "Psychologist": "psychologist",
  "Nutrition": "nutrition",
  "Pro Player Stories": "pro_player_stories",
  "Group Film Analysis": "group_film_analysis",
};
import type { PlayerIndividualSessionType } from "./page";

export interface PlayerScheduleClientProps {
  playerId: string;
  parentId: string | null;
  onFieldSessionTypes: string[];
  virtualGroupSessionTypes: string[];
  onFieldIndividualSessionTypes: PlayerIndividualSessionType[];
  virtualIndividualSessionTypes: PlayerIndividualSessionType[];
  coachNames: Record<string, string>;
  coachFullNames: Record<string, string>;
  sessionTypeColors: Record<string, string>;
  coachProfileDetails?: Record<string, { coachRole: string; profilePhotoUrl: string | null; teamLogos: string[] }>;
  onFieldProgramLogoUrl?: string | null;
  onBeforeBook?: (slot: MergedSlot, excludePlayerIds?: string[]) => Promise<{ playerIds: string[]; cancel: boolean }>;
  onBeforeCancel?: (slot: MergedSlot, reservedPlayers: { playerId: string; playerName: string; reservationId: string }[]) => Promise<{ playerIds: string[]; cancel: boolean }>;
  allLinkedPlayers?: { id: string; first_name: string | null; last_name: string | null }[];
}

/** Virtual section: combined group sessions + individual time slots, sorted by time */
interface MergedSlot {
  id: string;
  time: string;
  displayTime: string;
  label: string;
  labelAbbrev?: string;
  badge: "group" | "1-on-1";
  coach: string | null;
  coachId: string | null;
  coachFullName?: string;
  coachPhotoUrl?: string;
  location: string | null;
  capacity?: string;
  sessionId?: string;
  sessionTypeId?: string;
  bookingDate?: string;
  bookingTime?: string;
  durationMinutes?: number;
  booked?: boolean;
  isPast?: boolean;
  date?: string;
  description?: string;
  badgeColor?: string;
  locationType?: "on-field" | "virtual";
  zoomLink?: string;
  assistantCoachIds?: string[];
  assistantCoachNames?: string[];
  assistantCoachFullNames?: string[];
  gkCoachId?: string;
  gkCoachName?: string;
  gkCoachFullName?: string;
}

interface Session {
  id: string;
  session_type: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  location_type: string;
  location: string | null;
  zoom_link: string | null;
  coach_id: string | null;
  assistant_coach_ids: string[] | null;
  gk_coach_id: string | null;
  attendance_limit: number;
  status: string;
  description: string | null;
}

interface CoachAvailabilityRow {
  id: string;
  coach_id: string;
  individual_session_type_id: string;
  day_of_week: number; // 0=Sunday … 6=Saturday
  start_time: string;  // "HH:MM:SS" or "HH:MM"
  end_time: string;    // "HH:MM:SS" or "HH:MM"
  is_active: boolean;
  location?: string | null;
}

interface TimeSlot {
  time: string;
  displayTime: string;
  coachId?: string;
  coachIds?: string[];
  booked?: boolean;
  bookedByMe?: boolean;
  location?: string | null;
}

/* GeneralAvailabilityMap removed — table uses row-per-day, not JSONB */

/* ---------- Helpers (names aligned with old app for cross-reference) ---------- */

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatTime12Hour(timeStr: string): string {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parts[1] ?? "00";
  const am = h < 12;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${am ? "AM" : "PM"}`;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Parse "HH:MM" (24h) or "H:MM AM/PM" to a Date (today, that time). */
function parseTime(timeStr: string): Date {
  const trimmed = timeStr.trim();
  const amPm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed);
  if (amPm) {
    let h = parseInt(amPm[1] ?? "0", 10);
    const m = parseInt(amPm[2] ?? "0", 10);
    if ((amPm[3] ?? "").toUpperCase() === "PM" && h !== 12) h += 12;
    if ((amPm[3] ?? "").toUpperCase() === "AM" && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  const parts = trimmed.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** Generate slots between start and end, step by granularity; only include slots where slot + duration <= end. */
function generateSlotsForRange(
  startTime: string,
  endTime: string,
  granularityMinutes: number,
  durationMinutes: number
): TimeSlot[] {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const slots: TimeSlot[] = [];
  const stepMs = granularityMinutes * 60 * 1000;
  const durationMs = durationMinutes * 60 * 1000;
  let t = start.getTime();
  const endMs = end.getTime();
  while (t + durationMs <= endMs) {
    const d = new Date(t);
    const h = d.getHours();
    const m = d.getMinutes();
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    slots.push({ time, displayTime: formatTime12Hour(time + ":00") });
    t += stepMs;
  }
  return slots;
}

/* ---------- CalendarStrip (inline) ---------- */

interface CalendarStripProps {
  weekStart: Date;
  selectedDate: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (date: Date) => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
}

function CalendarStrip({
  weekStart,
  selectedDate,
  onPrevWeek,
  onNextWeek,
  onSelectDay,
  isPrevDisabled,
  isNextDisabled,
}: CalendarStripProps) {
  const weekDays = getWeekDays(weekStart);
  const today = new Date();
  const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className={styles.calendarHeader}>
      <button
        type="button"
        className={styles.calendarNav}
        onClick={onPrevWeek}
        disabled={isPrevDisabled}
        aria-label="Previous week"
      >
        ‹
      </button>
      <div className={styles.calendarWeekRow}>
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const todayMidnight = new Date(today);
          todayMidnight.setHours(0, 0, 0, 0);
          const dayMidnight = new Date(day);
          dayMidnight.setHours(0, 0, 0, 0);
          const isPast = dayMidnight.getTime() < todayMidnight.getTime();
          const isFuture = dayMidnight.getTime() > todayMidnight.getTime();

          const dayNumberClass = [
            styles.dayNumber,
            isToday && styles.dayNumberToday,
            isPast && styles.dayNumberPast,
            isFuture && styles.dayNumberFuture,
            isSelected && styles.dayNumberSelected,
          ]
            .filter(Boolean)
            .join(" ");

          const dayLabelClass = [
            styles.dayLabel,
            isPast && styles.dayLabelPast,
            isToday && styles.dayLabelToday,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={day.getTime()}
              type="button"
              className={styles.calendarDay}
              onClick={() => onSelectDay(day)}
            >
              <span className={dayLabelClass}>{dayLabels[i]}</span>
              <span className={dayNumberClass}>{day.getDate()}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.calendarNav}
        onClick={onNextWeek}
        disabled={isNextDisabled}
        aria-label="Next week"
      >
        ›
      </button>
    </div>
  );
}

/* ---------- SlotCard (inline) ---------- */

interface SlotCardProps {
  time: string;
  badge: "group" | "1-on-1";
  labelAbbrev?: string;
  badgeColor?: string;
  locationType?: "on-field" | "virtual";
  coach: string | null;
  coachFullName?: string;
  coachPhotoUrl?: string;
  isSelected: boolean;
  isBooked?: boolean;
  isPast?: boolean;
  isReserved?: boolean;
  onSelect: () => void;
  onDetails: () => void;
  reservedPlayers?: { playerName: string }[];
  someReserved?: boolean;
  allReserved?: boolean;
  onAddPlayer?: () => void;
}

function SlotSkeleton() {
  return (
    <div className={styles.slotSkeletonContainer}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={styles.slotSkeleton}>
          <div className={styles.skeletonPulse} style={{ width: 60, height: 14, borderRadius: 4 }} />
          <div className={styles.skeletonPulse} style={{ width: 36, height: 18, borderRadius: 10 }} />
          <div className={styles.skeletonPulse} style={{ width: 28, height: 28, borderRadius: "50%" }} />
          <div style={{ flex: 1 }} />
          <div className={styles.skeletonPulse} style={{ width: 44, height: 14, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

function SlotCard({
  time,
  badge,
  labelAbbrev,
  badgeColor,
  locationType,
  coach,
  coachFullName,
  coachPhotoUrl,
  isSelected,
  isBooked = false,
  isPast = false,
  isReserved = false,
  onSelect,
  onDetails,
  reservedPlayers,
  someReserved = false,
  allReserved = false,
  onAddPlayer,
}: SlotCardProps) {
  const disabled = isBooked || isPast || (isReserved && !onAddPlayer);
  return (
    <div
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      className={`${styles.slotCard} ${isPast ? styles.slotCardPast : ""} ${isReserved ? styles.slotCardReserved : ""} ${isSelected ? styles.slotCardSelected : ""} ${isBooked ? styles.slotCardBooked : ""}`}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles.slotTime}>{time}</div>
      <div className={styles.slotMiddle}>
        <span
          className={`${styles.slotBadge} ${badge === "group" ? styles.slotBadgeGroup : styles.slotBadgeIndividual}`}
          style={badgeColor ? { backgroundColor: `${badgeColor}22`, color: badgeColor } : undefined}
        >
          {badge === "group"
            ? (labelAbbrev || "GROUP")
            : (locationType === "on-field" ? "1:1" : (labelAbbrev || "1:1"))}
        </span>
        {coach && (
          <div className={styles.slotCoachGroup}>
            <div className={styles.slotCoachAvatar}>
              {coachPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coachPhotoUrl} alt="" className={styles.slotCoachAvatarImg} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : null}
              <span className={styles.slotCoachInitials}>{getInitials(coachFullName || coach.replace(/^Coach\s+/i, ""))}</span>
            </div>
            {!isSelected && <span className={styles.slotCoach}>{coach}</span>}
            {reservedPlayers && reservedPlayers.length > 0 && (
              <div className={styles.reservedAvatarStack}>
                {reservedPlayers.map((p, i) => (
                  <div key={i} className={styles.reservedAvatar} title={p.playerName}>
                    {getInitials(p.playerName)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {isPast && !isReserved ? (
        <div className={styles.slotActions}>
          <span className={styles.slotPastLabel}>Past</span>
        </div>
      ) : isReserved || someReserved ? (
        <div className={styles.slotActions} style={{ gap: 8 }}>
          <button
            type="button"
            className={styles.slotDetailsLink}
            onClick={(e) => {
              e.stopPropagation();
              onDetails();
            }}
          >
            Details
          </button>
          <span className={styles.slotReservedBadge}>✓ Reserved</span>
          {someReserved && !allReserved && onAddPlayer && (
            <button
              type="button"
              className={styles.slotAddPlayerBtn}
              onClick={(e) => {
                e.stopPropagation();
                onAddPlayer();
              }}
            >
              + Add
            </button>
          )}
        </div>
      ) : (
        <div className={styles.slotActions}>
          <button
            type="button"
            className={styles.slotDetailsLink}
            onClick={(e) => {
              e.stopPropagation();
              onDetails();
            }}
          >
            Details
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- CoachSelectionModal (inline) ---------- */

interface CoachSelectionModalProps {
  coaches: CoachAvailabilityRow[];
  selectedCoachId: string | null;
  coachNames: Record<string, string>;
  coachFullNames: Record<string, string>;
  coachProfileDetails?: Record<string, { coachRole: string; profilePhotoUrl: string | null; teamLogos: string[] }>;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  selectedDate: Date;
}

function CoachSelectionModal({
  coaches,
  selectedCoachId,
  coachNames: names,
  coachFullNames: fullNames,
  coachProfileDetails: profiles,
  onSelect,
  onClose,
  selectedDate,
}: CoachSelectionModalProps) {
  const [coachRoleFilter, setCoachRoleFilter] = useState("all");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const availableRoles = useMemo(() => {
    return [...new Set(
      coaches.map((c) => profiles?.[c.coach_id]?.coachRole || "Coach")
    )].sort();
  }, [coaches, profiles]);

  const filteredCoaches = useMemo(() => {
    if (coachRoleFilter === "all") return coaches;
    return coaches.filter((c) => (profiles?.[c.coach_id]?.coachRole || "Coach") === coachRoleFilter);
  }, [coaches, coachRoleFilter, profiles]);

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Select a Coach</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.coachModalSubRow}>
          <p className={styles.modalSubtext} style={{ margin: 0 }}>{formattedDate}</p>
          {availableRoles.length > 1 && (
            <select
              className={styles.coachRoleFilterSelect}
              value={coachRoleFilter}
              onChange={(e) => setCoachRoleFilter(e.target.value)}
            >
              <option value="all">All Coaches</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          )}
        </div>
        {filteredCoaches.length === 0 ? (
          <p className={styles.emptyState}>No coaches available on this day. Try another date.</p>
        ) : (
          <div className={styles.coachGrid}>
            {filteredCoaches.length >= 2 && coachRoleFilter === "all" && (
              <button
                type="button"
                className={`${styles.coachCard} ${selectedCoachId === null ? styles.coachCardSelected : ""}`}
                onClick={() => {
                  onSelect(null);
                  onClose();
                }}
              >
                <div className={styles.coachAvatarPlaceholder}>
                  <span className={styles.coachInitials}>?</span>
                </div>
                <div className={styles.coachName}>Any available</div>
                <div className={styles.coachRole}>Any Coach</div>
                {selectedCoachId === null && <span className={styles.coachCheckmark}>✓</span>}
              </button>
            )}
            {filteredCoaches.map((row) => {
              const isSelected = selectedCoachId === row.coach_id;
              const profile = profiles?.[row.coach_id];
              const initials = getInitials((fullNames[row.coach_id] || names[row.coach_id] || "").replace(/^Coach\s+/i, ""));
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`${styles.coachCard} ${isSelected ? styles.coachCardSelected : ""}`}
                  onClick={() => {
                    onSelect(row.coach_id);
                    onClose();
                  }}
                >
                  <div className={styles.coachAvatarPlaceholder}>
                    {profile?.profilePhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.profilePhotoUrl}
                        alt=""
                        className={styles.coachAvatarImg}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <span className={styles.coachInitials}>{initials}</span>
                  </div>
                  <div className={styles.coachName}>{names[row.coach_id] || "Coach"}</div>
                  <div className={styles.coachRole}>{profile?.coachRole || "Coach"}</div>
                  {profile?.teamLogos && profile.teamLogos.length > 0 && (
                    <div className={styles.coachTeamLogos}>
                      {profile.teamLogos.slice(0, 4).map((logo, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={logo} alt="" className={styles.coachTeamLogoImg} />
                      ))}
                    </div>
                  )}
                  {isSelected && <span className={styles.coachCheckmark}>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- SessionDetailsModal ---------- */

function formatSlotDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function abbreviateSessionType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("speed training")) return "SPEED";
  if (lower.includes("tec tac")) return "TEC TAC";
  // Check for abbreviation in parentheses: "Champions Player Progress (CPP)" → "CPP"
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch) return parenMatch[1];
  // If already short, use as-is
  if (name.length <= 8) return name;
  // Otherwise take initials
  return name
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function SessionDetailsModal({
  slot,
  onClose,
  isReserved,
  isPast,
  bookingSlotId,
  bookingStatus,
  cancellingSlotId,
  onConfirm,
  onCancel,
  reservedPlayers,
}: {
  slot: MergedSlot;
  onClose: () => void;
  isReserved: boolean;
  isPast: boolean;
  bookingSlotId: string | null;
  bookingStatus: "idle" | "loading" | "success" | "error";
  cancellingSlotId: string | null;
  onConfirm: (slot: MergedSlot) => void;
  onCancel: (slot: MergedSlot) => void;
  reservedPlayers?: { playerName: string }[];
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const coachFullName =
    slot.coachFullName || slot.coach?.replace(/^Coach\s+/i, "") || "";
  const initials = getInitials(coachFullName);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.detailModalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalTitleGroup}>
            <span className={styles.detailModalName}>{slot.label}</span>
            <span className={styles.detailModalBadge}>
              <span
                className={`${styles.slotBadge} ${slot.badge === "group" ? styles.slotBadgeGroup : styles.slotBadgeIndividual}`}
                style={slot.badgeColor ? { backgroundColor: `${slot.badgeColor}22`, color: slot.badgeColor } : undefined}
              >
                {slot.badge === "group" ? "Group Session" : "1-on-1 Session"}
              </span>
            </span>
          </div>
          <button className={styles.detailModalClose} onClick={onClose} type="button" aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.detailModalDivider} />

        {/* Coaching staff */}
        {slot.coach && (
          <>
            <div className={styles.detailModalCoachSection}>
              <div className={styles.coachAvatarCircle}>
                {slot.coachPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.coachPhotoUrl} alt="" className={styles.coachAvatarCircleImg} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : null}
                <span>{initials || "?"}</span>
              </div>
              <div className={styles.coachAvatarInfo}>
                <span className={styles.coachAvatarName}>{slot.coach}</span>
                <span className={styles.coachAvatarRole}>Head Coach</span>
              </div>
            </div>

            {((slot.assistantCoachNames && slot.assistantCoachNames.length > 0) || slot.gkCoachName) && (
              <div className={styles.detailModalStaffRow}>
                {(slot.assistantCoachNames || []).map((name, i) => (
                  <div key={i} className={styles.staffMember}>
                    <div className={styles.staffAvatar}>
                      {getInitials(slot.assistantCoachFullNames?.[i] || name || "")}
                    </div>
                    <div className={styles.staffInfo}>
                      <span className={styles.staffName}>{name}</span>
                      <span className={styles.staffRole}>Assistant</span>
                    </div>
                  </div>
                ))}
                {slot.gkCoachName && (
                  <div className={styles.staffMember}>
                    <div className={styles.staffAvatarGk}>
                      {getInitials(slot.gkCoachFullName || slot.gkCoachName || "")}
                    </div>
                    <div className={styles.staffInfo}>
                      <span className={styles.staffName}>{slot.gkCoachName}</span>
                      <span className={styles.staffRole}>GK Coach</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={styles.detailModalDivider} />
          </>
        )}

        {/* Details body */}
        <div className={styles.detailModalBody}>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Date</span>
            <span className={styles.detailItemValue}>{slot.date || "—"}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Time</span>
            <span className={styles.detailItemValue}>{slot.displayTime}</span>
          </div>
          {slot.durationMinutes != null && (
            <div className={styles.detailItem}>
              <span className={styles.detailItemLabel}>Duration</span>
              <span className={styles.detailItemValue}>{slot.durationMinutes} min</span>
            </div>
          )}
          {slot.capacity && (
            <div className={styles.detailItem}>
              <span className={styles.detailItemLabel}>Spots</span>
              <span className={styles.detailItemValue}>{slot.capacity}</span>
            </div>
          )}
          {slot.location && (
            <div className={styles.detailItem}>
              <span className={styles.detailItemLabel}>Location</span>
              {slot.location !== "Virtual" && slot.location !== "On-field" ? (
                <a
                  href={
                    typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)
                      ? `https://maps.apple.com/?q=${encodeURIComponent(slot.location)}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(slot.location)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.detailItemLink}
                >
                  📍 {slot.location}
                </a>
              ) : (
                <span className={styles.detailItemValue}>{slot.location}</span>
              )}
            </div>
          )}
          {slot.zoomLink && (
            <div className={styles.detailItem}>
              <span className={styles.detailItemLabel}>Meeting</span>
              <a
                href={slot.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.detailItemZoomLink}
              >
                Join Zoom →
              </a>
            </div>
          )}
          {slot.description && (
            <div className={styles.detailItem}>
              <span className={styles.detailItemLabel}>Description</span>
              <span className={styles.detailItemValue}>{slot.description}</span>
            </div>
          )}
          {reservedPlayers && reservedPlayers.length > 0 && (
            <div className={styles.detailReservedRow}>
              <span className={styles.detailItemLabel}>Reserved</span>
              <div className={styles.reservedAvatarStack}>
                {reservedPlayers.map((p, i) => (
                  <div key={i} className={styles.reservedAvatarLg} title={p.playerName}>
                    {getInitials(p.playerName)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with action button */}
        <div className={styles.detailModalFooter}>
          {isPast ? (
            <p className={styles.detailModalPastLabel}>This session has passed</p>
          ) : isReserved ? (
            <div className={styles.detailModalReservedRow}>
              <span className={styles.detailModalReservedLabel}>✓ Registered</span>
              <button
                type="button"
                className={styles.detailModalCancelBtn}
                onClick={() => onCancel(slot)}
                disabled={cancellingSlotId === slot.id}
              >
                {cancellingSlotId === slot.id ? "Cancelling..." : "Cancel"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.detailModalConfirmBtn}
              onClick={() => onConfirm(slot)}
              disabled={bookingStatus === "loading" && bookingSlotId === slot.id}
            >
              {bookingSlotId === slot.id && bookingStatus === "loading" ? (
                <span className={styles.confirmSpinner} />
              ) : bookingSlotId === slot.id && bookingStatus === "success" ? (
                "✓ Booked!"
              ) : bookingSlotId === slot.id && bookingStatus === "error" ? (
                "Failed — Try Again"
              ) : (
                "Confirm Reservation"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

export default function PlayerScheduleClient({
  playerId,
  parentId,
  onFieldIndividualSessionTypes,
  virtualIndividualSessionTypes,
  coachNames,
  coachFullNames,
  sessionTypeColors,
  coachProfileDetails,
  onFieldProgramLogoUrl,
  onBeforeBook,
  onBeforeCancel,
  allLinkedPlayers,
}: PlayerScheduleClientProps) {
  const { showToast } = useToast();
  const planAccess = usePlanAccess();
  const virtualLocked = !planAccess.virtualAccess;
  const virtualReason = planAccess.hasPlan
    ? "Virtual sessions require a plan with Virtual Access"
    : "You need an active plan to access virtual sessions";

  const linkedIdsKey = useMemo(() => allLinkedPlayers?.map((p) => p.id).join(",") ?? "", [allLinkedPlayers]);
  const [onFieldOpen, setOnFieldOpen] = useState(false);
  const [virtualOpen, setVirtualOpen] = useState(false);
  const coachNameCacheRef = useRef<Record<string, string>>({ ...coachNames });
  const [detailSlot, setDetailSlot] = useState<MergedSlot | null>(null);

  const today = new Date();
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOfWeek(today));
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(today));

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [cancellingSlotId, setCancellingSlotId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [onFieldSlots, setOnFieldSlots] = useState<MergedSlot[]>([]);
  const [loadingOnField, setLoadingOnField] = useState(false);

  const [virtualTab, setVirtualTab] = useState<"group" | "individual">("group");
  const [virtualGroupSlots, setVirtualGroupSlots] = useState<MergedSlot[]>([]);
  const [loadingVirtualGroup, setLoadingVirtualGroup] = useState(false);
  const [virtualSlots, setVirtualSlots] = useState<MergedSlot[]>([]);
  const [loadingVirtual, setLoadingVirtual] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [coachAvailability, setCoachAvailability] = useState<CoachAvailabilityRow[]>([]);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [selectedVirtualIndividualTypeId, setSelectedVirtualIndividualTypeId] = useState<string | null>(null);
  const [onFieldSlotsVisible, setOnFieldSlotsVisible] = useState(4);
  const [virtualSlotsVisible, setVirtualSlotsVisible] = useState(4);

  const [myGroupReservations, setMyGroupReservations] = useState<Set<string>>(new Set());
  const [myIndividualBookings, setMyIndividualBookings] = useState<Set<string>>(new Set());
  const [sessionPlayerReservations, setSessionPlayerReservations] = useState<
    Record<string, { playerId: string; playerName: string; reservationId: string }[]>
  >({});
  const [blockedCoachIds, setBlockedCoachIds] = useState<Set<string>>(new Set());
  const [bookingGate, setBookingGate] = useState<{ reason: string } | null>(null);

  const uniqueCoachesForModal = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    let dayRows = coachAvailability.filter(
      (r) => r.day_of_week === dayOfWeek && r.is_active && !blockedCoachIds.has(r.coach_id)
    );
    if (selectedVirtualIndividualTypeId) {
      dayRows = dayRows.filter(
        (r) => r.individual_session_type_id === selectedVirtualIndividualTypeId
      );
    }
    const seen = new Set<string>();
    return dayRows.filter((r) => {
      if (seen.has(r.coach_id)) return false;
      seen.add(r.coach_id);
      return true;
    });
  }, [coachAvailability, selectedDate, selectedVirtualIndividualTypeId, blockedCoachIds]);

  const fetchCoachNames = useCallback(
    async (coachIds: string[]): Promise<Record<string, string>> => {
      const uncached = coachIds.filter(
        (id) => id && !coachNameCacheRef.current[id]
      );
      if (uncached.length === 0) return coachNameCacheRef.current;

      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uncached);

      if (data) {
        data.forEach((p: { id: string; full_name?: string | null }) => {
          coachNameCacheRef.current[p.id] = p.full_name?.trim() || "Coach";
        });
      }

      return coachNameCacheRef.current;
    },
    []
  );

  const fetchVirtualGroupSessions = useCallback(async (date: Date) => {
    setLoadingVirtualGroup(true);
    const supabase = createClient();
    const dateStr = formatDateString(date);
    const { data, error } = await supabase
      .from("sessions")
      .select(
        "id, session_type, session_date, session_time, duration_minutes, location_type, location, zoom_link, coach_id, assistant_coach_ids, gk_coach_id, attendance_limit, status, description"
      )
      .eq("location_type", "virtual")
      .eq("session_date", dateStr)
      .eq("status", "scheduled")
      .order("session_time", { ascending: true });
    if (error) {
      setVirtualGroupSlots([]);
      setLoadingVirtualGroup(false);
      return;
    }
    const sessions = (data ?? []) as Record<string, unknown>[];

    const sessionIds = sessions.map((s) => s.id as string);
    const reservationCountMap: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: countData } = await supabase
        .from("session_reservations")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("reservation_status", "reserved");
      (countData ?? []).forEach((r: { session_id: string }) => {
        reservationCountMap[r.session_id] = (reservationCountMap[r.session_id] || 0) + 1;
      });
    }

    const allIds = new Set<string>();
    sessions.forEach((s) => {
      if (s.coach_id) allIds.add(s.coach_id as string);
      if (s.gk_coach_id) allIds.add(s.gk_coach_id as string);
      if (Array.isArray(s.assistant_coach_ids)) (s.assistant_coach_ids as string[]).forEach((id) => allIds.add(id));
    });
    const names = await fetchCoachNames(Array.from(allIds));
    const now = Date.now();
    const groupSlots: MergedSlot[] = sessions.map((session) => {
      const sessionTime = (session.session_time as string) ?? "";
      const timeSlice = sessionTime.slice(0, 5);
      const [sH, sM] = timeSlice.split(":").map(Number);
      const sessionStart = new Date(date);
      sessionStart.setHours(sH ?? 0, sM ?? 0, 0, 0);
      return {
        id: `group-${session.id as string}`,
        time: timeSlice,
        displayTime: formatTime12Hour(sessionTime),
        label: (session.session_type as string) || "Session",
        labelAbbrev: abbreviateSessionType((session.session_type as string) || "Group"),
        badge: "group" as const,
        coach: (session.coach_id != null ? (names[session.coach_id as string] || coachNames[session.coach_id as string]) : null) || "Coach",
        coachId: (session.coach_id as string) ?? null,
        coachFullName: session.coach_id != null ? coachFullNames[session.coach_id as string] : undefined,
        coachPhotoUrl: session.coach_id != null ? coachProfileDetails?.[session.coach_id as string]?.profilePhotoUrl ?? undefined : undefined,
        location: (session.location as string) ?? "Virtual",
        zoomLink: (session.zoom_link as string) || undefined,
        capacity:
          (session.attendance_limit as number) > 0
            ? `${reservationCountMap[session.id as string] ?? 0}/${session.attendance_limit as number} spots`
            : undefined,
        sessionId: session.id as string,
        bookingDate: dateStr,
        durationMinutes: (session.duration_minutes as number) || undefined,
        isPast: sessionStart.getTime() < now,
        date: formatSlotDate(date),
        description: (session.description as string) ?? undefined,
        badgeColor: sessionTypeColors[(session.session_type as string) || ""] || undefined,
        locationType: "virtual",
        assistantCoachIds: Array.isArray(session.assistant_coach_ids) ? (session.assistant_coach_ids as string[]) : [],
        assistantCoachNames: Array.isArray(session.assistant_coach_ids)
          ? (session.assistant_coach_ids as string[]).map((id) => names[id] || coachNames[id] || "Coach")
          : [],
        assistantCoachFullNames: Array.isArray(session.assistant_coach_ids)
          ? (session.assistant_coach_ids as string[]).map((id) => coachFullNames[id] || names[id] || "Coach")
          : [],
        gkCoachId: (session.gk_coach_id as string) || undefined,
        gkCoachName: session.gk_coach_id ? (names[session.gk_coach_id as string] || coachNames[session.gk_coach_id as string] || "Coach") : undefined,
        gkCoachFullName: session.gk_coach_id ? (coachFullNames[session.gk_coach_id as string] || "Coach") : undefined,
      };
    });
    setVirtualGroupSlots(groupSlots);
    setLoadingVirtualGroup(false);
  }, [coachNames, coachFullNames, sessionTypeColors, coachProfileDetails]);

  const fetchAllCoachesForVirtual = useCallback(async () => {
    const typeIds = [
      ...onFieldIndividualSessionTypes.map((t) => t.id),
      ...virtualIndividualSessionTypes.map((t) => t.id),
    ];
    if (typeIds.length === 0) {
      setCoachAvailability([]);
      return;
    }
    const supabase = createClient();
    let q = supabase
      .from("coach_individual_availability")
      .select("id, coach_id, individual_session_type_id, day_of_week, start_time, end_time, is_active, location")
      .eq("is_active", true);
    if (typeIds.length === 1) {
      q = q.eq("individual_session_type_id", typeIds[0]!);
    } else {
      q = q.in("individual_session_type_id", typeIds);
    }
    const { data, error } = await q;
    if (error) {
      setCoachAvailability([]);
      return;
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    setCoachAvailability(
      rows.map((r) => ({
        id: r.id as string,
        coach_id: r.coach_id as string,
        individual_session_type_id: (r.individual_session_type_id as string) ?? "",
        day_of_week: (r.day_of_week as number) ?? 0,
        start_time: (r.start_time as string) ?? "00:00",
        end_time: (r.end_time as string) ?? "00:00",
        is_active: (r.is_active as boolean) ?? true,
        location: (r.location as string) ?? null,
      }))
    );
  }, [onFieldIndividualSessionTypes, virtualIndividualSessionTypes]);

  const generateTimeSlots = useCallback(
    async (
      date: Date,
      sessionTypeData: PlayerIndividualSessionType,
      availabilityRows: CoachAvailabilityRow[],
      selectedCoachId: string | null,
      currentPlayerId: string
    ): Promise<TimeSlot[]> => {
      const dayOfWeek = date.getDay(); // 0=Sunday matches day_of_week column
      const granularity = sessionTypeData.time_slot_granularity ?? 30;
      const duration = sessionTypeData.duration_minutes ?? 60;

      // Filter rows for this day of week
      let dayRows = availabilityRows.filter((row) => row.day_of_week === dayOfWeek);

      // If a specific coach is selected, filter to just their rows
      if (selectedCoachId) {
        dayRows = dayRows.filter((row) => row.coach_id === selectedCoachId);
      }

      if (dayRows.length === 0) return [];

      // Generate slots for each coach's availability range
      const slotMap = new Map<string, TimeSlot>();

      for (const row of dayRows) {
        const slots = generateSlotsForRange(
          row.start_time.slice(0, 5),
          row.end_time.slice(0, 5),
          granularity,
          duration
        );
        for (const slot of slots) {
          const existing = slotMap.get(slot.time);
          if (existing) {
            if (!existing.coachIds) {
              existing.coachIds = existing.coachId ? [existing.coachId] : [];
            }
            if (!existing.coachIds.includes(row.coach_id)) {
              existing.coachIds.push(row.coach_id);
            }
          } else {
            slotMap.set(slot.time, {
              ...slot,
              coachId: row.coach_id,
              coachIds: [row.coach_id],
              location: row.location || null,
            });
          }
        }
      }

      const slots = Array.from(slotMap.values());

      // Fetch ALL booked times via RPC (SECURITY DEFINER — bypasses RLS so we see every player's bookings)
      const supabase = createClient();
      try {
        const dateStr = formatDateString(date);
        const coachIdsToCheck = selectedCoachId
          ? [selectedCoachId]
          : [...new Set(availabilityRows.map((r) => r.coach_id))];

        const rpcResults = await Promise.all(
          coachIdsToCheck.map(async (cid) => {
            const { data } = await (supabase as any).rpc("get_booked_times_for_coach", {
              p_coach_id: cid,
              p_date: dateStr,
            });
            return ((data ?? []) as { booking_time: string; duration_minutes: number }[]).map(
              (b) => ({ ...b, coach_id: cid })
            );
          })
        );
        const allBookings = rpcResults.flat();

        // Also fetch current player's own bookings (RLS returns only theirs) for bookedByMe flag
        let ownBookingTimes = new Set<string>();
        try {
          const { data: ownData } = await supabase
            .from("individual_session_bookings")
            .select("booking_time, coach_id")
            .eq("player_id", currentPlayerId)
            .eq("booking_date", dateStr)
            .eq("status", "confirmed");
          for (const b of (ownData ?? []) as { booking_time: string; coach_id: string }[]) {
            ownBookingTimes.add(`${b.coach_id}|${b.booking_time}`);
          }
        } catch { /* */ }

        if (allBookings.length > 0) {
          const bufferBefore = sessionTypeData.buffer_before_minutes ?? 0;
          const bufferAfter = sessionTypeData.buffer_after_minutes ?? 0;

          for (const booking of allBookings) {
            const isOwnBooking = ownBookingTimes.has(`${booking.coach_id}|${booking.booking_time}`);
            const bookingDuration = booking.duration_minutes ?? duration;
            const bookingTime = parseTime(booking.booking_time);
            const bookingEnd = new Date(bookingTime.getTime() + bookingDuration * 60000);
            const bookingStartWithBuffer = new Date(bookingTime.getTime() - bufferBefore * 60000);
            const bookingEndWithBuffer = new Date(bookingEnd.getTime() + bufferAfter * 60000);

            for (const slot of slots) {
              const slotTime = parseTime(slot.time);
              const slotEnd = new Date(slotTime.getTime() + duration * 60000);

              if (slotTime < bookingEndWithBuffer && slotEnd > bookingStartWithBuffer) {
                if (isOwnBooking) {
                  if (selectedCoachId || slot.coachId === booking.coach_id) {
                    slot.bookedByMe = true;
                  }
                } else if (selectedCoachId || slot.coachId === booking.coach_id) {
                  slot.booked = true;
                } else if (slot.coachIds) {
                  slot.coachIds = slot.coachIds.filter((id) => id !== booking.coach_id);
                  if (slot.coachIds.length === 0) slot.booked = true;
                  else slot.coachId = slot.coachIds[0];
                }
              }
            }
          }
        }
      } catch {
        // RPC may not exist yet
      }
      // Apply minimum booking notice
      const noticeHours = sessionTypeData.min_booking_notice_hours ?? 8;
      const now = new Date();
      if (isSameDay(date, now)) {
        const minTime = new Date(now.getTime() + noticeHours * 60 * 60000);
        for (const slot of slots) {
          const slotTime = parseTime(slot.time);
          slotTime.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
          if (slotTime < minTime) {
            slot.booked = true;
          }
        }
      }

      // Sort by time and filter out booked
      slots.sort((a, b) => a.time.localeCompare(b.time));
      return slots.filter((s) => !s.booked);
    },
    []
  );

  const fetchVirtualSlots = useCallback(
    async (date: Date, coachId: string | null, selectedTypeId: string | null) => {
      setLoadingVirtual(true);
      const merged: MergedSlot[] = [];

      const supabaseBlocked = createClient();
      const { data: blockedData } = await supabaseBlocked
        .from("coach_date_overrides")
        .select("coach_id")
        .eq("override_date", formatDateString(date))
        .eq("is_blocked", true);
      const blocked = new Set((blockedData || []).map((d: { coach_id: string }) => d.coach_id));
      setBlockedCoachIds(blocked);

      const typesToProcess = selectedTypeId
        ? virtualIndividualSessionTypes.filter((t) => t.id === selectedTypeId)
        : virtualIndividualSessionTypes;

      for (const typeData of typesToProcess) {
        const coachesForType = coachAvailability
          .filter((c) => c.individual_session_type_id === typeData.id)
          .filter((c) => !blocked.has(c.coach_id));
        if (coachesForType.length === 0) continue;
        const slots = await generateTimeSlots(date, typeData, coachesForType, coachId, playerId);
        for (const s of slots) {
          if (s.booked && !s.bookedByMe) continue;
          const cid = s.coachId ?? s.coachIds?.[0];
          const coachName =
            cid != null
              ? (coachNames[cid] || coachNameCacheRef.current[cid] || "Coach")
              : "Any available";
          merged.push({
            id: `ind-${typeData.id}-${s.time}-${cid ?? "any"}`,
            time: s.time,
            displayTime: s.displayTime,
            label: typeData.name,
            labelAbbrev: abbreviateSessionType(typeData.name),
            badge: "1-on-1",
            coach: coachName,
            coachId: cid ?? null,
            coachFullName: cid != null ? coachFullNames[cid] : undefined,
            coachPhotoUrl: cid != null ? coachProfileDetails?.[cid]?.profilePhotoUrl ?? undefined : undefined,
            location: s.location || typeData.location || "Virtual",
            zoomLink: typeData.zoom_link || undefined,
            sessionTypeId: typeData.id,
            bookingDate: formatDateString(date),
            bookingTime: s.time.length === 5 ? s.time + ":00" : s.time,
            durationMinutes: typeData.duration_minutes,
            booked: s.booked,
            isPast: (() => {
              const [h, m] = s.time.split(":").map(Number);
              const slotDt = new Date(date);
              slotDt.setHours(h ?? 0, m ?? 0, 0, 0);
              return slotDt.getTime() < Date.now();
            })(),
            date: formatSlotDate(date),
            description: typeData.description ?? undefined,
            badgeColor: typeData.color || undefined,
            locationType: (typeData.location_type as "on-field" | "virtual") || undefined,
          });
        }
      }

      merged.sort((a, b) => {
        const [ah, am] = a.time.split(":").map(Number);
        const [bh, bm] = b.time.split(":").map(Number);
        return (ah ?? 0) * 60 + (am ?? 0) - (bh ?? 0) * 60 - (bm ?? 0);
      });
      setVirtualSlots(merged);
      setLoadingVirtual(false);
    },
    [virtualIndividualSessionTypes, coachAvailability, coachNames, coachProfileDetails, generateTimeSlots]
  );

  const fetchOnFieldSlots = useCallback(
    async (date: Date) => {
      setLoadingOnField(true);
      const supabase = createClient();
      const dateStr = formatDateString(date);
      const merged: MergedSlot[] = [];

      const { data: blockedData } = await supabase
        .from("coach_date_overrides")
        .select("coach_id")
        .eq("override_date", dateStr)
        .eq("is_blocked", true);
      const blocked = new Set((blockedData || []).map((d: { coach_id: string }) => d.coach_id));
      setBlockedCoachIds(blocked);

      const { data: groupData, error } = await supabase
        .from("sessions")
        .select(
          "id, session_type, session_date, session_time, duration_minutes, location_type, location, zoom_link, coach_id, assistant_coach_ids, gk_coach_id, attendance_limit, status, description"
        )
        .eq("location_type", "on-field")
        .eq("session_date", dateStr)
        .eq("status", "scheduled")
        .order("session_time", { ascending: true });
      if (!error && groupData) {
        const sessions = groupData as Record<string, unknown>[];

        const onFieldSessionIds = sessions.map((s) => s.id as string);
        const onFieldCountMap: Record<string, number> = {};
        if (onFieldSessionIds.length > 0) {
          const { data: countData } = await supabase
            .from("session_reservations")
            .select("session_id")
            .in("session_id", onFieldSessionIds)
            .eq("reservation_status", "reserved");
          (countData ?? []).forEach((r: { session_id: string }) => {
            onFieldCountMap[r.session_id] = (onFieldCountMap[r.session_id] || 0) + 1;
          });
        }

        const allIds = new Set<string>();
        sessions.forEach((s) => {
          if (s.coach_id) allIds.add(s.coach_id as string);
          if (s.gk_coach_id) allIds.add(s.gk_coach_id as string);
          if (Array.isArray(s.assistant_coach_ids)) (s.assistant_coach_ids as string[]).forEach((id) => allIds.add(id));
        });
        const names = await fetchCoachNames(Array.from(allIds));
        const formattedDate = formatSlotDate(date);
        const now = Date.now();
        for (const session of sessions) {
          const sessionTime = (session.session_time as string)?.slice(0, 5) ?? "00:00";
          const coachIdVal = session.coach_id as string | null;
          const [sH, sM] = sessionTime.split(":").map(Number);
          const sessionStart = new Date(date);
          sessionStart.setHours(sH ?? 0, sM ?? 0, 0, 0);
          merged.push({
            id: "group-" + (session.id as string),
            time: sessionTime,
            displayTime: formatTime12Hour((session.session_time as string) ?? "00:00"),
            label: (session.session_type as string) || "Session",
            labelAbbrev: abbreviateSessionType((session.session_type as string) || "Group"),
            badge: "group",
            coach: coachIdVal != null ? (names[coachIdVal] || coachNames[coachIdVal] || "Coach") : "Coach",
            coachId: coachIdVal,
            coachFullName: coachIdVal != null ? coachFullNames[coachIdVal] : undefined,
            coachPhotoUrl: coachIdVal != null ? coachProfileDetails?.[coachIdVal]?.profilePhotoUrl ?? undefined : undefined,
            location: (session.location as string) ?? null,
            capacity:
              (session.attendance_limit as number) > 0
                ? `${onFieldCountMap[session.id as string] ?? 0}/${session.attendance_limit as number} spots`
                : undefined,
            sessionId: session.id as string,
            bookingDate: dateStr,
            durationMinutes: (session.duration_minutes as number) || undefined,
            isPast: sessionStart.getTime() < now,
            date: formattedDate,
            description: (session.description as string) ?? undefined,
            badgeColor: sessionTypeColors[(session.session_type as string) || ""] || undefined,
            locationType: "on-field",
            assistantCoachIds: Array.isArray(session.assistant_coach_ids) ? (session.assistant_coach_ids as string[]) : [],
            assistantCoachNames: Array.isArray(session.assistant_coach_ids)
              ? (session.assistant_coach_ids as string[]).map((id) => names[id] || coachNames[id] || "Coach")
              : [],
            assistantCoachFullNames: Array.isArray(session.assistant_coach_ids)
              ? (session.assistant_coach_ids as string[]).map((id) => coachFullNames[id] || names[id] || "Coach")
              : [],
            gkCoachId: (session.gk_coach_id as string) || undefined,
            gkCoachName: session.gk_coach_id ? (names[session.gk_coach_id as string] || coachNames[session.gk_coach_id as string] || "Coach") : undefined,
            gkCoachFullName: session.gk_coach_id ? (coachFullNames[session.gk_coach_id as string] || "Coach") : undefined,
          });
        }
      }

      for (const typeData of onFieldIndividualSessionTypes) {
        const coachesForType = coachAvailability
          .filter((c) => c.individual_session_type_id === typeData.id)
          .filter((c) => !blocked.has(c.coach_id));
        if (coachesForType.length === 0) continue;
        const slots = await generateTimeSlots(date, typeData, coachesForType, null, playerId);
        for (const s of slots) {
          if (s.booked && !s.bookedByMe) continue;
          const cid = s.coachId ?? s.coachIds?.[0];
          merged.push({
            id: `ind-onfield-${typeData.id}-${s.time}-${cid ?? "any"}`,
            time: s.time,
            displayTime: s.displayTime,
            label: typeData.name,
            labelAbbrev: abbreviateSessionType(typeData.name),
            badge: "1-on-1",
            coach: cid != null ? (coachNames[cid] || coachNameCacheRef.current[cid] || "Coach") : "Any available",
            coachId: cid ?? null,
            coachFullName: cid != null ? coachFullNames[cid] : undefined,
            coachPhotoUrl: cid != null ? coachProfileDetails?.[cid]?.profilePhotoUrl ?? undefined : undefined,
            location: s.location || typeData.location || "On-field",
            sessionTypeId: typeData.id,
            bookingDate: formatDateString(date),
            bookingTime: s.time.length === 5 ? s.time + ":00" : s.time,
            durationMinutes: typeData.duration_minutes,
            booked: s.booked,
            isPast: (() => {
              const [h, m] = s.time.split(":").map(Number);
              const slotDt = new Date(date);
              slotDt.setHours(h ?? 0, m ?? 0, 0, 0);
              return slotDt.getTime() < Date.now();
            })(),
            date: formatSlotDate(date),
            description: typeData.description ?? undefined,
            badgeColor: typeData.color || undefined,
            locationType: (typeData.location_type as "on-field" | "virtual") || undefined,
          });
        }
      }

      merged.sort((a, b) => {
        const [ah, am] = a.time.split(":").map(Number);
        const [bh, bm] = b.time.split(":").map(Number);
        return (ah ?? 0) * 60 + (am ?? 0) - (bh ?? 0) * 60 - (bm ?? 0);
      });
      setOnFieldSlots(merged);
      setLoadingOnField(false);
    },
    [onFieldIndividualSessionTypes, coachAvailability, coachNames, coachProfileDetails, generateTimeSlots, sessionTypeColors]
  );

  useEffect(() => {
    if (onFieldOpen || virtualOpen) fetchAllCoachesForVirtual();
  }, [onFieldOpen, virtualOpen, fetchAllCoachesForVirtual]);

  useEffect(() => {
    if (!onFieldOpen) return;
    setOnFieldSlotsVisible(4);
    fetchOnFieldSlots(selectedDate);
  }, [onFieldOpen, selectedDate, coachAvailability, fetchOnFieldSlots, refreshKey]);

  useEffect(() => {
    if (virtualIndividualSessionTypes.length === 1) {
      setSelectedVirtualIndividualTypeId(virtualIndividualSessionTypes[0].id);
    } else if (virtualIndividualSessionTypes.length > 1 && !selectedVirtualIndividualTypeId) {
      setSelectedVirtualIndividualTypeId(virtualIndividualSessionTypes[0].id);
    }
  }, [virtualIndividualSessionTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!virtualOpen || virtualTab !== "group") return;
    setVirtualSlotsVisible(4);
    fetchVirtualGroupSessions(selectedDate);
  }, [virtualOpen, virtualTab, selectedDate, fetchVirtualGroupSessions, refreshKey]);

  useEffect(() => {
    if (!virtualOpen || virtualTab !== "individual") return;
    setVirtualSlotsVisible(4);
    fetchVirtualSlots(selectedDate, selectedCoachId, selectedVirtualIndividualTypeId);
  }, [virtualOpen, virtualTab, selectedDate, selectedCoachId, selectedVirtualIndividualTypeId, coachAvailability, fetchVirtualSlots, refreshKey]);

  useEffect(() => {
    if (!playerId) return;
    const playerIdsToCheck = linkedIdsKey
      ? linkedIdsKey.split(",")
      : [playerId];

    async function fetchMyBookings() {
      const supabase = createClient();
      const [{ data: groupRes }, { data: indRes }] = await Promise.all([
        supabase
          .from("session_reservations")
          .select("id, session_id, player_id")
          .in("player_id", playerIdsToCheck)
          .eq("reservation_status", "reserved"),
        supabase
          .from("individual_session_bookings")
          .select("booking_date, booking_time, coach_id")
          .in("player_id", playerIdsToCheck)
          .in("status", ["confirmed", "pending"]),
      ]);
      setMyGroupReservations(
        new Set((groupRes ?? []).map((r: { session_id: string }) => r.session_id))
      );
      setMyIndividualBookings(
        new Set(
          (indRes ?? []).map(
            (b: { booking_date: string; booking_time: string; coach_id: string }) =>
              `${b.booking_date}-${b.booking_time}-${b.coach_id}`
          )
        )
      );

      if (allLinkedPlayers && allLinkedPlayers.length > 0 && groupRes) {
        const map: Record<string, { playerId: string; playerName: string; reservationId: string }[]> = {};
        (groupRes as { id: string; session_id: string; player_id: string }[]).forEach((r) => {
          const player = allLinkedPlayers.find((p) => p.id === r.player_id);
          const name = player
            ? [player.first_name, player.last_name].filter(Boolean).join(" ") || "Player"
            : "Player";
          if (!map[r.session_id]) map[r.session_id] = [];
          map[r.session_id].push({ playerId: r.player_id, playerName: name, reservationId: r.id });
        });
        setSessionPlayerReservations(map);
      } else {
        setSessionPlayerReservations({});
      }
    }
    fetchMyBookings();
  }, [playerId, linkedIdsKey, refreshKey, allLinkedPlayers]);

  const isSlotReserved = useCallback(
    (slot: MergedSlot): boolean => {
      if (slot.badge === "group" && slot.sessionId) {
        return myGroupReservations.has(slot.sessionId);
      }
      if (slot.badge !== "group" && slot.bookingDate && slot.bookingTime && slot.coachId) {
        const key = `${slot.bookingDate}-${slot.bookingTime}-${slot.coachId}`;
        return myIndividualBookings.has(key);
      }
      return false;
    },
    [myGroupReservations, myIndividualBookings]
  );

  const goToPrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  }, []);

  const thisWeekSunday = getSundayOfWeek(today);
  const maxWeekSunday = new Date(thisWeekSunday);
  maxWeekSunday.setDate(maxWeekSunday.getDate() + 28);
  const isPrevDisabled = isSameDay(weekStart, thisWeekSunday);
  const isNextDisabled = weekStart.getTime() >= maxWeekSunday.getTime();

  const selectDay = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedSlotId(null);
    setBookingSlotId(null);
    setBookingStatus("idle");
    setBookingError(null);
  }, []);

  const isVirtualSlotLocked = useCallback(
    (slot: MergedSlot): boolean => {
      if (slot.locationType !== "virtual" || !planAccess.hasPlan || !planAccess.virtualAccess) return false;
      const sessionKey = mapSessionTypeNameToKey(slot.label || "");
      if (!sessionKey) return false;
      const allowance = planAccess.sessionAllowances?.virtual?.[sessionKey] ?? 0;
      const used = planAccess.sessionUsage?.virtual?.[sessionKey] ?? 0;
      return allowance === 0 || (allowance !== -1 && used >= allowance);
    },
    [planAccess]
  );

  const getVirtualSlotLockReason = useCallback(
    (slot: MergedSlot): string => {
      const sessionKey = mapSessionTypeNameToKey(slot.label || "");
      if (!sessionKey) return "";
      const allowance = planAccess.sessionAllowances?.virtual?.[sessionKey] ?? 0;
      const used = planAccess.sessionUsage?.virtual?.[sessionKey] ?? 0;
      if (allowance === 0) return "Not included in your plan";
      return "Limit reached";
    },
    [planAccess]
  );

  const hasAllowanceForSlot = useCallback(
    (slot: MergedSlot): boolean => {
      const sa = planAccess.sessionAllowances;
      if (!sa || !planAccess.hasPlan) return false;
      const label = (slot.label || slot.labelAbbrev || "").trim();
      const key = SESSION_LABEL_TO_KEY[label] || label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      if (!key) return true;
      const bucket = slot.locationType === "virtual" ? sa.virtual : sa.onfield;
      const bucketMap = typeof bucket === "object" && bucket !== null ? bucket : {};
      const allowance = bucketMap[key];
      return allowance === -1 || (typeof allowance === "number" && allowance > 0);
    },
    [planAccess]
  );

  const handleConfirmBooking = useCallback(
    async (slot: MergedSlot, excludePlayerIds?: string[]) => {
      if (bookingStatus === "loading") return;

      const sessionLabel = (slot.label || slot.labelAbbrev || "this session type").trim();
      if (planAccess.hasPlan && (slot.locationType === "virtual" && isVirtualSlotLocked(slot))) {
        setBookingGate({ reason: `Your plan limit for ${sessionLabel} sessions has been reached.` });
        return;
      }
      if (planAccess.hasPlan && !hasAllowanceForSlot(slot)) {
        setBookingGate({
          reason: `Your plan doesn't include ${sessionLabel} sessions`,
        });
        return;
      }
      if (!planAccess.hasPlan && (slot.locationType === "virtual" || slot.locationType === "on-field")) {
        setBookingGate({
          reason: `You need an active plan to book ${sessionLabel} sessions`,
        });
        return;
      }

      if (onBeforeBook) {
        const result = await onBeforeBook(slot, excludePlayerIds);
        if (result.cancel) return;

        setBookingSlotId(slot.id);
        setBookingStatus("loading");
        setBookingError(null);

        let successCount = 0;
        let lastError: string | null = null;

        for (const pid of result.playerIds) {
          try {
            if (slot.badge === "group") {
              const res = await reserveGroupSession(slot.sessionId!, pid);
              if (!res.success) {
                lastError = res.error || "Booking failed";
                continue;
              }
              successCount++;
            } else {
              const bookingTime = slot.bookingTime || (slot.time.length === 5 ? slot.time + ":00" : slot.time);
              const bookingDate = slot.bookingDate || formatDateString(selectedDate);
              const res = await bookIndividualSessionForPlayer(
                slot.sessionTypeId!,
                slot.coachId!,
                pid,
                parentId,
                bookingDate,
                bookingTime,
                slot.durationMinutes || 60
              );
              if (!res.success) {
                lastError = res.error || "Booking failed";
                continue;
              }
              successCount++;
            }
          } catch {
            lastError = "Something went wrong. Please try again.";
          }
        }

        if (successCount > 0) {
          setBookingStatus("success");
          showToast(`Reserved for ${successCount} player${successCount > 1 ? "s" : ""}`, "success");
        } else {
          setBookingStatus("error");
          setBookingError(lastError || "Booking failed");
        }

        setTimeout(() => {
          setBookingStatus("idle");
          setBookingSlotId(null);
          setSelectedSlotId(null);
          setDetailSlot(null);
          setRefreshKey((k) => k + 1);
        }, 2000);
        return;
      }

      setBookingSlotId(slot.id);
      setBookingStatus("loading");
      setBookingError(null);

      try {
        if (slot.badge === "group") {
          const result = await reserveGroupSession(slot.sessionId!, playerId);
          if (!result.success) {
            setBookingStatus("error");
            setBookingError(result.error);
            return;
          }
        } else {
          const bookingTime = slot.bookingTime || (slot.time.length === 5 ? slot.time + ":00" : slot.time);
          const bookingDate = slot.bookingDate || formatDateString(selectedDate);
          const result = await bookIndividualSessionForPlayer(
            slot.sessionTypeId!,
            slot.coachId!,
            playerId,
            parentId,
            bookingDate,
            bookingTime,
            slot.durationMinutes || 60
          );
          if (!result.success) {
            setBookingStatus("error");
            setBookingError(result.error);
            return;
          }
        }

        setBookingStatus("success");

        setTimeout(() => {
          setBookingStatus("idle");
          setBookingSlotId(null);
          setSelectedSlotId(null);
          setDetailSlot(null);
          setRefreshKey((k) => k + 1);
        }, 2000);
      } catch {
        setBookingStatus("error");
        setBookingError("Something went wrong. Please try again.");
      }
    },
    [bookingStatus, playerId, parentId, selectedDate, onBeforeBook, planAccess, hasAllowanceForSlot, isVirtualSlotLocked]
  );

  const handleCancelBooking = useCallback(
    async (slot: MergedSlot) => {
      if (cancellingSlotId) return;
      setCancellingSlotId(slot.id);

      try {
        if (slot.badge === "group" && slot.sessionId) {
          const reservedPlayers = sessionPlayerReservations[slot.sessionId] || [];

          if (onBeforeCancel && reservedPlayers.length > 0) {
            const result = await onBeforeCancel(slot, reservedPlayers);
            if (result.cancel) {
              setCancellingSlotId(null);
              return;
            }

            let cancelError: string | null = null;
            for (const pid of result.playerIds) {
              const playerRes = reservedPlayers.find((r) => r.playerId === pid);
              if (playerRes) {
                const res = await cancelReservation(playerRes.reservationId, false, true);
                if (!res.success) {
                  cancelError = res.error || "Cancel failed";
                }
              }
            }

            if (cancelError) {
              showToast(cancelError, "error");
            }

            setRefreshKey((k) => k + 1);
            setCancellingSlotId(null);
            setDetailSlot(null);
            setSelectedSlotId(null);
            return;
          }

          const supabaseLookup = createClient();
          const { data: resRow } = await supabaseLookup
            .from("session_reservations")
            .select("id")
            .eq("session_id", slot.sessionId)
            .eq("player_id", playerId)
            .eq("reservation_status", "reserved")
            .maybeSingle() as { data: { id: string } | null };

          if (!resRow) {
            showToast("Reservation not found", "error");
            setCancellingSlotId(null);
            return;
          }

          const result = await cancelReservation(resRow.id, false, true);
          if (!result.success) {
            showToast(result.error || "Failed to cancel reservation.", "error");
            setCancellingSlotId(null);
            return;
          }
        } else {
          const supabase = createClient();
          const bookingTime =
            slot.bookingTime || (slot.time.length === 5 ? slot.time + ":00" : slot.time);
          const { error } = await supabase
            .from("individual_session_bookings")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
            .eq("player_id", playerId)
            .eq("coach_id", slot.coachId!)
            .eq("booking_date", slot.bookingDate!)
            .eq("booking_time", bookingTime)
            .eq("status", "confirmed");

          if (error) {
            showToast(error.message, "error");
            setCancellingSlotId(null);
            return;
          }
        }

        setRefreshKey((k) => k + 1);
        setCancellingSlotId(null);
        setDetailSlot(null);
      } catch {
        showToast("Failed to cancel. Please try again.", "error");
        setCancellingSlotId(null);
      }
    },
    [cancellingSlotId, playerId, onBeforeCancel, sessionPlayerReservations]
  );

  return (
    <div>
      {/* ON-FIELD ACCORDION */}
      <div className={styles.section}>
        <div
          className={styles.sectionToggle}
          onClick={() => {
            setOnFieldOpen(!onFieldOpen);
            if (!onFieldOpen) setVirtualOpen(false);
          }}
        >
          <span className={styles.sectionTitle}>On-Field</span>
          <span
            className={`${styles.sectionChevron} ${onFieldOpen ? styles.sectionChevronOpen : ""}`}
          >
            ▾
          </span>
          {onFieldProgramLogoUrl && (
            <img
              src={onFieldProgramLogoUrl}
              alt="Program logo"
              className={styles.sectionLogo}
            />
          )}
        </div>

        {onFieldOpen && (
          <div className={styles.sectionContent}>
            <div className={styles.scheduleLayout}>
              <div className={styles.calendarPanel}>
                <p className={styles.calendarMonthLabel}>
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <CalendarStrip
                  weekStart={weekStart}
                  selectedDate={selectedDate}
                  onPrevWeek={goToPrevWeek}
                  onNextWeek={goToNextWeek}
                  onSelectDay={selectDay}
                  isPrevDisabled={isPrevDisabled}
                  isNextDisabled={isNextDisabled}
                />
                <p className={styles.selectedDateLabel}>
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className={styles.slotsPanel}>
                {loadingOnField ? (
                  <SlotSkeleton />
                ) : onFieldSlots.length === 0 ? (
                  <p className={styles.emptyState}>
                    No sessions scheduled for this day. Check Virtual for available options.
                  </p>
                ) : (
                  (() => {
                    const sorted = [...onFieldSlots].sort((a, b) => {
                      const aRes = isSlotReserved(a) ? 0 : 1;
                      const bRes = isSlotReserved(b) ? 0 : 1;
                      if (aRes !== bRes) return aRes - bRes;
                      if (a.isPast && !b.isPast) return 1;
                      if (!a.isPast && b.isPast) return -1;
                      if (a.badge === "group" && b.badge !== "group") return -1;
                      if (a.badge !== "group" && b.badge === "group") return 1;
                      return a.time.localeCompare(b.time);
                    });
                    const visible = sorted.slice(0, onFieldSlotsVisible);
                    return (
                      <>
                        {visible.map((slot) => {
                          const reserved = isSlotReserved(slot);
                          const slotReservations = slot.sessionId ? sessionPlayerReservations[slot.sessionId] || [] : [];
                          const reservedForSlot = slotReservations.map((r) => ({ playerName: r.playerName }));
                          const someLinkedReserved = slotReservations.length > 0;
                          const allLinkedReserved = !!allLinkedPlayers && slotReservations.length >= allLinkedPlayers.length;
                          return (
                          <div key={slot.id}>
                            <div className={styles.slotRow}>
                              <SlotCard
                                time={slot.displayTime}
                                badge={slot.badge}
                                labelAbbrev={slot.labelAbbrev}
                                badgeColor={slot.badgeColor}
                                locationType={slot.locationType}
                                coach={slot.coach}
                                coachFullName={slot.coachFullName}
                                coachPhotoUrl={slot.coachPhotoUrl}
                                isSelected={selectedSlotId === slot.id}
                                isBooked={slot.booked}
                                isPast={slot.isPast}
                                isReserved={reserved}
                                onSelect={() => setSelectedSlotId(slot.id)}
                                onDetails={() => setDetailSlot(slot)}
                                reservedPlayers={allLinkedPlayers ? reservedForSlot : undefined}
                                someReserved={!!allLinkedPlayers && someLinkedReserved}
                                allReserved={allLinkedReserved}
                                onAddPlayer={
                                  someLinkedReserved && !allLinkedReserved && onBeforeBook
                                    ? () => handleConfirmBooking(slot, slotReservations.map((r) => r.playerId))
                                    : undefined
                                }
                              />
                              {selectedSlotId === slot.id && !slot.booked && !slot.isPast && !reserved && (
                                <button
                                  type="button"
                                  className={`${styles.slotConfirmBtn} ${
                                    bookingSlotId === slot.id && bookingStatus === "success" ? styles.confirmBtnSuccess : ""
                                  } ${
                                    bookingSlotId === slot.id && bookingStatus === "error" ? styles.confirmBtnError : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmBooking(slot);
                                  }}
                                  disabled={bookingStatus === "loading" && bookingSlotId === slot.id}
                                >
                                  {bookingSlotId === slot.id && bookingStatus === "loading" ? (
                                    <span className={styles.confirmSpinner} />
                                  ) : bookingSlotId === slot.id && bookingStatus === "success" ? (
                                    "✓ Booked!"
                                  ) : bookingSlotId === slot.id && bookingStatus === "error" ? (
                                    "Failed"
                                  ) : (
                                    "Confirm"
                                  )}
                                </button>
                              )}
                            </div>
                            {bookingSlotId === slot.id && bookingStatus === "error" && bookingError && (
                              <div className={styles.bookingErrorMsg}>{bookingError}</div>
                            )}
                          </div>
                          );
                        })}
                        {sorted.length > onFieldSlotsVisible && (
                          <button
                            type="button"
                            className={styles.showMoreBtn}
                            onClick={() => setOnFieldSlotsVisible((v) => v + 4)}
                          >
                            Show {Math.min(4, sorted.length - onFieldSlotsVisible)} more sessions
                          </button>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIRTUAL ACCORDION */}
      <div className={styles.section}>
        <div
          className={styles.sectionToggle}
          onClick={() => {
            setVirtualOpen(!virtualOpen);
            if (!virtualOpen) setOnFieldOpen(false);
          }}
        >
          <span className={styles.sectionTitle}>Virtual</span>
          <span
            className={`${styles.sectionChevron} ${virtualOpen ? styles.sectionChevronOpen : ""}`}
          >
            ▾
          </span>
          <div className={styles.sectionLogo}>
            <img src="/logo-light.png" alt="Homegrown" className={styles.sectionLogoLight} />
            <img src="/logo-dark.png" alt="Homegrown" className={styles.sectionLogoDark} />
          </div>
        </div>

        {virtualOpen && (
          <PlanGate locked={virtualLocked} reason={virtualReason} planName={planAccess.planName} hasPlan={planAccess.hasPlan}>
          <div className={styles.sectionContent}>
            <div className={styles.tabPills}>
              <button
                type="button"
                className={`${styles.tabPill} ${virtualTab === "group" ? styles.tabPillActive : ""}`}
                onClick={() => setVirtualTab("group")}
              >
                Group
              </button>
              <button
                type="button"
                className={`${styles.tabPill} ${virtualTab === "individual" ? styles.tabPillActive : ""}`}
                onClick={() => setVirtualTab("individual")}
              >
                1-on-1
              </button>
            </div>

            {virtualTab === "individual" && (
              <div className={styles.staffSection}>
                {virtualIndividualSessionTypes.length > 1 && (
                  <div className={styles.sessionTypeFilters}>
                    {virtualIndividualSessionTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        className={`${styles.sessionTypeFilterBtn} ${selectedVirtualIndividualTypeId === type.id ? styles.sessionTypeFilterBtnActive : ""}`}
                        onClick={() => setSelectedVirtualIndividualTypeId(type.id)}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                )}
                <p className={styles.staffLabel}>Choose staff.</p>
                <div
                  className={styles.staffDropdown}
                  onClick={() => setShowCoachModal(true)}
                >
                  <div className={styles.staffDropdownInner}>
                    <div className={styles.slotCoachAvatar}>
                      {selectedCoachId && coachProfileDetails?.[selectedCoachId]?.profilePhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coachProfileDetails[selectedCoachId].profilePhotoUrl!} alt="" className={styles.slotCoachAvatarImg} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : null}
                      <span className={styles.slotCoachInitials}>
                        {selectedCoachId && coachNames[selectedCoachId]
                          ? getInitials((coachFullNames[selectedCoachId] || coachNames[selectedCoachId] || "").replace(/^Coach\s+/i, ""))
                          : "?"}
                      </span>
                    </div>
                    <span>
                      {selectedCoachId != null
                        ? (coachNames[selectedCoachId] || "Coach")
                        : "Any available"}
                    </span>
                  </div>
                  <span className={styles.staffDropdownChevron}>▾</span>
                </div>
              </div>
            )}

            <div className={styles.scheduleLayout}>
              <div className={styles.calendarPanel}>
                <p className={styles.calendarMonthLabel}>
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <CalendarStrip
                  weekStart={weekStart}
                  selectedDate={selectedDate}
                  onPrevWeek={goToPrevWeek}
                  onNextWeek={goToNextWeek}
                  onSelectDay={selectDay}
                  isPrevDisabled={isPrevDisabled}
                  isNextDisabled={isNextDisabled}
                />
                <p className={styles.selectedDateLabel}>
                  {selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className={styles.slotsPanel}>
                {virtualTab === "group" ? (
                  loadingVirtualGroup ? (
                    <SlotSkeleton />
                  ) : virtualGroupSlots.length === 0 ? (
                    <p className={styles.emptyState}>
                      No group sessions this day. Try 1-on-1.
                    </p>
                  ) : (
                    (() => {
                      const sorted = [...virtualGroupSlots].sort((a, b) => {
                        const aRes = isSlotReserved(a) ? 0 : 1;
                        const bRes = isSlotReserved(b) ? 0 : 1;
                        if (aRes !== bRes) return aRes - bRes;
                        if (a.isPast && !b.isPast) return 1;
                        if (!a.isPast && b.isPast) return -1;
                        return a.time.localeCompare(b.time);
                      });
                      const visible = sorted.slice(0, virtualSlotsVisible);
                      return (
                        <>
                          {visible.map((slot) => {
                            const reserved = isSlotReserved(slot);
                            const slotReservations = slot.sessionId ? sessionPlayerReservations[slot.sessionId] || [] : [];
                            const reservedForSlot = slotReservations.map((r) => ({ playerName: r.playerName }));
                            const someLinkedReserved = slotReservations.length > 0;
                            const allLinkedReserved = !!allLinkedPlayers && slotReservations.length >= allLinkedPlayers.length;
                            const vLocked = isVirtualSlotLocked(slot);
                            return (
                            <div key={slot.id}>
                              <div className={styles.slotRow}>
                                <SlotCard
                                  time={slot.displayTime}
                                  badge="group"
                                  labelAbbrev={slot.labelAbbrev}
                                  badgeColor={slot.badgeColor}
                                  locationType={slot.locationType}
                                  coach={slot.coach}
                                  coachFullName={slot.coachFullName}
                                  coachPhotoUrl={slot.coachPhotoUrl}
                                  isSelected={selectedSlotId === slot.id}
                                  isBooked={false}
                                  isPast={slot.isPast}
                                  isReserved={reserved}
                                  onSelect={() => setSelectedSlotId(slot.id)}
                                  onDetails={() => setDetailSlot(slot)}
                                  reservedPlayers={allLinkedPlayers ? reservedForSlot : undefined}
                                  someReserved={!!allLinkedPlayers && someLinkedReserved}
                                  allReserved={allLinkedReserved}
                                  onAddPlayer={
                                    someLinkedReserved && !allLinkedReserved && onBeforeBook
                                      ? () => handleConfirmBooking(slot, slotReservations.map((r) => r.playerId))
                                      : undefined
                                  }
                                />
                                {vLocked && (
                                  <div className={styles.virtualSlotLock}>
                                    <Lock size={12} />
                                    <span>{getVirtualSlotLockReason(slot)}</span>
                                  </div>
                                )}
                                {selectedSlotId === slot.id && !slot.isPast && !reserved && !vLocked && (
                                  <button
                                    type="button"
                                    className={`${styles.slotConfirmBtn} ${
                                      bookingSlotId === slot.id && bookingStatus === "success" ? styles.confirmBtnSuccess : ""
                                    } ${
                                      bookingSlotId === slot.id && bookingStatus === "error" ? styles.confirmBtnError : ""
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConfirmBooking(slot);
                                    }}
                                    disabled={bookingStatus === "loading" && bookingSlotId === slot.id}
                                  >
                                    {bookingSlotId === slot.id && bookingStatus === "loading" ? (
                                      <span className={styles.confirmSpinner} />
                                    ) : bookingSlotId === slot.id && bookingStatus === "success" ? (
                                      "✓ Booked!"
                                    ) : bookingSlotId === slot.id && bookingStatus === "error" ? (
                                      "Failed"
                                    ) : (
                                      "Confirm"
                                    )}
                                  </button>
                                )}
                              </div>
                              {bookingSlotId === slot.id && bookingStatus === "error" && bookingError && (
                                <div className={styles.bookingErrorMsg}>{bookingError}</div>
                              )}
                            </div>
                            );
                          })}
                          {virtualGroupSlots.length > virtualSlotsVisible && (
                            <button
                              type="button"
                              className={styles.showMoreBtn}
                              onClick={() => setVirtualSlotsVisible((v) => v + 4)}
                            >
                              Show {Math.min(4, virtualGroupSlots.length - virtualSlotsVisible)} more sessions
                            </button>
                          )}
                        </>
                      );
                    })()
                  )
                ) : (
                  loadingVirtual ? (
                    <SlotSkeleton />
                  ) : virtualSlots.length === 0 ? (
                    <p className={styles.emptyState}>
                      No 1-on-1 slots this day. Select a coach or try Group.
                    </p>
                  ) : (
                    (() => {
                      const sorted = [...virtualSlots].sort((a, b) => {
                        const aRes = isSlotReserved(a) ? 0 : 1;
                        const bRes = isSlotReserved(b) ? 0 : 1;
                        if (aRes !== bRes) return aRes - bRes;
                        if (a.isPast && !b.isPast) return 1;
                        if (!a.isPast && b.isPast) return -1;
                        return a.time.localeCompare(b.time);
                      });
                      const visible = sorted.slice(0, virtualSlotsVisible);
                      return (
                        <>
                          {visible.map((slot) => {
                            const reserved = isSlotReserved(slot);
                            const vLocked = isVirtualSlotLocked(slot);
                            return (
                            <div key={slot.id}>
                              <div className={styles.slotRow}>
                                <SlotCard
                                  time={slot.displayTime}
                                  badge={slot.badge}
                                  labelAbbrev={slot.labelAbbrev}
                                  badgeColor={slot.badgeColor}
                                  locationType={slot.locationType}
                                  coach={slot.coach}
                                  coachFullName={slot.coachFullName}
                                  coachPhotoUrl={slot.coachPhotoUrl}
                                  isSelected={selectedSlotId === slot.id}
                                  isBooked={slot.booked}
                                  isPast={slot.isPast}
                                  isReserved={reserved}
                                  onSelect={() => {
                                    if (slot.booked || slot.isPast || reserved) return;
                                    setSelectedSlotId(slot.id);
                                  }}
                                  onDetails={() => setDetailSlot(slot)}
                                />
                                {vLocked && (
                                  <div className={styles.virtualSlotLock}>
                                    <Lock size={12} />
                                    <span>{getVirtualSlotLockReason(slot)}</span>
                                  </div>
                                )}
                                {selectedSlotId === slot.id && !slot.booked && !slot.isPast && !reserved && !vLocked && (
                                  <button
                                    type="button"
                                    className={`${styles.slotConfirmBtn} ${
                                      bookingSlotId === slot.id && bookingStatus === "success" ? styles.confirmBtnSuccess : ""
                                    } ${
                                      bookingSlotId === slot.id && bookingStatus === "error" ? styles.confirmBtnError : ""
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConfirmBooking(slot);
                                    }}
                                    disabled={bookingStatus === "loading" && bookingSlotId === slot.id}
                                  >
                                    {bookingSlotId === slot.id && bookingStatus === "loading" ? (
                                      <span className={styles.confirmSpinner} />
                                    ) : bookingSlotId === slot.id && bookingStatus === "success" ? (
                                      "✓ Booked!"
                                    ) : bookingSlotId === slot.id && bookingStatus === "error" ? (
                                      "Failed"
                                    ) : (
                                      "Confirm"
                                    )}
                                  </button>
                                )}
                              </div>
                              {bookingSlotId === slot.id && bookingStatus === "error" && bookingError && (
                                <div className={styles.bookingErrorMsg}>{bookingError}</div>
                              )}
                            </div>
                            );
                          })}
                          {virtualSlots.length > virtualSlotsVisible && (
                            <button
                              type="button"
                              className={styles.showMoreBtn}
                              onClick={() => setVirtualSlotsVisible((v) => v + 4)}
                            >
                              Show {Math.min(4, virtualSlots.length - virtualSlotsVisible)} more sessions
                            </button>
                          )}
                        </>
                      );
                    })()
                  )
                )}
              </div>
            </div>

          </div>
          </PlanGate>
        )}
      </div>

      {bookingGate && (
        <PlanGate
          locked
          asModal
          reason={bookingGate.reason}
          planName={planAccess.planName}
          hasPlan={planAccess.hasPlan}
          onClose={() => setBookingGate(null)}
        >
          <div />
        </PlanGate>
      )}
      {showCoachModal && (
        <CoachSelectionModal
          coaches={uniqueCoachesForModal}
          selectedCoachId={selectedCoachId}
          coachNames={coachNames}
          coachFullNames={coachFullNames}
          coachProfileDetails={coachProfileDetails}
          onSelect={(id) => setSelectedCoachId(id)}
          onClose={() => setShowCoachModal(false)}
          selectedDate={selectedDate}
        />
      )}

      {detailSlot != null && (
        <SessionDetailsModal
          slot={detailSlot}
          onClose={() => setDetailSlot(null)}
          isReserved={isSlotReserved(detailSlot)}
          isPast={!!detailSlot.isPast}
          bookingSlotId={bookingSlotId}
          bookingStatus={bookingStatus}
          cancellingSlotId={cancellingSlotId}
          onConfirm={handleConfirmBooking}
          onCancel={handleCancelBooking}
          reservedPlayers={
            allLinkedPlayers && detailSlot.sessionId
              ? (sessionPlayerReservations[detailSlot.sessionId] || []).map((r) => ({ playerName: r.playerName }))
              : undefined
          }
        />
      )}
    </div>
  );
}
