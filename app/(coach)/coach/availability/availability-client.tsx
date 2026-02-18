"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./availability.module.css";

interface RecurringAvailability {
  id: string;
  individual_session_type_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface DateOverride {
  id: string;
  override_date: string;
  is_blocked: boolean;
  custom_start_time: string | null;
  custom_end_time: string | null;
  reason: string | null;
}

interface SessionType {
  id: string;
  name: string;
  color: string | null;
  location_type: string;
}

interface Props {
  coachId: string;
  coachName: string;
  recurringAvailability: RecurringAvailability[];
  dateOverrides: DateOverride[];
  sessionTypes: SessionType[];
  isAdmin?: boolean;
  coaches?: Array<{ id: string; name: string }>;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "PM" : "AM";
  const h12 = (h ?? 0) % 12 || 12;
  return `${h12}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

export default function AvailabilityClient({
  coachId,
  coachName,
  recurringAvailability,
  dateOverrides: initialOverrides,
  sessionTypes,
  isAdmin = false,
  coaches = [],
}: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [overrides, setOverrides] = useState<DateOverride[]>(initialOverrides);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [existingBookingsCount, setExistingBookingsCount] = useState(0);

  const [activeCoachId, setActiveCoachId] = useState(coachId);
  const [activeCoachName, setActiveCoachName] = useState(coachName);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [activeRecurring, setActiveRecurring] = useState(recurringAvailability);
  const [activeSessionTypes, setActiveSessionTypes] = useState(sessionTypes);

  const blockedDates = useMemo(() => {
    const set = new Set<string>();
    overrides.forEach((o) => {
      if (o.is_blocked) set.add(o.override_date);
    });
    return set;
  }, [overrides]);

  const recurringDays = useMemo(() => {
    const set = new Set<number>();
    activeRecurring.forEach((r) => set.add(r.day_of_week));
    return set;
  }, [activeRecurring]);

  useEffect(() => {
    if (!selectedDate) {
      setExistingBookingsCount(0);
      return;
    }
    async function checkBookings() {
      const supabase = createClient();
      const { count } = await supabase
        .from("individual_session_bookings")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", activeCoachId)
        .eq("booking_date", selectedDate)
        .eq("status", "confirmed");
      setExistingBookingsCount(count || 0);
    }
    checkBookings();
  }, [selectedDate, activeCoachId]);

  function getRecurringHours(dayOfWeek: number): string {
    const rows = activeRecurring.filter((r) => r.day_of_week === dayOfWeek);
    if (rows.length === 0) return "";
    return rows
      .map((r) => {
        const start = r.start_time?.slice(0, 5) || "";
        const end = r.end_time?.slice(0, 5) || "";
        return `${formatTime12(start)}–${formatTime12(end)}`;
      })
      .join(", ");
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date | null; dateStr: string; dayOfMonth: number }> = [];

    for (let i = 0; i < startPad; i++) {
      days.push({ date: null, dateStr: "", dayOfMonth: 0 });
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(currentYear, currentMonth, d);
      const y = date.getFullYear();
      const mo = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      days.push({ date, dateStr: `${y}-${mo}-${dd}`, dayOfMonth: d });
    }

    return days;
  }, [currentMonth, currentYear]);

  async function toggleBlock(dateStr: string) {
    setSaving(dateStr);
    const supabase = createClient();
    const isCurrentlyBlocked = blockedDates.has(dateStr);

    if (isCurrentlyBlocked) {
      const override = overrides.find((o) => o.override_date === dateStr && o.is_blocked);
      if (override) {
        await supabase.from("coach_date_overrides").delete().eq("id", override.id);
        setOverrides((prev) => prev.filter((o) => o.id !== override.id));
      }
    } else {
      const { data, error } = await supabase
        .from("coach_date_overrides")
        .upsert(
          {
            coach_id: activeCoachId,
            override_date: dateStr,
            is_blocked: true,
            reason: blockReason || null,
          },
          { onConflict: "coach_id,override_date" }
        )
        .select()
        .single();

      if (data && !error) {
        setOverrides((prev) => [
          ...prev.filter((o) => o.override_date !== dateStr),
          data as DateOverride,
        ]);
      }
    }

    setSaving(null);
    setBlockReason("");
  }

  async function switchCoach(newCoachId: string) {
    setLoadingCoach(true);
    setActiveCoachId(newCoachId);
    const coach = coaches.find((c) => c.id === newCoachId);
    setActiveCoachName(coach?.name || "Coach");

    const supabase = createClient();

    const [{ data: newOverrides }, { data: newRecurring }, { data: newAssigned }] =
      await Promise.all([
        supabase
          .from("coach_date_overrides")
          .select("id, override_date, is_blocked, custom_start_time, custom_end_time, reason")
          .eq("coach_id", newCoachId),
        supabase
          .from("coach_individual_availability")
          .select("id, individual_session_type_id, day_of_week, start_time, end_time, is_active")
          .eq("coach_id", newCoachId)
          .eq("is_active", true),
        supabase
          .from("coach_individual_availability")
          .select(
            "individual_session_type_id, individual_session_types(id, name, color, location_type)"
          )
          .eq("coach_id", newCoachId)
          .eq("is_active", true),
      ]);

    setOverrides(
      (newOverrides || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        override_date: d.override_date as string,
        is_blocked: d.is_blocked as boolean,
        custom_start_time: (d.custom_start_time as string) || null,
        custom_end_time: (d.custom_end_time as string) || null,
        reason: (d.reason as string) || null,
      }))
    );

    setActiveRecurring(
      (newRecurring || []) as RecurringAvailability[]
    );

    const newTypes = Array.from(
      new Map(
        (newAssigned || [])
          .filter((a: Record<string, unknown>) => a.individual_session_types)
          .map((a: Record<string, unknown>) => {
            const st = a.individual_session_types as SessionType;
            return [st.id, st] as const;
          })
      ).values()
    );
    setActiveSessionTypes(newTypes);

    setSelectedDate(null);
    setLoadingCoach(false);
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Availability</h1>
      <p className={styles.pageSubtitle}>
        Tap a date to block it off. Blocked dates won't show slots to players.
      </p>

      {isAdmin && coaches.length > 0 && (
        <div className={styles.coachSwitcher}>
          <label className={styles.coachSwitcherLabel}>Managing availability for:</label>
          <select
            className={styles.coachSwitcherSelect}
            value={activeCoachId}
            onChange={(e) => switchCoach(e.target.value)}
            disabled={loadingCoach}
          >
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loadingCoach && (
        <div className={styles.loadingOverlay}>Loading...</div>
      )}

      {/* Recurring schedule summary */}
      <div className={styles.recurringSection}>
        <h3 className={styles.sectionTitle}>
          {isAdmin ? `${activeCoachName}'s Weekly Schedule` : "Your Weekly Schedule"}
        </h3>
        <div className={styles.recurringGrid}>
          {DAY_NAMES.map((name, i) => {
            const hours = getRecurringHours(i);
            return (
              <div
                key={i}
                className={`${styles.recurringDay} ${hours ? styles.recurringDayActive : ""}`}
              >
                <span className={styles.recurringDayName}>{name}</span>
                <span className={styles.recurringDayHours}>{hours || "Off"}</span>
              </div>
            );
          })}
        </div>
        {activeSessionTypes.length > 0 && (
          <div className={styles.sessionTypeTags}>
            {activeSessionTypes.map((st) => (
              <span
                key={st.id}
                className={styles.sessionTypeTag}
                style={
                  st.color
                    ? { borderColor: st.color, color: st.color }
                    : undefined
                }
              >
                {st.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Monthly calendar */}
      <div className={styles.calendarSection}>
        <div className={styles.calendarHeader}>
          <button type="button" className={styles.calendarNavBtn} onClick={prevMonth}>
            ‹
          </button>
          <h2 className={styles.calendarMonthTitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button type="button" className={styles.calendarNavBtn} onClick={nextMonth}>
            ›
          </button>
        </div>

        <div className={styles.calendarGrid}>
          {DAY_NAMES.map((d) => (
            <div key={d} className={styles.calendarDayHeader}>
              {d}
            </div>
          ))}

          {calendarDays.map((day, i) => {
            if (!day.date) {
              return <div key={`pad-${i}`} className={styles.calendarDayEmpty} />;
            }

            const dateStr = day.dateStr;
            const isToday = dateStr === todayStr;
            const isPast =
              day.date <
              new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const dayOfWeek = day.date.getDay();
            const hasRecurring = recurringDays.has(dayOfWeek);
            const isBlocked = blockedDates.has(dateStr);
            const isSelected = selectedDate === dateStr;
            const isSaving = saving === dateStr;

            return (
              <button
                key={dateStr}
                type="button"
                className={`${styles.calendarDay} ${isToday ? styles.calendarDayToday : ""} ${isPast ? styles.calendarDayPast : ""} ${hasRecurring && !isBlocked ? styles.calendarDayAvailable : ""} ${isBlocked ? styles.calendarDayBlocked : ""} ${isSelected ? styles.calendarDaySelected : ""}`}
                onClick={() => {
                  if (isPast) return;
                  if (isSelected) {
                    toggleBlock(dateStr);
                    setSelectedDate(null);
                  } else {
                    setSelectedDate(dateStr);
                  }
                }}
                disabled={isPast || isSaving}
              >
                <span className={styles.calendarDayNum}>{day.dayOfMonth}</span>
                {isBlocked && (
                  <span className={styles.calendarDayBlockedIcon}>✕</span>
                )}
                {hasRecurring && !isBlocked && !isPast && (
                  <span className={styles.calendarDayDot} />
                )}
                {isSaving && (
                  <span className={styles.calendarDaySaving}>...</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected date detail panel */}
        {selectedDate && (
          <div className={styles.dateDetailPanel}>
            <div className={styles.dateDetailHeader}>
              <h3 className={styles.dateDetailTitle}>
                {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                  "en-US",
                  { weekday: "long", month: "long", day: "numeric" }
                )}
              </h3>
              <button
                type="button"
                className={styles.dateDetailClose}
                onClick={() => setSelectedDate(null)}
              >
                ✕
              </button>
            </div>

            {blockedDates.has(selectedDate) ? (
              <div className={styles.dateDetailBody}>
                <div className={styles.dateDetailStatus}>
                  <span className={styles.statusBlocked}>✕ Blocked</span>
                  <span className={styles.statusHint}>
                    Players cannot book this date
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.unblockBtn}
                  onClick={() => {
                    toggleBlock(selectedDate);
                    setSelectedDate(null);
                  }}
                  disabled={saving === selectedDate}
                >
                  {saving === selectedDate ? "Saving..." : "Unblock This Date"}
                </button>
              </div>
            ) : (
              <div className={styles.dateDetailBody}>
                {recurringDays.has(
                  new Date(selectedDate + "T12:00:00").getDay()
                ) ? (
                  <>
                    <div className={styles.dateDetailStatus}>
                      <span className={styles.statusAvailable}>
                        ✓ Available
                      </span>
                      <span className={styles.statusHint}>
                        {getRecurringHours(
                          new Date(selectedDate + "T12:00:00").getDay()
                        )}
                      </span>
                    </div>
                    <input
                      type="text"
                      className={styles.reasonInput}
                      placeholder="Reason (optional)"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.blockBtn}
                      onClick={() => {
                        toggleBlock(selectedDate);
                        setSelectedDate(null);
                      }}
                      disabled={saving === selectedDate}
                    >
                      {saving === selectedDate
                        ? "Saving..."
                        : "Block This Date"}
                    </button>
                    {existingBookingsCount > 0 && (
                      <p className={styles.bookingWarning}>
                        ⚠️ {existingBookingsCount} existing booking
                        {existingBookingsCount > 1 ? "s" : ""} on this date will
                        NOT be cancelled.
                      </p>
                    )}
                  </>
                ) : (
                  <div className={styles.dateDetailStatus}>
                    <span className={styles.statusOff}>
                      No recurring schedule
                    </span>
                    <span className={styles.statusHint}>
                      You don't have sessions set for this day of the week
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: "#22c55e" }}
          />{" "}
          Available
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: "#ef4444" }}
          />{" "}
          Blocked
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendDot}
            style={{ background: "var(--border)" }}
          />{" "}
          No schedule
        </div>
      </div>
    </div>
  );
}
