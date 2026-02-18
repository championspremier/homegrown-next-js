"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGroupSession,
  updateGroupSession,
  deleteGroupSession,
  createRecurringSessions,
  updateRecurringSessions,
  deleteRecurringSessions,
  deleteIndividualSessionType,
  type CreateGroupSessionParams,
  type UpdateGroupSessionParams,
  type CreateRecurringSessionsParams,
  type UpdateRecurringSessionsParams,
} from "@/app/actions/admin";
import { Users, UserCheck } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { SessionForCalendar, CoachOption, ProgramOption, SessionTypeOption, IndividualSessionType } from "./page";
import { IndividualSessionModal } from "./individual-session-modal";
import formStyles from "@/components/forms.module.css";
import styles from "./schedule.module.css";

const DEFAULT_SESSION_COLOR = "#4a90d9";

type CreateStep = null | "choose-location" | "choose-type" | "group-form" | "individual-form";
type LocationType = "on-field" | "virtual";

function timeStringToMinutes(t: string): number {
  const parts = (t ?? "").trim().split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return h * 60 + m;
}

function formatTimeForDisplay(t: string): string {
  const minutes = timeStringToMinutes(t);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `12:${m.toString().padStart(2, "0")} AM`;
  if (h < 12) return `${h}:${m.toString().padStart(2, "0")} AM`;
  if (h === 12) return `12:${m.toString().padStart(2, "0")} PM`;
  return `${h - 12}:${m.toString().padStart(2, "0")} PM`;
}

function minutesToTimeInput(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function getWeekRange(anchor: Date): { start: Date; end: Date } {
  const d = new Date(anchor);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface ScheduleCalendarProps {
  sessions: SessionForCalendar[];
  coaches: CoachOption[];
  programs: ProgramOption[];
  sessionTypes: SessionTypeOption[];
  individualSessionTypes?: IndividualSessionType[];
  role?: "admin" | "coach";
  currentCoachId?: string;
}

function getSessionColor(sessionTypeName: string, sessionTypes: SessionTypeOption[]): string {
  return sessionTypes.find((t) => t.name === sessionTypeName)?.color ?? DEFAULT_SESSION_COLOR;
}

function getSessionTypesForLocation(sessionTypes: SessionTypeOption[], location: "on-field" | "virtual") {
  if (location === "on-field")
    return sessionTypes.filter((t) => t.category === "on-field" || t.category === "both");
  return sessionTypes.filter((t) => t.category === "virtual" || t.category === "both");
}

function timeStringToDecimalHours(t: string): number {
  const parts = (t ?? "").trim().split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return h + m / 60;
}

type AvailabilityBlock = {
  dayIndex: number;
  startHour: number;
  endHour: number;
  name: string;
  color: string;
};

function getAvailabilityBlocks(
  individualSessionTypes: IndividualSessionType[],
  weekDays: Date[]
): AvailabilityBlock[] {
  const blocks: AvailabilityBlock[] = [];
  for (const type of individualSessionTypes) {
    if (!type.is_active) continue;
    const avail = type.coach_individual_availability ?? [];
    const activeAvail = avail.filter((a) => a.is_active);
    if (activeAvail.length === 0) continue;
    weekDays.forEach((date, dayIndex) => {
      const dayOfWeek = date.getDay();
      const dayAvail = activeAvail.filter((a) => a.day_of_week === dayOfWeek);
      if (dayAvail.length === 0) return;
      const startHour = Math.min(...dayAvail.map((a) => timeStringToDecimalHours(a.start_time)));
      const endHour = Math.max(...dayAvail.map((a) => timeStringToDecimalHours(a.end_time)));
      blocks.push({
        dayIndex,
        startHour,
        endHour,
        name: type.name,
        color: type.color,
      });
    });
  }
  return blocks;
}

export function ScheduleCalendar({ sessions, coaches, programs, sessionTypes, individualSessionTypes = [], role = "admin", currentCoachId }: ScheduleCalendarProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const isCoach = role === "coach";
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "individual">("calendar");
  const [programFilterId, setProgramFilterId] = useState<string>("");
  const [createStep, setCreateStep] = useState<CreateStep>(null);
  const [pendingLocationType, setPendingLocationType] = useState<LocationType>("on-field");
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"create" | "edit">("create");
  const [editingSession, setEditingSession] = useState<SessionForCalendar | null>(null);
  const [editScope, setEditScope] = useState<"one" | "series">("one");
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [scopeModalSession, setScopeModalSession] = useState<SessionForCalendar | null>(null);
  const [scopeOption, setScopeOption] = useState<"one" | "series">("one");
  const [draggedSession, setDraggedSession] = useState<SessionForCalendar | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; time: string } | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"details" | "settings">("details");
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const [individualModalOpen, setIndividualModalOpen] = useState(false);
  const [editingIndividualSession, setEditingIndividualSession] = useState<IndividualSessionType | null>(null);
  const [sidebarIsIndividual, setSidebarIsIndividual] = useState(false);
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const clearDragState = useCallback(() => {
    setDraggedSession(null);
    setDragOverSlot(null);
  }, []);

  const handleDrop = useCallback(
    async (targetDate: string, targetTime: string) => {
      if (!draggedSession) return;
      const newTime = targetTime.length === 5 ? targetTime : targetTime.slice(0, 5);
      if (draggedSession.session_date === targetDate && draggedSession.session_time === newTime) {
        clearDragState();
        return;
      }
      const params: { session_date: string; session_time: string; recurring_group_id?: null } = {
        session_date: targetDate,
        session_time: newTime,
      };
      if (draggedSession.recurring_group_id) {
        params.recurring_group_id = null;
      }
      const res = await updateGroupSession(draggedSession.id, params);
      if (!res.error) router.refresh();
      clearDragState();
    },
    [draggedSession, router, clearDragState]
  );

  const openEditSidebar = useCallback((session: SessionForCalendar, scope: "one" | "series" = "one") => {
    setEditingSession(session);
    setEditScope(scope);
    setSidebarIsIndividual(false);
    setSidebarMode("edit");
    setPendingLocationType((session.location_type === "virtual" ? "virtual" : "on-field") as LocationType);
    setSidebarTab("details");
    setSidebarError(null);
    setSidebarOpen(true);
  }, []);

  const handleScopeContinue = useCallback(() => {
    if (!scopeModalSession) return;
    openEditSidebar(scopeModalSession, scopeOption);
    setScopeModalOpen(false);
    setScopeModalSession(null);
  }, [scopeModalSession, scopeOption, openEditSidebar]);

  const week = useMemo(() => getWeekRange(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(() => {
    const out: Date[] = [];
    const cur = new Date(week.start);
    for (let i = 0; i < 7; i++) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [week.start]);

  const filteredSessions = useMemo(() => {
    if (!programFilterId) return sessions;
    return sessions.filter((s) => s.program_id === programFilterId);
  }, [sessions, programFilterId]);

  const homegrownProgram = useMemo(() => programs.find((p) => p.is_platform_owner) ?? null, [programs]);

  const goToday = useCallback(() => setWeekAnchor(new Date()), []);
  const goPrev = useCallback(() => {
    setWeekAnchor((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() - 7);
      return next;
    });
  }, []);
  const goNext = useCallback(() => {
    setWeekAnchor((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      return next;
    });
  }, []);

  const openCreateLocationDropdown = useCallback(() => {
    setCreateDropdownOpen(true);
    setCreateStep("choose-location");
  }, []);

  const chooseLocation = useCallback((loc: LocationType) => {
    setPendingLocationType(loc);
    setCreateDropdownOpen(false);
    setCreateStep("choose-type");
  }, []);

  const openTypeChooserModal = useCallback(() => setCreateStep("choose-type"), []);

  const chooseGroupSession = useCallback(() => {
    setCreateStep(null);
    setSidebarIsIndividual(false);
    setSidebarMode("create");
    setEditingSession(null);
    setSidebarTab("details");
    setSidebarError(null);
    setSidebarOpen(true);
  }, []);

  const chooseIndividualSession = useCallback(() => {
    if (pendingLocationType === "on-field") {
      const existingType = individualSessionTypes?.find(
        (t) => t.location_type === "on-field"
      );
      if (existingType) {
        showToast(
          `On-field individual session type "${existingType.name}" already exists. Edit it in the Individual Sessions tab.`,
          "warning"
        );
        setCreateStep(null);
        return;
      }
    }
    setCreateStep(null);
    setEditingIndividualSession(null);
    setIndividualModalOpen(true);
  }, [pendingLocationType, individualSessionTypes, showToast]);

  const handleSessionBlockClick = useCallback(
    (session: SessionForCalendar) => {
      if (isCoach && session.coach_id !== currentCoachId) return;
      if (session.recurring_group_id) {
        setScopeModalSession(session);
        setScopeOption("one");
        setScopeModalOpen(true);
      } else {
        openEditSidebar(session, "one");
      }
    },
    [openEditSidebar, isCoach, currentCoachId]
  );

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    setEditingSession(null);
    setEditScope("one");
  }, []);

  const isToday = useCallback(
    (d: Date) =>
      d.getDate() === new Date().getDate() &&
      d.getMonth() === new Date().getMonth() &&
      d.getFullYear() === new Date().getFullYear(),
    []
  );

  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionForCalendar[]> = {};
    weekDays.forEach((d) => {
      map[dateToYMD(d)] = [];
    });
    filteredSessions.forEach((s) => {
      const key = s.session_date;
      if (map[key]) map[key].push(s);
    });
    return map;
  }, [weekDays, filteredSessions]);

  const availabilityBlocks = useMemo(
    () => getAvailabilityBlocks(individualSessionTypes, weekDays),
    [individualSessionTypes, weekDays]
  );

  return (
    <div className={styles.scheduleWrap}>
      {tooltipText && tooltipPosition && (
        <div
          className={styles.floatingTooltip}
          style={{
            position: "fixed",
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: "translate(-50%, -100%)",
            zIndex: 9999,
          }}
        >
          {tooltipText}
        </div>
      )}
      {/* A) Header bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.todayBtn} onClick={goToday}>
            Today
          </button>
          <button type="button" className={styles.navBtn} onClick={goPrev} aria-label="Previous week">
            &lt;
          </button>
          <button type="button" className={styles.navBtn} onClick={goNext} aria-label="Next week">
            &gt;
          </button>
          <span className={styles.monthYear}>{formatMonthYear(weekAnchor)}</span>
        </div>
        <div className={styles.headerRight}>
          {!isCoach && (
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === "calendar" ? styles.viewToggleBtnActive : ""}`}
                onClick={() => setViewMode("calendar")}
              >
                Calendar
              </button>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === "individual" ? styles.viewToggleBtnActive : ""}`}
                onClick={() => setViewMode("individual")}
              >
                Individual Sessions
              </button>
            </div>
          )}
          {!isCoach && (
            <div className={styles.createBtnWrap}>
              <button type="button" className={styles.createBtn} onClick={openCreateLocationDropdown}>
                + Create
              </button>
              {createDropdownOpen && (
                <CreateDropdown onChoose={chooseLocation} onClose={() => setCreateDropdownOpen(false)} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Session type chooser modal */}
      {createStep === "choose-type" && (
        <SessionTypeChooserModal
          locationType={pendingLocationType}
          onGroup={chooseGroupSession}
          onIndividual={chooseIndividualSession}
          onCancel={() => setCreateStep(null)}
        />
      )}

      {viewMode === "individual" && (
        <>
          <div className={styles.programFilter}>
            <select
              value={programFilterId}
              onChange={(e) => setProgramFilterId(e.target.value)}
              aria-label="Filter by program"
            >
              <option value="">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.individualSessionsContainer}>
            <div className={styles.individualSessionsHeader}>
            <h2 className={styles.individualSessionsTitle}>Individual Session Types</h2>
          </div>
          {individualSessionTypes.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon} aria-hidden>
                📋
              </div>
              <div className={styles.emptyStateTitle}>No individual sessions configured</div>
              <div className={styles.emptyStateText}>
                Click + Create → Virtual or On-Field → Individual Session to set up 1-on-1 booking types.
              </div>
            </div>
          ) : (
            <table className={styles.sessionTypesTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Duration</th>
                  <th>Location</th>
                  <th>Coaches</th>
                  <th>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {individualSessionTypes.map((item) => {
                  const sessionType = sessionTypes.find((t) => t.id === item.session_type_id);
                  const category = sessionType?.category ?? "both";
                  const locationLabel =
                    category === "virtual" ? "Virtual" : category === "on-field" ? "On-Field" : "Both";
                  const coachIds = [...new Set((item.coach_individual_availability ?? []).map((a) => a.coach_id))];
                  const coachCount = coachIds.length;
                  const coachNames =
                    coachCount <= 2
                      ? coachIds.map((id) => coaches.find((c) => c.id === id)?.display_name ?? "Coach").join(", ")
                      : `${coachCount} coaches`;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.sessionTypeNameCell}>
                          <span
                            className={styles.sessionTypeColor}
                            style={{ backgroundColor: item.color || "#4a90d9" }}
                          />
                          <span className={styles.sessionTypeName}>{item.name}</span>
                        </div>
                      </td>
                      <td>{item.duration_minutes} min</td>
                      <td>
                        <span
                          className={
                            category === "virtual"
                              ? styles.badgeVirtual
                              : category === "on-field"
                                ? styles.badgeOnField
                                : styles.badgeVirtual
                          }
                        >
                          {locationLabel}
                        </span>
                      </td>
                      <td>{coachNames}</td>
                      <td>
                        <span className={item.is_active ? styles.badgeActive : styles.badgeInactive}>
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => {
                              setEditingIndividualSession(item);
                              setIndividualModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            onClick={async () => {
                              if (!window.confirm("Are you sure you want to delete this individual session type?"))
                                return;
                              const res = await deleteIndividualSessionType(item.id);
                              if (!res.error) router.refresh();
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          </div>
        </>
      )}

      {viewMode === "calendar" && (
        <>
          {/* B) Program filter */}
          {!isCoach && (
            <div className={styles.programFilter}>
              <select
                value={programFilterId}
                onChange={(e) => setProgramFilterId(e.target.value)}
                aria-label="Filter by program"
              >
                <option value="">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* C) Weekly calendar grid */}
          <div className={styles.calendarGrid}>
            <div className={styles.gridInner}>
              <div className={styles.allDayRow}>
                <span className={styles.allDayLabel}>All-day</span>
                {weekDays.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={`${styles.dayHeader} ${isToday(d) ? styles.dayHeaderToday : ""}`}
                  >
                    <span className={styles.dayName}>{d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
                    <span className={styles.dayNum}>{d.getDate()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.gridBody}>
              <div className={styles.timeGutterColumn}>
                {Array.from({ length: 18 }, (_, i) => 5 + i).map((hour) => (
                  <div key={hour} className={styles.timeGutterSlot}>
                    {hour === 12 ? "12pm" : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                  </div>
                ))}
              </div>
              {weekDays.map((d, dayIndex) => {
                const dayYmd = dateToYMD(d);
                const dayAvailabilityBlocks = availabilityBlocks.filter((b) => b.dayIndex === dayIndex);
                return (
                  <div
                    key={d.toISOString()}
                    className={`${styles.dayColumn} ${isToday(d) ? styles.dayColumnToday : ""}`}
                  >
                    {/* Availability blocks (behind sessions) */}
                    {dayAvailabilityBlocks.map((block, idx) => (
                      <div
                        key={`avail-${dayIndex}-${idx}`}
                        className={styles.availabilityBlockWrapper}
                        style={{
                          top: `${(block.startHour - 5) * 60}px`,
                          height: `${(block.endHour - block.startHour) * 60}px`,
                        }}
                      >
                        <div className={styles.availabilityBlock} style={{ backgroundColor: block.color }} />
                        <span className={styles.availabilityBlockLabel}>{block.name}</span>
                      </div>
                    ))}
                    {/* Drop zones: one per hour (5am–10pm); pointer-events only when dragging */}
                    {Array.from({ length: 18 }, (_, i) => 5 + i).map((hour) => {
                      const timeStr = `${hour.toString().padStart(2, "0")}:00`;
                      const isOver = dragOverSlot?.date === dayYmd && dragOverSlot?.time === timeStr;
                      return (
                        <div
                          key={`${dayYmd}-${timeStr}`}
                          className={`${styles.timeSlotDropZone} ${isOver ? styles.timeSlotDragOver : ""}`}
                          style={{ top: (hour - 5) * 60, pointerEvents: draggedSession ? "auto" : "none" }}
                          data-date={dayYmd}
                          data-time={timeStr}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDragOverSlot({ date: dayYmd, time: timeStr });
                          }}
                          onDragLeave={() => setDragOverSlot((prev) => (prev?.date === dayYmd && prev?.time === timeStr ? null : prev))}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSlot(null);
                            const date = e.currentTarget.getAttribute("data-date");
                            const time = e.currentTarget.getAttribute("data-time");
                            if (date && time) handleDrop(date, time);
                          }}
                        />
                      );
                    })}
                    {sessionsByDay[dayYmd]?.map((session) => {
                      const startMinutes = timeStringToMinutes(session.session_time);
                      const sessionEndMinutes = startMinutes + session.duration_minutes;
                      const overlapsAvailability = dayAvailabilityBlocks.some((block) => {
                        const blockStartMin = block.startHour * 60;
                        const blockEndMin = block.endHour * 60;
                        return startMinutes < blockEndMin && sessionEndMinutes > blockStartMin;
                      });
                      const topPx = startMinutes - 5 * 60;
                      const heightPx = Math.max(24, (session.duration_minutes / 60) * 60);
                      const color = getSessionColor(session.session_type, sessionTypes);
                      const isDragging = draggedSession?.id === session.id;
                      return (
                        <div
                          key={session.id}
                          className={`${styles.sessionBlock} ${isDragging ? styles.sessionBlockDragging : ""} ${overlapsAvailability ? styles.sessionBlockOverlapping : ""}`}
                          style={{
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            backgroundColor: color,
                          }}
                          draggable={!isCoach || session.coach_id === currentCoachId}
                          onMouseEnter={(e) => {
                            if (isCoach && session.coach_id !== currentCoachId) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltipText(session.recurring_group_id ? "Drag to move this session only" : "Drag to move");
                            setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                          }}
                          onMouseLeave={() => {
                            setTooltipText(null);
                            setTooltipPosition(null);
                          }}
                          onDragStart={(e) => {
                            if (isCoach && session.coach_id !== currentCoachId) { e.preventDefault(); return; }
                            setTooltipText(null);
                            setTooltipPosition(null);
                            setDraggedSession(session);
                            e.dataTransfer.setData("text/plain", session.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => clearDragState()}
                          onClick={() => handleSessionBlockClick(session)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === "Enter" && handleSessionBlockClick(session)}
                        >
                          {session.recurring_group_id && (
                            <span className={styles.recurringIcon} aria-hidden="true">
                              ↻
                            </span>
                          )}
                          <div className={styles.sessionBlockContent}>
                            <div className={styles.sessionBlockTitle}>
                              {session.attendance_limit === 1 ? "1:1 • " : ""}
                              {session.title || session.session_type || "Session"}
                            </div>
                            <div className={styles.sessionBlockCoach}>
                              {coaches.find((c) => c.id === session.coach_id)?.display_name ?? "Unassigned"}
                              {((session.assistant_coach_ids?.length || 0) + (session.gk_coach_id ? 1 : 0)) > 0 && (
                                <span className={styles.assistantBadge}>
                                  +{(session.assistant_coach_ids?.length || 0) + (session.gk_coach_id ? 1 : 0)}
                                </span>
                              )}
                            </div>
                            <div className={styles.sessionBlockTime}>{formatTimeForDisplay(session.session_time)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Individual session type configuration modal */}
      {individualModalOpen && (
        <IndividualSessionModal
          isOpen={individualModalOpen}
          onClose={() => {
            setIndividualModalOpen(false);
            setEditingIndividualSession(null);
          }}
          onSaved={() => router.refresh()}
          sessionTypes={sessionTypes}
          locationType={editingIndividualSession?.location_type || pendingLocationType || "virtual"}
          coaches={coaches}
          programs={programs}
          existingConfig={editingIndividualSession}
          configuredSessionTypeIds={individualSessionTypes.map((t) => t.session_type_id)}
        />
      )}

      {/* Scope modal for recurring sessions */}
      {scopeModalOpen && scopeModalSession && (
        <ScopeModal
          session={scopeModalSession}
          sessions={filteredSessions}
          scopeOption={scopeOption}
          onScopeChange={setScopeOption}
          onCancel={() => {
            setScopeModalOpen(false);
            setScopeModalSession(null);
          }}
          onContinue={handleScopeContinue}
        />
      )}

      {/* E) Group session sidebar */}
      {sidebarOpen && (
        <GroupSessionSidebar
          mode={sidebarMode}
          session={editingSession}
          editScope={editScope}
          isIndividual={sidebarIsIndividual}
          coaches={coaches}
          programs={programs}
          sessionTypes={sessionTypes}
          homegrownProgram={homegrownProgram}
          locationType={sidebarMode === "edit" && editingSession ? (editingSession.location_type as LocationType) : pendingLocationType}
          tab={sidebarTab}
          onTabChange={setSidebarTab}
          onClose={closeSidebar}
          onSaved={() => {
            closeSidebar();
            router.refresh();
          }}
          onDeleted={() => {
            closeSidebar();
            router.refresh();
          }}
          error={sidebarError}
          onError={setSidebarError}
          onClearError={() => setSidebarError(null)}
          role={role}
        />
      )}

      {/* Click-outside for create dropdown */}
      {createDropdownOpen && (
        <div
          role="presentation"
          style={{ position: "fixed", inset: 0, zIndex: 40 }}
          onClick={() => setCreateDropdownOpen(false)}
        />
      )}
    </div>
  );
}

function CreateDropdown({
  onChoose,
  onClose,
}: {
  onChoose: (loc: LocationType) => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.createDropdown} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={styles.createDropdownOption} onClick={() => onChoose("on-field")}>
        On-Field
      </button>
      <button type="button" className={styles.createDropdownOption} onClick={() => onChoose("virtual")}>
        Virtual
      </button>
    </div>
  );
}

function weekdayFromDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function ScopeModal({
  session,
  sessions,
  scopeOption,
  onScopeChange,
  onCancel,
  onContinue,
}: {
  session: SessionForCalendar;
  sessions: SessionForCalendar[];
  scopeOption: "one" | "series";
  onScopeChange: (v: "one" | "series") => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const seriesCount = sessions.filter((s) => s.recurring_group_id === session.recurring_group_id).length;
  const dayName = weekdayFromDate(session.session_date);
  return (
    <div className={styles.scopeModalOverlay} onClick={onCancel}>
      <div className={styles.scopeModal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.scopeModalTitle}>This is a recurring session.</h2>
        <div className={styles.scopeModalOptions}>
          <label className={`${styles.scopeOption} ${scopeOption === "one" ? styles.scopeOptionSelected : ""}`}>
            <input
              type="radio"
              name="scope"
              checked={scopeOption === "one"}
              onChange={() => onScopeChange("one")}
              aria-hidden
            />
            This session only
          </label>
          <label className={`${styles.scopeOption} ${scopeOption === "series" ? styles.scopeOptionSelected : ""}`}>
            <input
              type="radio"
              name="scope"
              checked={scopeOption === "series"}
              onChange={() => onScopeChange("series")}
              aria-hidden
            />
            All sessions in this series ({seriesCount} {dayName} sessions)
          </label>
        </div>
        <div className={styles.scopeModalActions}>
          <button type="button" className={styles.scopeModalCancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.scopeModalContinueBtn} onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionTypeChooserModal({
  locationType,
  onGroup,
  onIndividual,
  onCancel,
}: {
  locationType: LocationType;
  onGroup: () => void;
  onIndividual: () => void;
  onCancel: () => void;
}) {
  const title =
    locationType === "virtual" ? "Create Virtual Session" : "Create On-Field Session";
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{title}</h2>
        <div className={styles.modalCards}>
          <button type="button" className={styles.modalCard} onClick={onGroup}>
            <div className={styles.modalCardIcon}><Users size={28} strokeWidth={1.8} /></div>
            <div className={styles.modalCardTitle}>Group Session</div>
            <div className={styles.modalCardDesc}>Schedule a group training session</div>
          </button>
          <button type="button" className={styles.modalCard} onClick={onIndividual}>
            <div className={styles.modalCardIcon}><UserCheck size={28} strokeWidth={1.8} /></div>
            <div className={styles.modalCardTitle}>One-on-One</div>
            <div className={styles.modalCardDesc}>Configure individual appointment types</div>
          </button>
        </div>
      </div>
    </div>
  );
}

type RepeatsFrequency = "" | "daily" | "weekly" | "monthly";
type RepeatsEnd = "never" | "on-date" | "after";

interface GroupSessionSidebarProps {
  mode: "create" | "edit";
  session: SessionForCalendar | null;
  editScope?: "one" | "series";
  isIndividual?: boolean;
  coaches: CoachOption[];
  programs: ProgramOption[];
  sessionTypes: SessionTypeOption[];
  homegrownProgram: ProgramOption | null;
  locationType: LocationType;
  tab: "details" | "settings";
  onTabChange: (t: "details" | "settings") => void;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  error: string | null;
  onError: (msg: string | null) => void;
  onClearError: () => void;
  role?: "admin" | "coach";
}

function GroupSessionSidebar({
  mode,
  session,
  editScope = "one",
  isIndividual = false,
  coaches,
  programs,
  sessionTypes: allSessionTypes,
  homegrownProgram,
  locationType,
  role: sidebarRole = "admin",
  tab,
  onTabChange,
  onClose,
  onSaved,
  onDeleted,
  error,
  onError,
  onClearError,
}: GroupSessionSidebarProps) {
  const router = useRouter();
  const isVirtual = locationType === "virtual";
  const sessionTypesForForm = getSessionTypesForLocation(allSessionTypes, locationType).filter(
    (t) => !t.allow_individual
  );

  const [repeatsFrequency, setRepeatsFrequency] = useState<RepeatsFrequency>("");
  const [repeatsEnd, setRepeatsEnd] = useState<RepeatsEnd>("never");
  const [repeatsEndDate, setRepeatsEndDate] = useState("");
  const [repeatsOccurrences, setRepeatsOccurrences] = useState(10);

  const [sessionType, setSessionType] = useState(
    session?.session_type ?? sessionTypesForForm[0]?.name ?? ""
  );
  const [title, setTitle] = useState(session?.title ?? session?.session_type ?? "");
  const [sessionDate, setSessionDate] = useState(() =>
    session?.session_date ? session.session_date : dateToYMD(new Date())
  );
  const [startTime, setStartTime] = useState(() => {
    if (session?.session_time) return minutesToTimeInput(timeStringToMinutes(session.session_time));
    return "09:00";
  });
  const [durationMinutes, setDurationMinutes] = useState(() => session?.duration_minutes ?? 60);
  const [programId, setProgramId] = useState(
    session?.program_id ?? (locationType === "virtual" ? homegrownProgram?.id : programs[0]?.id) ?? ""
  );
  const [coachId, setCoachId] = useState(session?.coach_id ?? "");
  const [assistantCoachIds, setAssistantCoachIds] = useState<string[]>(() => session?.assistant_coach_ids ?? []);
  const [gkCoachId, setGkCoachId] = useState(session?.gk_coach_id ?? "");
  const [assistantCoachDropdownOpen, setAssistantCoachDropdownOpen] = useState(false);
  const assistantDropdownRef = useRef<HTMLDivElement>(null);
  const [attendanceLimitEnabled, setAttendanceLimitEnabled] = useState(
    session ? (session.attendance_limit < 999) : true
  );
  const [attendanceLimit, setAttendanceLimit] = useState(
    session?.attendance_limit ?? 25
  );
  const [location, setLocation] = useState(session?.location ?? "");
  const [zoomLink, setZoomLink] = useState(session?.zoom_link ?? "");
  const [description, setDescription] = useState(
    session?.description ?? session?.session_plan ?? ""
  );

  useEffect(() => {
    if (session) {
      setSessionType(session.session_type ?? sessionTypesForForm[0]?.name ?? "");
      setTitle(session.title ?? session.session_type ?? "");
      setSessionDate(session.session_date ? session.session_date : dateToYMD(new Date()));
      setStartTime(session.session_time ? minutesToTimeInput(timeStringToMinutes(session.session_time)) : "09:00");
      setDurationMinutes(session.duration_minutes ?? 60);
      setProgramId(session.program_id ?? programs[0]?.id ?? "");
      setCoachId(session.coach_id ?? "");
      setAssistantCoachIds(session.assistant_coach_ids ?? []);
      setGkCoachId(session.gk_coach_id ?? "");
      setAttendanceLimitEnabled(session.attendance_limit < 999);
      setAttendanceLimit(session.attendance_limit ?? 25);
      setLocation(session.location ?? "");
      setZoomLink(session.zoom_link ?? "");
      setDescription(session.description ?? session.session_plan ?? "");
    } else {
      const typesForLocation = getSessionTypesForLocation(allSessionTypes, locationType).filter(
        (t) => !t.allow_individual
      );
      setSessionType(typesForLocation[0]?.name ?? "");
      setTitle("");
      setSessionDate(dateToYMD(new Date()));
      setStartTime("09:00");
      setDurationMinutes(60);
      setProgramId(locationType === "virtual" ? homegrownProgram?.id ?? "" : programs[0]?.id ?? "");
      setCoachId("");
      setAssistantCoachIds([]);
      setGkCoachId("");
      setAttendanceLimitEnabled(true);
      setAttendanceLimit(25);
      setLocation("");
      setZoomLink("");
      setDescription("");
      setRepeatsFrequency("");
      setRepeatsEnd("never");
      setRepeatsEndDate("");
      setRepeatsOccurrences(10);
    }
  }, [session, locationType, programs, homegrownProgram, allSessionTypes]);

  useEffect(() => {
    if (!assistantCoachDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (assistantDropdownRef.current && !assistantDropdownRef.current.contains(e.target as Node)) {
        setAssistantCoachDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [assistantCoachDropdownOpen]);

  const maxDuration = sessionType.toLowerCase().includes("camp") ? 480 : 120;

  const effectiveProgramId =
    isVirtual && homegrownProgram
      ? homegrownProgram.id
      : programs.length === 1
        ? programs[0].id
        : programId;

  const handleSessionTypeChange = (v: string) => {
    setSessionType(v);
    if (!session && !title) setTitle(v);
  };

  const handleSave = async () => {
    onClearError();
    const timeForServer = startTime.length === 5 ? startTime : startTime.slice(0, 5);
    const limit = isIndividual ? 1 : (attendanceLimitEnabled ? attendanceLimit : 999);

    if (durationMinutes > maxDuration) {
      onError(`Session duration cannot exceed ${maxDuration / 60} hours (${maxDuration} minutes)`);
      return;
    }

    if (mode === "create") {
      if (!repeatsFrequency) {
        const params: CreateGroupSessionParams = {
          coach_id: coachId,
          assistant_coach_ids: assistantCoachIds.length ? assistantCoachIds : undefined,
          gk_coach_id: gkCoachId || undefined,
          title: title.trim() || sessionType,
          session_type: sessionType,
          session_date: sessionDate,
          session_time: timeForServer,
          duration_minutes: durationMinutes,
          attendance_limit: limit,
          location_type: locationType,
          program_id: effectiveProgramId,
          location: location.trim() || null,
          zoom_link: zoomLink.trim() || null,
          description: description.trim() || null,
        };
        const res = await createGroupSession(params);
        if (res.error) {
          onError(res.error);
          return;
        }
        onSaved();
      } else {
        const params: CreateRecurringSessionsParams = {
          coach_id: coachId,
          assistant_coach_ids: assistantCoachIds.length ? assistantCoachIds : undefined,
          gk_coach_id: gkCoachId || undefined,
          title: title.trim() || sessionType,
          session_type: sessionType,
          session_date: sessionDate,
          session_time: timeForServer,
          duration_minutes: durationMinutes,
          attendance_limit: limit,
          location_type: locationType,
          program_id: effectiveProgramId,
          location: location.trim() || null,
          zoom_link: zoomLink.trim() || null,
          description: description.trim() || null,
          repeatsFrequency,
          repeatsEnd,
          repeatsEndDate: repeatsEnd === "on-date" ? repeatsEndDate : null,
          repeatsOccurrences: repeatsEnd === "after" ? repeatsOccurrences : undefined,
        };
        const res = await createRecurringSessions(params);
        if (res.error) {
          onError(res.error);
          return;
        }
        onSaved();
      }
    } else if (session) {
      if (editScope === "one") {
        const params: UpdateGroupSessionParams = {
          coach_id: coachId,
          assistant_coach_ids: assistantCoachIds,
          gk_coach_id: gkCoachId || null,
          title: title.trim() || sessionType,
          session_type: sessionType,
          session_date: sessionDate,
          session_time: timeForServer,
          duration_minutes: durationMinutes,
          attendance_limit: limit,
          location_type: locationType,
          program_id: effectiveProgramId,
          location: location.trim() || null,
          zoom_link: zoomLink.trim() || null,
          description: description.trim() || null,
          session_plan: description.trim() || null,
          recurring_group_id: null,
        };
        const res = await updateGroupSession(session.id, params);
        if (res.error) {
          onError(res.error);
          return;
        }
        onSaved();
      } else {
        const params: UpdateRecurringSessionsParams = {
          coach_id: coachId,
          assistant_coach_ids: assistantCoachIds,
          gk_coach_id: gkCoachId || null,
          title: title.trim() || sessionType,
          session_type: sessionType,
          session_time: timeForServer,
          duration_minutes: durationMinutes,
          attendance_limit: limit,
          location_type: locationType,
          location: location.trim() || null,
          zoom_link: zoomLink.trim() || null,
          description: description.trim() || null,
          session_plan: description.trim() || null,
          program_id: effectiveProgramId,
        };
        const res = await updateRecurringSessions(session.recurring_group_id!, params);
        if (res.error) {
          onError(res.error);
          return;
        }
        onSaved();
      }
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    const message =
      editScope === "series" && session.recurring_group_id
        ? "Are you sure you want to delete all sessions in this series?"
        : "Are you sure you want to delete this session?";
    if (!window.confirm(message)) return;
    if (editScope === "series" && session.recurring_group_id) {
      const res = await deleteRecurringSessions(session.recurring_group_id);
      if (res.error) {
        onError(res.error);
        return;
      }
    } else {
      const res = await deleteGroupSession(session.id);
      if (res.error) return;
    }
    onDeleted();
    router.refresh();
  };

  return (
    <>
      <div className={styles.sidebarOverlay} onClick={onClose} />
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>
            {isIndividual
              ? mode === "edit"
                ? "Edit Individual Session"
                : "New Individual Session"
              : mode === "edit"
                ? "Edit Session"
                : "Create Session"}
          </h2>
          <button type="button" className={styles.sidebarClose} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.sidebarTabs}>
          <button
            type="button"
            className={`${styles.sidebarTab} ${tab === "details" ? styles.sidebarTabActive : ""}`}
            onClick={() => onTabChange("details")}
          >
            Details
          </button>
          <button
            type="button"
            className={`${styles.sidebarTab} ${tab === "settings" ? styles.sidebarTabActive : ""}`}
            onClick={() => onTabChange("settings")}
          >
            Settings
          </button>
        </div>
        <div className={styles.sidebarBody}>
          {error && <p className={formStyles.formError} role="alert">{error}</p>}
          {tab === "details" && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Type *</label>
                <select
                  className={formStyles.formInput}
                  value={sessionType}
                  onChange={(e) => handleSessionTypeChange(e.target.value)}
                >
                  {sessionTypesForForm.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Title *</label>
                <input
                  type="text"
                  className={formStyles.formInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Session title"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date *</label>
                <input
                  type="date"
                  className={formStyles.formInput}
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Time *</label>
                <input
                  type="time"
                  className={formStyles.formInput}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duration (minutes)</label>
                <input
                  type="number"
                  className={formStyles.formInput}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Math.max(15, Math.min(maxDuration, parseInt(e.target.value, 10) || 15)))
                  }
                  min={15}
                  max={maxDuration}
                  step={15}
                />
                <span className={styles.durationHint}>
                  Max: {maxDuration} min ({maxDuration / 60}h)
                  {sessionType.toLowerCase().includes("camp") ? " — Camp mode" : ""}
                </span>
              </div>
              {programs.length > 1 && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Program *</label>
                <select
                  className={formStyles.formInput}
                  value={effectiveProgramId}
                  onChange={(e) => setProgramId(e.target.value)}
                  disabled={isVirtual}
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {isVirtual && <p className={styles.formHint}>Virtual sessions use the Homegrown program.</p>}
              </div>
              )}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Head Coach *</label>
                <select
                  className={formStyles.formInput}
                  value={coachId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setCoachId(newId);
                    setAssistantCoachIds((prev) => prev.filter((id) => id !== newId));
                    setGkCoachId((prev) => (prev === newId ? "" : prev));
                  }}
                >
                  <option value="">Select coach...</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Assistant Coaches (optional)</label>
                <div className={styles.assistantPills}>
                  {assistantCoachIds.map((id) => {
                    const coach = coaches.find((c) => c.id === id);
                    return (
                      <span key={id} className={styles.assistantPill}>
                        {coach?.display_name ?? "Coach"}
                        <button
                          type="button"
                          className={styles.assistantPillRemove}
                          onClick={() => setAssistantCoachIds((prev) => prev.filter((cid) => cid !== id))}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className={styles.assistantDropdownWrapper} ref={assistantDropdownRef}>
                  <button
                    type="button"
                    className={styles.assistantAddBtn}
                    onClick={() => setAssistantCoachDropdownOpen(!assistantCoachDropdownOpen)}
                  >
                    + Add Assistant
                  </button>
                  {assistantCoachDropdownOpen && (
                    <div className={styles.assistantDropdownMenu}>
                      {coaches
                        .filter(
                          (c) =>
                            c.id !== coachId &&
                            !assistantCoachIds.includes(c.id) &&
                            c.id !== gkCoachId
                        )
                        .map((coach) => (
                          <button
                            key={coach.id}
                            type="button"
                            className={styles.assistantDropdownItem}
                            onClick={() => {
                              setAssistantCoachIds((prev) => [...prev, coach.id]);
                              setAssistantCoachDropdownOpen(false);
                            }}
                          >
                            {coach.display_name}
                          </button>
                        ))}
                      {coaches.filter(
                        (c) =>
                          c.id !== coachId &&
                          !assistantCoachIds.includes(c.id) &&
                          c.id !== gkCoachId
                      ).length === 0 && (
                        <div className={styles.assistantDropdownEmpty}>No more coaches available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>GK Coach (optional)</label>
                <select
                  className={formStyles.formInput}
                  value={gkCoachId}
                  onChange={(e) => setGkCoachId(e.target.value)}
                >
                  <option value="">None</option>
                  {coaches
                    .filter(
                      (c) => c.id !== coachId && !assistantCoachIds.includes(c.id)
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.display_name}
                      </option>
                    ))}
                </select>
              </div>
              {mode === "create" && (
                <div className={styles.repeatsSection}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Repeats</label>
                    <select
                      className={formStyles.formInput}
                      value={repeatsFrequency}
                      onChange={(e) => setRepeatsFrequency((e.target.value || "") as RepeatsFrequency)}
                    >
                      <option value="">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {repeatsFrequency && (
                    <div className={styles.repeatsEndOptions}>
                      <label className={styles.repeatsEndOption}>
                        <input
                          type="radio"
                          name="repeatsEnd"
                          checked={repeatsEnd === "never"}
                          onChange={() => setRepeatsEnd("never")}
                        />
                        Never
                      </label>
                      <label className={styles.repeatsEndOption}>
                        <input
                          type="radio"
                          name="repeatsEnd"
                          checked={repeatsEnd === "on-date"}
                          onChange={() => setRepeatsEnd("on-date")}
                        />
                        On date
                        {repeatsEnd === "on-date" && (
                          <input
                            type="date"
                            value={repeatsEndDate}
                            onChange={(e) => setRepeatsEndDate(e.target.value)}
                          />
                        )}
                      </label>
                      <label className={styles.repeatsEndOption}>
                        <input
                          type="radio"
                          name="repeatsEnd"
                          checked={repeatsEnd === "after"}
                          onChange={() => setRepeatsEnd("after")}
                        />
                        After
                        {repeatsEnd === "after" && (
                          <input
                            type="number"
                            min={2}
                            max={100}
                            value={repeatsOccurrences}
                            onChange={(e) => setRepeatsOccurrences(parseInt(e.target.value, 10) || 10)}
                          />
                        )}
                        occurrences
                      </label>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {tab === "settings" && (
            <>
              {!isIndividual && (
                <div className={styles.formGroup}>
                  <div className={styles.formCheckRow}>
                    <input
                      type="checkbox"
                      id="attendance-limit"
                      checked={attendanceLimitEnabled}
                      onChange={(e) => setAttendanceLimitEnabled(e.target.checked)}
                    />
                    <label htmlFor="attendance-limit">Attendance limit</label>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={attendanceLimit}
                    onChange={(e) => setAttendanceLimit(parseInt(e.target.value, 10) || 25)}
                    disabled={!attendanceLimitEnabled}
                  />
                </div>
              )}
              {!isVirtual && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Location</label>
                  <input
                    type="text"
                    className={formStyles.formInput}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add location"
                  />
                </div>
              )}
              {isVirtual && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Zoom link</label>
                  <input
                    type="text"
                    className={formStyles.formInput}
                    value={zoomLink}
                    onChange={(e) => setZoomLink(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description / Session Plan</label>
                <textarea
                  className={formStyles.formInput}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter session description and plan..."
                  rows={4}
                />
                <p className={styles.formHint}>
                  Include Meeting ID and Passcode here if needed for the Zoom session.
                </p>
              </div>
            </>
          )}
        </div>
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarFooterActions}>
            {mode === "edit" && sidebarRole !== "coach" && (
              <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
                Delete
              </button>
            )}
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={styles.saveBtn} onClick={handleSave}>
              {mode === "edit" ? "Save Changes" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
