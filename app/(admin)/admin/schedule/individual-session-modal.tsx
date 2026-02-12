"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  saveIndividualSessionType,
  updateIndividualSessionType,
  deleteIndividualSessionType,
  type SaveIndividualSessionTypeParams,
  type CoachAvailabilitySlot,
} from "@/app/actions/admin";
import styles from "./individual-session-modal.module.css";

export type SessionTypeOption = {
  id: string;
  name: string;
  color: string;
  category: string;
  program_id: string | null;
  is_default: boolean;
  sort_order: number;
};

export type CoachOption = { id: string; display_name: string };

export type ProgramOption = { id: string; name: string; slug: string; is_platform_owner: boolean };

export type IndividualSessionType = {
  id: string;
  session_type_id: string;
  program_id: string;
  name: string;
  color: string;
  duration_minutes: number;
  zoom_link: string | null;
  description: string | null;
  min_booking_notice_hours: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  time_slot_granularity: number;
  late_cancel_hours: number;
  booking_confirmation_enabled: boolean;
  booking_confirmation_subject: string | null;
  booking_confirmation_body: string | null;
  reminder_enabled: boolean;
  reminder_hours_before: number | null;
  reminder_subject: string | null;
  reminder_body: string | null;
  coach_individual_availability?: Array<{
    id: string;
    coach_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
  }>;
};

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function defaultDaySlot(dayOfWeek: number) {
  const weekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  return {
    start_time: "09:00",
    end_time: "17:00",
    is_active: weekday,
  };
}

interface IndividualSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  sessionTypes: SessionTypeOption[];
  locationType: "on-field" | "virtual";
  coaches: CoachOption[];
  programs: ProgramOption[];
  existingConfig: IndividualSessionType | null;
  configuredSessionTypeIds: string[];
}

export function IndividualSessionModal({
  isOpen,
  onClose,
  onSaved,
  sessionTypes,
  locationType,
  coaches,
  programs,
  existingConfig,
  configuredSessionTypeIds,
}: IndividualSessionModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "settings" | "notifications">("details");
  const [sessionTypeId, setSessionTypeId] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#4a90d9");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [coachDropdownOpen, setCoachDropdownOpen] = useState(false);
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null);
  const [coachAvailability, setCoachAvailability] = useState<Record<string, Record<number, { start_time: string; end_time: string; is_active: boolean }>>>({});
  const [programId, setProgramId] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [minBookingNoticeHours, setMinBookingNoticeHours] = useState(24);
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(0);
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(0);
  const [timeSlotGranularity, setTimeSlotGranularity] = useState(30);
  const [lateCancelHours, setLateCancelHours] = useState(24);
  const [bookingConfirmationEnabled, setBookingConfirmationEnabled] = useState(true);
  const [bookingConfirmationSubject, setBookingConfirmationSubject] = useState("Booking Confirmation");
  const [bookingConfirmationBody, setBookingConfirmationBody] = useState("Your session has been confirmed.");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderHoursBefore, setReminderHoursBefore] = useState(24);
  const [reminderSubject, setReminderSubject] = useState("Session Reminder");
  const [reminderBody, setReminderBody] = useState("You have a session coming up.");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const coachDropdownRef = useRef<HTMLDivElement>(null);

  const sessionTypesByLocation = useMemo(
    () =>
      locationType === "on-field"
        ? sessionTypes.filter((t) => t.category === "on-field" || t.category === "both")
        : sessionTypes.filter((t) => t.category === "virtual" || t.category === "both"),
    [sessionTypes, locationType]
  );

  const availableSessionTypes = useMemo(
    () =>
      existingConfig
        ? sessionTypesByLocation
        : sessionTypesByLocation.filter((t) => !configuredSessionTypeIds.includes(t.id)),
    [sessionTypesByLocation, configuredSessionTypeIds, existingConfig]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!coachDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (coachDropdownRef.current && !coachDropdownRef.current.contains(e.target as Node)) {
        setCoachDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [coachDropdownOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (existingConfig) {
      setSessionTypeId(existingConfig.session_type_id);
      setName(existingConfig.name);
      setColor(existingConfig.color || "#4a90d9");
      setDurationMinutes(existingConfig.duration_minutes ?? 60);
      setProgramId(existingConfig.program_id);
      setZoomLink(existingConfig.zoom_link ?? "");
      setLocation("");
      setDescription(existingConfig.description ?? "");
      setMinBookingNoticeHours(existingConfig.min_booking_notice_hours ?? 24);
      setBufferBeforeMinutes(existingConfig.buffer_before_minutes ?? 0);
      setBufferAfterMinutes(existingConfig.buffer_after_minutes ?? 0);
      setTimeSlotGranularity(existingConfig.time_slot_granularity ?? 30);
      setLateCancelHours(existingConfig.late_cancel_hours ?? 24);
      setBookingConfirmationEnabled(existingConfig.booking_confirmation_enabled ?? true);
      setBookingConfirmationSubject(existingConfig.booking_confirmation_subject ?? "Booking Confirmation");
      setBookingConfirmationBody(existingConfig.booking_confirmation_body ?? "Your session has been confirmed.");
      setReminderEnabled(existingConfig.reminder_enabled ?? true);
      setReminderHoursBefore(existingConfig.reminder_hours_before ?? 24);
      setReminderSubject(existingConfig.reminder_subject ?? "Session Reminder");
      setReminderBody(existingConfig.reminder_body ?? "You have a session coming up.");
      const coachIds = [...new Set((existingConfig.coach_individual_availability ?? []).map((a) => a.coach_id))];
      setSelectedCoachIds(coachIds);
      const avail: Record<string, Record<number, { start_time: string; end_time: string; is_active: boolean }>> = {};
      coachIds.forEach((cid) => {
        avail[cid] = {};
        DAYS.forEach((d) => {
          const slot = (existingConfig.coach_individual_availability ?? []).find((a) => a.coach_id === cid && a.day_of_week === d.value);
          avail[cid][d.value] = slot
            ? { start_time: slot.start_time?.slice(0, 5) ?? "09:00", end_time: slot.end_time?.slice(0, 5) ?? "17:00", is_active: !!slot.is_active }
            : defaultDaySlot(d.value);
        });
      });
      setCoachAvailability(avail);
    } else {
      setSessionTypeId(availableSessionTypes[0]?.id ?? "");
      setName(availableSessionTypes[0]?.name ?? "");
      setColor(availableSessionTypes[0]?.color ?? "#4a90d9");
      setDurationMinutes(60);
      setProgramId(programs.find((p) => p.is_platform_owner)?.id ?? programs[0]?.id ?? "");
      setZoomLink("");
      setLocation("");
      setDescription("");
      setMinBookingNoticeHours(24);
      setBufferBeforeMinutes(0);
      setBufferAfterMinutes(0);
      setTimeSlotGranularity(30);
      setLateCancelHours(24);
      setBookingConfirmationEnabled(true);
      setBookingConfirmationSubject("Booking Confirmation");
      setBookingConfirmationBody("Your session has been confirmed.");
      setReminderEnabled(true);
      setReminderHoursBefore(24);
      setReminderSubject("Session Reminder");
      setReminderBody("You have a session coming up.");
      setSelectedCoachIds([]);
      setCoachAvailability({});
    }
    setError(null);
    setActiveTab("details");
  }, [isOpen, existingConfig, availableSessionTypes, programs]);

  useEffect(() => {
    if (existingConfig || !sessionTypeId) return;
    const st = sessionTypesByLocation.find((t) => t.id === sessionTypeId);
    if (st) {
      setName(st.name);
      setColor(st.color || "#4a90d9");
    }
  }, [sessionTypeId, sessionTypesByLocation, existingConfig]);

  const setCoachDaySlot = (coachId: string, dayOfWeek: number, field: "start_time" | "end_time" | "is_active", value: string | boolean) => {
    setCoachAvailability((prev) => {
      const next = { ...prev };
      if (!next[coachId]) next[coachId] = {};
      if (!next[coachId][dayOfWeek]) next[coachId][dayOfWeek] = defaultDaySlot(dayOfWeek);
      next[coachId] = { ...next[coachId], [dayOfWeek]: { ...next[coachId][dayOfWeek], [field]: value } };
      return next;
    });
  };

  const getCoachDaySlot = (coachId: string, dayOfWeek: number) => {
    return coachAvailability[coachId]?.[dayOfWeek] ?? defaultDaySlot(dayOfWeek);
  };

  const handleSave = async () => {
    setError(null);
    if (!name?.trim()) {
      setError("Name is required");
      return;
    }
    if (!sessionTypeId && !existingConfig) {
      setError("Session type is required");
      return;
    }
    if (selectedCoachIds.length === 0) {
      setError("Select at least one coach");
      return;
    }
    const hasAny = selectedCoachIds.some((cid) =>
      DAYS.some((d) => getCoachDaySlot(cid, d.value).is_active)
    );
    if (!hasAny) {
      setError("At least one availability slot is required");
      return;
    }

    setSaving(true);
    const coachesPayload = selectedCoachIds.map((coach_id) => ({
      coach_id,
      availability: DAYS.map((d) => {
        const s = getCoachDaySlot(coach_id, d.value);
        return {
          day_of_week: d.value,
          start_time: s.start_time.length === 5 ? s.start_time : s.start_time.slice(0, 5),
          end_time: s.end_time.length === 5 ? s.end_time : s.end_time.slice(0, 5),
          is_active: s.is_active,
        };
      }),
    }));
    if (process.env.NODE_ENV === "development") {
      console.log("Saving coaches:", selectedCoachIds, coachAvailability);
    }

    const params: SaveIndividualSessionTypeParams = {
      session_type_id: existingConfig?.session_type_id ?? sessionTypeId,
      program_id: programId || (programs.find((p) => p.is_platform_owner)?.id ?? programs[0]?.id ?? ""),
      name: name.trim(),
      color,
      duration_minutes: durationMinutes,
      zoom_link: zoomLink.trim() || null,
      description: description.trim() || null,
      min_booking_notice_hours: minBookingNoticeHours,
      buffer_before_minutes: bufferBeforeMinutes,
      buffer_after_minutes: bufferAfterMinutes,
      time_slot_granularity: timeSlotGranularity,
      late_cancel_hours: lateCancelHours,
      booking_confirmation_enabled: bookingConfirmationEnabled,
      booking_confirmation_subject: bookingConfirmationSubject.trim() || null,
      booking_confirmation_body: bookingConfirmationBody.trim() || null,
      reminder_enabled: reminderEnabled,
      reminder_hours_before: reminderHoursBefore,
      reminder_subject: reminderSubject.trim() || null,
      reminder_body: reminderBody.trim() || null,
      coaches: coachesPayload,
    };

    if (existingConfig) {
      const res = await updateIndividualSessionType(existingConfig.id, params);
      if (res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
    } else {
      const res = await saveIndividualSessionType(params);
      if (res.error) {
        setError(res.error);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleDelete = async () => {
    if (!existingConfig) return;
    if (!window.confirm("Delete this individual session type?")) return;
    const res = await deleteIndividualSessionType(existingConfig.id);
    if (res.error) {
      setError(res.error);
      return;
    }
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {existingConfig ? "Edit Individual Session" : "Configure Individual Session"}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "details" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Details
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "settings" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "notifications" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            Notifications
          </button>
        </div>

        <div className={styles.body}>
          {error && <p style={{ color: "#dc3545", marginBottom: 16 }}>{error}</p>}

          {activeTab === "details" && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Session Type</label>
                <select
                  className={styles.select}
                  value={sessionTypeId}
                  onChange={(e) => setSessionTypeId(e.target.value)}
                  disabled={!!existingConfig}
                >
                  <option value="">— Select —</option>
                  {availableSessionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Session name"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Color</label>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Duration (minutes)</label>
                <input
                  type="number"
                  className={styles.input}
                  min={15}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 60)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Staff Assignment</label>
                <div className={styles.coachPills}>
                  {selectedCoachIds.map((coachId) => {
                    const coach = coaches.find((c) => c.id === coachId);
                    return (
                      <span key={coachId} className={styles.coachPill}>
                        {coach?.display_name ?? "Coach"}
                        <button
                          type="button"
                          className={styles.coachPillRemove}
                          onClick={() => {
                            setSelectedCoachIds((prev) => prev.filter((id) => id !== coachId));
                            setCoachAvailability((prev) => {
                              const next = { ...prev };
                              delete next[coachId];
                              return next;
                            });
                          }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className={styles.coachDropdownWrapper} ref={coachDropdownRef}>
                  <button
                    type="button"
                    className={styles.coachAddBtn}
                    onClick={() => setCoachDropdownOpen(!coachDropdownOpen)}
                  >
                    + Add Coach
                  </button>
                  {coachDropdownOpen && (
                    <div className={styles.coachDropdownMenu}>
                      {coaches
                        .filter((c) => !selectedCoachIds.includes(c.id))
                        .map((coach) => (
                          <button
                            key={coach.id}
                            type="button"
                            className={styles.coachDropdownItem}
                            onClick={() => {
                              setSelectedCoachIds((prev) => [...prev, coach.id]);
                              setCoachAvailability((av) => {
                                const nextAv = { ...av };
                                nextAv[coach.id] = {};
                                DAYS.forEach((d) => {
                                  nextAv[coach.id][d.value] = defaultDaySlot(d.value);
                                });
                                return nextAv;
                              });
                              setCoachDropdownOpen(false);
                            }}
                          >
                            {coach.display_name}
                          </button>
                        ))}
                      {coaches.filter((c) => !selectedCoachIds.includes(c.id)).length === 0 && (
                        <div className={styles.coachDropdownEmpty}>All coaches assigned</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedCoachIds.length > 0 && (
                <div className={styles.coachAvailabilitySection}>
                  <div className={styles.coachAvailabilityTitle}>General Availability Schedule</div>
                  <div className={styles.coachAccordion}>
                    {selectedCoachIds.map((coachId) => {
                      const coach = coaches.find((c) => c.id === coachId);
                      const isExpanded = expandedCoachId === coachId;
                      const activeDays = DAYS.filter((d) => getCoachDaySlot(coachId, d.value).is_active).length;
                      return (
                        <div key={coachId} className={styles.coachAccordionItem}>
                          <button
                            type="button"
                            className={styles.coachAccordionHeader}
                            onClick={() => setExpandedCoachId(isExpanded ? null : coachId)}
                          >
                            <span className={styles.coachAccordionName}>{coach?.display_name ?? "Coach"}</span>
                            <span className={styles.coachAccordionSummary}>{activeDays} days configured</span>
                            <span className={styles.coachAccordionChevron}>{isExpanded ? "▾" : "▸"}</span>
                          </button>
                          {isExpanded && (
                            <div className={styles.coachAccordionBody}>
                              <div className={styles.availabilityGrid}>
                                {DAYS.map((d) => {
                                  const slot = getCoachDaySlot(coachId, d.value);
                                  return (
                                    <div key={d.value} className={styles.availabilityRow}>
                                      <span className={styles.dayLabel}>{d.label}</span>
                                      <input
                                        type="checkbox"
                                        className={styles.dayToggle}
                                        checked={slot.is_active}
                                        onChange={(e) => setCoachDaySlot(coachId, d.value, "is_active", e.target.checked)}
                                      />
                                      <input
                                        type="time"
                                        className={styles.timeInput}
                                        value={slot.start_time}
                                        onChange={(e) => setCoachDaySlot(coachId, d.value, "start_time", e.target.value)}
                                        disabled={!slot.is_active}
                                      />
                                      <span className={styles.timeSeparator}>–</span>
                                      <input
                                        type="time"
                                        className={styles.timeInput}
                                        value={slot.end_time}
                                        onChange={(e) => setCoachDaySlot(coachId, d.value, "end_time", e.target.value)}
                                        disabled={!slot.is_active}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "settings" && (
            <>
              {locationType === "virtual" && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Zoom Link</label>
                  <input
                    type="url"
                    className={styles.input}
                    value={zoomLink}
                    onChange={(e) => setZoomLink(e.target.value)}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              )}
              {locationType === "on-field" && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>Location</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Field / venue name"
                  />
                </div>
              )}
              <div className={styles.formGroup}>
                <label className={styles.label}>Description / Session Plan</label>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description..."
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Minimum Booking Notice (hours)</label>
                <select
                  className={styles.select}
                  value={minBookingNoticeHours}
                  onChange={(e) => setMinBookingNoticeHours(parseInt(e.target.value, 10))}
                >
                  {[1, 2, 4, 8, 12, 24].map((h) => (
                    <option key={h} value={h}>
                      {h} hour{h !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Buffer Before Session (minutes)</label>
                <select
                  className={styles.select}
                  value={bufferBeforeMinutes}
                  onChange={(e) => setBufferBeforeMinutes(parseInt(e.target.value, 10))}
                >
                  {[0, 5, 10, 15, 30].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Buffer After Session (minutes)</label>
                <select
                  className={styles.select}
                  value={bufferAfterMinutes}
                  onChange={(e) => setBufferAfterMinutes(parseInt(e.target.value, 10))}
                >
                  {[0, 5, 10, 15, 30].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Time Slot Granularity (minutes)</label>
                <select
                  className={styles.select}
                  value={timeSlotGranularity}
                  onChange={(e) => setTimeSlotGranularity(parseInt(e.target.value, 10))}
                >
                  {[15, 20, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Late Cancellation Policy (hours before)</label>
                <select
                  className={styles.select}
                  value={lateCancelHours}
                  onChange={(e) => setLateCancelHours(parseInt(e.target.value, 10))}
                >
                  {[2, 4, 8, 12, 24, 48].map((h) => (
                    <option key={h} value={h}>
                      {h} hours
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTab === "notifications" && (
            <>
              <div className={styles.notificationSection}>
                <div className={styles.notificationHeader}>
                  <span className={styles.notificationTitle}>Booking Confirmation Email</span>
                  <button
                    type="button"
                    className={`${styles.toggle} ${bookingConfirmationEnabled ? styles.toggleActive : ""}`}
                    onClick={() => setBookingConfirmationEnabled((v) => !v)}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                </div>
                {bookingConfirmationEnabled && (
                  <div className={styles.notificationFields}>
                    <input
                      type="text"
                      className={styles.input}
                      value={bookingConfirmationSubject}
                      onChange={(e) => setBookingConfirmationSubject(e.target.value)}
                      placeholder="Subject"
                    />
                    <textarea
                      className={styles.textarea}
                      value={bookingConfirmationBody}
                      onChange={(e) => setBookingConfirmationBody(e.target.value)}
                      placeholder="Body"
                    />
                  </div>
                )}
              </div>
              <div className={styles.notificationSection}>
                <div className={styles.notificationHeader}>
                  <span className={styles.notificationTitle}>Reminder Email</span>
                  <button
                    type="button"
                    className={`${styles.toggle} ${reminderEnabled ? styles.toggleActive : ""}`}
                    onClick={() => setReminderEnabled((v) => !v)}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                </div>
                {reminderEnabled && (
                  <div className={styles.notificationFields}>
                    <label className={styles.label}>Timing (hours before)</label>
                    <select
                      className={styles.select}
                      value={reminderHoursBefore}
                      onChange={(e) => setReminderHoursBefore(parseInt(e.target.value, 10))}
                    >
                      {[1, 2, 4, 8, 12, 24].map((h) => (
                        <option key={h} value={h}>
                          {h} hour{h !== 1 ? "s" : ""} before
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className={styles.input}
                      value={reminderSubject}
                      onChange={(e) => setReminderSubject(e.target.value)}
                      placeholder="Subject"
                    />
                    <textarea
                      className={styles.textarea}
                      value={reminderBody}
                      onChange={(e) => setReminderBody(e.target.value)}
                      placeholder="Body"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.footer}>
          {existingConfig && (
            <button type="button" className={styles.deleteBtn} onClick={handleDelete}>
              Delete
            </button>
          )}
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
