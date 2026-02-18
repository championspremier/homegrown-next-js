"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserWithProfile } from "@/lib/auth";
import { isValidRole } from "@/lib/role";

function normalizeTime(t: string): string {
  if (/^\d{1,2}:\d{2}$/.test(t)) return `${t}:00`;
  return t;
}

export type UpdateRoleResult = { error: string | null };

export type CreateGroupSessionParams = {
  coach_id: string;
  assistant_coach_ids?: string[] | null;
  gk_coach_id?: string | null;
  title: string;
  session_type: string;
  session_date: string; // YYYY-MM-DD
  session_time: string; // HH:MM
  duration_minutes: number;
  attendance_limit: number;
  location_type: "on-field" | "virtual";
  location?: string | null;
  zoom_link?: string | null;
  description?: string | null;
  program_id: string;
};

export type CreateGroupSessionResult = { error: string | null; sessionId?: string };
export type UpdateGroupSessionResult = { error: string | null };
export type DeleteGroupSessionResult = { error: string | null };

export type CreateAvailabilityResult = { error: string | null };
export type DeleteAvailabilityResult = { error: string | null };

function assertSessionAllowed(result: NonNullable<Awaited<ReturnType<typeof getAuthUserWithProfile>>>) {
  const role = (result.profile?.role ?? "").toLowerCase();
  if (role !== "admin" && role !== "coach") return "Only admins and coaches can manage sessions";
  return null;
}

function validateSessionDate(s: string): string | null {
  if (!s?.trim()) return "Session date is required";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!match) return "Session date must be YYYY-MM-DD";
  const [, y, m, d] = match;
  const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
  if (date.getFullYear() !== parseInt(y!, 10) || date.getMonth() !== parseInt(m!, 10) - 1 || date.getDate() !== parseInt(d!, 10))
    return "Invalid session date";
  return null;
}

function validateSessionTime(s: string): string | null {
  if (!s?.trim()) return "Session time is required";
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(s.trim())) return "Session time must be HH:MM or HH:MM:SS";
  return null;
}

/**
 * Create a group session. Admins and coaches can call this.
 * Virtual sessions always use the Homegrown program; on-field uses the provided program_id.
 */
export async function createGroupSession(params: CreateGroupSessionParams): Promise<CreateGroupSessionResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertSessionAllowed(result);
  if (authError) return { error: authError };

  const {
    coach_id,
    assistant_coach_ids,
    gk_coach_id,
    title,
    session_type,
    session_date,
    session_time,
    duration_minutes,
    attendance_limit,
    location_type,
    location,
    zoom_link,
    description,
    program_id,
  } = params;

  if (!coach_id?.trim()) return { error: "Coach is required" };
  if (!title?.trim()) return { error: "Title is required" };
  if (!session_type?.trim()) return { error: "Session type is required" };
  const dateErr = validateSessionDate(session_date);
  if (dateErr) return { error: dateErr };
  const timeErr = validateSessionTime(session_time);
  if (timeErr) return { error: timeErr };
  if (typeof duration_minutes !== "number" || duration_minutes < 1) return { error: "Duration must be at least 1 minute" };
  if (typeof attendance_limit !== "number" || attendance_limit < 0) return { error: "Attendance limit must be 0 or greater" };
  const locType = (location_type ?? "").toLowerCase();
  if (locType !== "virtual" && locType !== "on-field") return { error: "Location type must be 'virtual' or 'on-field'" };

  let effectiveProgramId: string;
  const supabase = await createClient();

  if (locType === "virtual") {
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("is_platform_owner", true)
      .limit(1)
      .maybeSingle();
    if (!program?.id) return { error: "Homegrown program not found" };
    effectiveProgramId = program.id;
  } else {
    if (!program_id?.trim()) return { error: "Program is required for on-field sessions" };
    effectiveProgramId = program_id.trim();
  }

  const timeNormalized = /^\d{1,2}:\d{2}$/.test(session_time.trim()) ? `${session_time.trim()}:00` : session_time.trim();

  const { data: row, error } = await supabase
    .from("sessions")
    .insert({
      coach_id: coach_id.trim(),
      assistant_coach_ids: Array.isArray(assistant_coach_ids) ? assistant_coach_ids : [],
      gk_coach_id: gk_coach_id?.trim() ?? null,
      title: title.trim(),
      session_type: session_type.trim(),
      session_date: session_date.trim(),
      session_time: timeNormalized,
      duration_minutes,
      attendance_limit,
      location_type: locType,
      location: location?.trim() ?? null,
      zoom_link: zoom_link?.trim() ?? null,
      description: description?.trim() ?? null,
      program_id: effectiveProgramId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/admin/schedule", "page");
  revalidatePath("/admin/schedule", "layout");
  return { error: null, sessionId: row?.id };
}

/** Partial params for update; same validation for provided fields. */
export type UpdateGroupSessionParams = Partial<
  Omit<CreateGroupSessionParams, "coach_id" | "assistant_coach_ids" | "gk_coach_id">
> & { coach_id?: string; assistant_coach_ids?: string[] | null; gk_coach_id?: string | null; session_plan?: string | null; recurring_group_id?: string | null };

export type CreateRecurringSessionsParams = CreateGroupSessionParams & {
  repeatsFrequency: "daily" | "weekly" | "monthly";
  repeatsEnd: "never" | "on-date" | "after";
  repeatsEndDate?: string | null;
  repeatsOccurrences?: number;
};

export type CreateRecurringSessionsResult = { error: string | null };
export type UpdateRecurringSessionsResult = { error: string | null };
export type DeleteRecurringSessionsResult = { error: string | null };

/**
 * Update a group session. Admins and coaches. Virtual sessions keep program_id as Homegrown.
 */
export async function updateGroupSession(
  sessionId: string,
  partialParams: UpdateGroupSessionParams
): Promise<UpdateGroupSessionResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertSessionAllowed(result);
  if (authError) return { error: authError };

  if (!sessionId?.trim()) return { error: "Session id is required" };

  const supabase = await createClient();

  if (partialParams.session_type != null && !(partialParams.session_type as string)?.trim()) {
    return { error: "Session type is required" };
  }
  if (partialParams.session_date != null) {
    const dateErr = validateSessionDate(partialParams.session_date);
    if (dateErr) return { error: dateErr };
  }
  if (partialParams.session_time != null) {
    const timeErr = validateSessionTime(partialParams.session_time);
    if (timeErr) return { error: timeErr };
  }
  if (partialParams.duration_minutes != null && (typeof partialParams.duration_minutes !== "number" || partialParams.duration_minutes < 1))
    return { error: "Duration must be at least 1 minute" };
  if (partialParams.attendance_limit != null && (typeof partialParams.attendance_limit !== "number" || partialParams.attendance_limit < 0))
    return { error: "Attendance limit must be 0 or greater" };
  if (partialParams.location_type != null) {
    const lt = (partialParams.location_type as string).toLowerCase();
    if (lt !== "virtual" && lt !== "on-field") return { error: "Location type must be 'virtual' or 'on-field'" };
  }

  const payload: Record<string, unknown> = {};
  if (partialParams.coach_id !== undefined) payload.coach_id = partialParams.coach_id?.trim() ?? null;
  if (partialParams.assistant_coach_ids !== undefined) payload.assistant_coach_ids = Array.isArray(partialParams.assistant_coach_ids) ? partialParams.assistant_coach_ids : [];
  if (partialParams.gk_coach_id !== undefined) payload.gk_coach_id = partialParams.gk_coach_id?.trim() ?? null;
  if (partialParams.title !== undefined) payload.title = partialParams.title?.trim() ?? null;
  if (partialParams.session_type !== undefined) payload.session_type = partialParams.session_type?.trim() ?? null;
  if (partialParams.session_date !== undefined) payload.session_date = partialParams.session_date?.trim() ?? null;
  if (partialParams.session_time !== undefined) {
    const t = (partialParams.session_time as string).trim();
    payload.session_time = /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t;
  }
  if (partialParams.duration_minutes !== undefined) payload.duration_minutes = partialParams.duration_minutes;
  if (partialParams.attendance_limit !== undefined) payload.attendance_limit = partialParams.attendance_limit;
  if (partialParams.location_type !== undefined) payload.location_type = (partialParams.location_type as string).toLowerCase();
  if (partialParams.location !== undefined) payload.location = partialParams.location?.trim() ?? null;
  if (partialParams.zoom_link !== undefined) payload.zoom_link = partialParams.zoom_link?.trim() ?? null;
  if (partialParams.description !== undefined) payload.description = partialParams.description?.trim() ?? null;
  if (partialParams.session_plan !== undefined) payload.session_plan = partialParams.session_plan?.trim() ?? null;
  if (partialParams.recurring_group_id !== undefined) payload.recurring_group_id = partialParams.recurring_group_id ?? null;

  if (partialParams.location_type !== undefined) {
    const lt = (partialParams.location_type as string).toLowerCase();
    if (lt === "virtual") {
      const { data: program } = await supabase
        .from("programs")
        .select("id")
        .eq("is_platform_owner", true)
        .limit(1)
        .maybeSingle();
      if (program?.id) payload.program_id = program.id;
    } else if (partialParams.program_id?.trim()) {
      payload.program_id = partialParams.program_id.trim();
    }
  } else if (partialParams.program_id !== undefined && partialParams.program_id?.trim()) {
    payload.program_id = partialParams.program_id.trim();
  }

  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase.from("sessions").update(payload).eq("id", sessionId.trim());

  if (!error) {
    revalidatePath("/admin/schedule", "page");
    revalidatePath("/admin/schedule", "layout");
  }
  return { error: error?.message ?? null };
}

/**
 * Delete a group session by id. Admins and coaches.
 */
export async function deleteGroupSession(sessionId: string): Promise<DeleteGroupSessionResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertSessionAllowed(result);
  if (authError) return { error: authError };

  if (!sessionId?.trim()) return { error: "Session id is required" };

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId.trim());

  if (!error) {
    revalidatePath("/admin/schedule", "page");
    revalidatePath("/admin/schedule", "layout");
  }
  return { error: error?.message ?? null };
}

function getRecurringSessionDates(params: CreateRecurringSessionsParams): string[] {
  const { session_date, repeatsFrequency, repeatsEnd, repeatsEndDate, repeatsOccurrences } = params;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(session_date.trim());
  if (!match) return [];
  const dates: string[] = [];
  let y = parseInt(match[1]!, 10);
  let m = parseInt(match[2]!, 10) - 1;
  let d = parseInt(match[3]!, 10);
  const maxByFreq = { daily: 365, weekly: 52, monthly: 12 } as const;
  const cap = maxByFreq[repeatsFrequency];
  let count = 0;
  const endDate = repeatsEnd === "on-date" && repeatsEndDate?.trim() ? new Date(repeatsEndDate.trim()) : null;
  const maxOccurrences = repeatsEnd === "after" ? Math.min(100, Math.max(2, repeatsOccurrences ?? 10)) : cap;

  while (true) {
    const dateStr = `${y}-${(m + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    dates.push(dateStr);
    count++;
    if (repeatsEnd === "on-date" && endDate) {
      const cur = new Date(y, m, d);
      if (cur > endDate) break;
    } else if (repeatsEnd === "after" && count >= maxOccurrences) break;
    else if (repeatsEnd === "never" && count >= cap) break;

    if (repeatsFrequency === "daily") {
      const next = new Date(y, m, d + 1);
      y = next.getFullYear();
      m = next.getMonth();
      d = next.getDate();
    } else if (repeatsFrequency === "weekly") {
      const next = new Date(y, m, d + 7);
      y = next.getFullYear();
      m = next.getMonth();
      d = next.getDate();
    } else {
      const next = new Date(y, m + 1, d);
      y = next.getFullYear();
      m = next.getMonth();
      d = next.getDate();
    }
  }
  return dates;
}

/**
 * Create multiple sessions in a recurring series. All share the same recurring_group_id.
 */
export async function createRecurringSessions(params: CreateRecurringSessionsParams): Promise<CreateRecurringSessionsResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertSessionAllowed(result);
  if (authError) return { error: authError };

  const supabase = await createClient();
  let effectiveProgramId: string;
  const locType = (params.location_type ?? "").toLowerCase();
  if (locType === "virtual") {
    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("is_platform_owner", true)
      .limit(1)
      .maybeSingle();
    if (!program?.id) return { error: "Homegrown program not found" };
    effectiveProgramId = program.id;
  } else {
    if (!params.program_id?.trim()) return { error: "Program is required for on-field sessions" };
    effectiveProgramId = params.program_id.trim();
  }

  const timeNormalized = /^\d{1,2}:\d{2}$/.test(params.session_time.trim()) ? `${params.session_time.trim()}:00` : params.session_time.trim();
  const recurringGroupId = randomUUID();
  const sessionDates = getRecurringSessionDates(params);
  if (sessionDates.length === 0) return { error: "No session dates generated" };

  const assistantIds = Array.isArray(params.assistant_coach_ids) ? params.assistant_coach_ids : [];
  const gkCoachId = params.gk_coach_id?.trim() ?? null;
  const rows = sessionDates.map((session_date) => ({
    coach_id: params.coach_id.trim(),
    assistant_coach_ids: assistantIds,
    gk_coach_id: gkCoachId,
    title: params.title.trim(),
    session_type: params.session_type.trim(),
    session_date,
    session_time: timeNormalized,
    duration_minutes: params.duration_minutes,
    attendance_limit: params.attendance_limit,
    location_type: locType,
    location: params.location?.trim() ?? null,
    zoom_link: params.zoom_link?.trim() ?? null,
    description: params.description?.trim() ?? null,
    program_id: effectiveProgramId,
    recurring_group_id: recurringGroupId,
  }));

  const { error } = await supabase.from("sessions").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/admin/schedule", "page");
  revalidatePath("/admin/schedule", "layout");
  return { error: null };
}

/** Params for updating a recurring series (no session_date; each session keeps its own date). */
export type UpdateRecurringSessionsParams = {
  session_type?: string;
  coach_id?: string;
  assistant_coach_ids?: string[] | null;
  gk_coach_id?: string | null;
  title?: string;
  session_time?: string;
  duration_minutes?: number;
  attendance_limit?: number;
  location_type?: string;
  location?: string | null;
  zoom_link?: string | null;
  description?: string | null;
  session_plan?: string | null;
  program_id?: string;
};

/**
 * Update all sessions in a recurring series. Does not change session_date.
 */
export async function updateRecurringSessions(
  recurringGroupId: string,
  partialParams: UpdateRecurringSessionsParams
): Promise<UpdateRecurringSessionsResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertSessionAllowed(result);
  if (authError) return { error: authError };

  if (!recurringGroupId?.trim()) return { error: "Recurring group id is required" };

  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  if (partialParams.coach_id !== undefined) payload.coach_id = partialParams.coach_id?.trim() ?? null;
  if (partialParams.assistant_coach_ids !== undefined) payload.assistant_coach_ids = Array.isArray(partialParams.assistant_coach_ids) ? partialParams.assistant_coach_ids : [];
  if (partialParams.gk_coach_id !== undefined) payload.gk_coach_id = partialParams.gk_coach_id?.trim() ?? null;
  if (partialParams.title !== undefined) payload.title = partialParams.title?.trim() ?? null;
  if (partialParams.session_type !== undefined) payload.session_type = partialParams.session_type?.trim() ?? null;
  if (partialParams.session_time !== undefined) {
    const t = (partialParams.session_time as string).trim();
    payload.session_time = /^\d{1,2}:\d{2}$/.test(t) ? `${t}:00` : t;
  }
  if (partialParams.duration_minutes !== undefined) payload.duration_minutes = partialParams.duration_minutes;
  if (partialParams.attendance_limit !== undefined) payload.attendance_limit = partialParams.attendance_limit;
  if (partialParams.location_type !== undefined) payload.location_type = (partialParams.location_type as string).toLowerCase();
  if (partialParams.location !== undefined) payload.location = partialParams.location?.trim() ?? null;
  if (partialParams.zoom_link !== undefined) payload.zoom_link = partialParams.zoom_link?.trim() ?? null;
  if (partialParams.description !== undefined) payload.description = partialParams.description?.trim() ?? null;
  if (partialParams.session_plan !== undefined) payload.session_plan = partialParams.session_plan?.trim() ?? null;
  if (partialParams.program_id !== undefined) payload.program_id = partialParams.program_id?.trim() ?? null;

  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase.from("sessions").update(payload).eq("recurring_group_id", recurringGroupId.trim());
  if (!error) {
    revalidatePath("/admin/schedule", "page");
    revalidatePath("/admin/schedule", "layout");
  }
  return { error: error?.message ?? null };
}

/**
 * Delete all sessions in a recurring series.
 */
export async function deleteRecurringSessions(recurringGroupId: string): Promise<DeleteRecurringSessionsResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertSessionAllowed(result);
  if (authError) return { error: authError };

  if (!recurringGroupId?.trim()) return { error: "Recurring group id is required" };

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("recurring_group_id", recurringGroupId.trim());
  if (!error) {
    revalidatePath("/admin/schedule", "page");
    revalidatePath("/admin/schedule", "layout");
  }
  return { error: error?.message ?? null };
}

/**
 * Create a coach availability block. Only admins. RLS allows admins to insert into coach_availability.
 * Rejects duplicate (same coach_id, day_of_week, start_time, end_time).
 */
export async function createAvailability(params: {
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}): Promise<CreateAvailabilityResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  if (result.profile.role !== "admin") return { error: "Only admins can manage availability" };

  const { coach_id, day_of_week, start_time, end_time } = params;
  if (!coach_id?.trim()) return { error: "Coach is required" };
  if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6) return { error: "Invalid day" };
  if (!start_time?.trim()) return { error: "Start time is required" };
  if (!end_time?.trim()) return { error: "End time is required" };

  const start = normalizeTime(start_time.trim());
  const end = normalizeTime(end_time.trim());
  if (start >= end) return { error: "Start time must be before end time" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("coach_availability")
    .select("id")
    .eq("coach_id", coach_id.trim())
    .eq("day_of_week", day_of_week)
    .eq("start_time", start)
    .eq("end_time", end)
    .limit(1);
  if (existing?.length) return { error: "This availability block already exists for this coach." };

  const { error } = await supabase.from("coach_availability").insert({
    coach_id: coach_id.trim(),
    day_of_week,
    start_time: start,
    end_time: end,
  });

  return { error: error?.message ?? null };
}

/**
 * Delete a coach availability block. Only admins. RLS allows admins to delete.
 */
export async function deleteAvailability(params: { id: string }): Promise<DeleteAvailabilityResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  if (result.profile.role !== "admin") return { error: "Only admins can manage availability" };

  const { id } = params;
  if (!id?.trim()) return { error: "Invalid id" };

  const supabase = await createClient();
  const { error } = await supabase.from("coach_availability").delete().eq("id", id.trim());

  return { error: error?.message ?? null };
}

/* ========== Individual session types (1-on-1 bookable) ========== */

export type CoachAvailabilitySlot = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type SaveIndividualSessionTypeParams = {
  session_type_id: string;
  program_id: string;
  name: string;
  color: string;
  duration_minutes: number;
  location_type: "on-field" | "virtual";
  zoom_link?: string | null;
  description?: string | null;
  min_booking_notice_hours: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  time_slot_granularity: number;
  late_cancel_hours: number;
  booking_confirmation_enabled: boolean;
  booking_confirmation_subject?: string | null;
  booking_confirmation_body?: string | null;
  reminder_enabled: boolean;
  reminder_hours_before?: number | null;
  reminder_subject?: string | null;
  reminder_body?: string | null;
  coaches: Array<{
    coach_id: string;
    location?: string | null;
    availability: CoachAvailabilitySlot[];
  }>;
};

export type SaveIndividualSessionTypeResult = { error: string | null; id?: string };
export type DeleteIndividualSessionTypeResult = { error: string | null };

function assertAdmin(result: NonNullable<Awaited<ReturnType<typeof getAuthUserWithProfile>>>) {
  if (result.profile?.role !== "admin") return "Only admins can manage individual session types";
  return null;
}

export async function saveIndividualSessionType(params: SaveIndividualSessionTypeParams): Promise<SaveIndividualSessionTypeResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertAdmin(result);
  if (authError) return { error: authError };

  const supabase = await createClient();
  const {
    session_type_id,
    program_id,
    name,
    color,
    duration_minutes,
    zoom_link,
    description,
    min_booking_notice_hours,
    buffer_before_minutes,
    buffer_after_minutes,
    time_slot_granularity,
    late_cancel_hours,
    booking_confirmation_enabled,
    booking_confirmation_subject,
    booking_confirmation_body,
    reminder_enabled,
    reminder_hours_before,
    reminder_subject,
    reminder_body,
    coaches,
  } = params;

  if (!session_type_id?.trim()) return { error: "Session type is required" };
  if (!program_id?.trim()) return { error: "Program is required" };
  if (!name?.trim()) return { error: "Name is required" };
  if (!coaches?.length) return { error: "At least one coach is required" };
  const hasAvailability = coaches.some((c) => c.availability?.some((a) => a.is_active));
  if (!hasAvailability) return { error: "At least one availability slot is required" };

  const timeNorm = (t: string) => (/^\d{1,2}:\d{2}$/.test((t ?? "").trim()) ? `${(t as string).trim()}:00` : (t ?? "").trim());

  let locationTypeValue = params.location_type;
  if (!locationTypeValue && session_type_id) {
    const { data: stRow } = await supabase
      .from("session_types")
      .select("category")
      .eq("id", session_type_id.trim())
      .single();
    if (stRow) {
      locationTypeValue = stRow.category === "virtual" ? "virtual" : "on-field";
    }
  }

  const { data: row, error: insertError } = await supabase
    .from("individual_session_types")
    .insert({
      session_type_id: session_type_id.trim(),
      program_id: program_id.trim(),
      name: name.trim(),
      color: (color ?? "#4a90d9").trim(),
      duration_minutes: duration_minutes ?? 60,
      zoom_link: zoom_link?.trim() ?? null,
      description: description?.trim() ?? null,
      location_type: locationTypeValue || "virtual",
      min_booking_notice_hours: min_booking_notice_hours ?? 24,
      buffer_before_minutes: buffer_before_minutes ?? 0,
      buffer_after_minutes: buffer_after_minutes ?? 0,
      time_slot_granularity: time_slot_granularity ?? 30,
      late_cancel_hours: late_cancel_hours ?? 24,
      booking_confirmation_enabled: !!booking_confirmation_enabled,
      booking_confirmation_subject: booking_confirmation_subject?.trim() ?? null,
      booking_confirmation_body: booking_confirmation_body?.trim() ?? null,
      reminder_enabled: !!reminder_enabled,
      reminder_hours_before: reminder_hours_before ?? 24,
      reminder_subject: reminder_subject?.trim() ?? null,
      reminder_body: reminder_body?.trim() ?? null,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  const individualSessionTypeId = row?.id;
  if (!individualSessionTypeId) return { error: "Failed to create individual session type" };

  await supabase
    .from("coach_individual_availability")
    .delete()
    .eq("individual_session_type_id", individualSessionTypeId);

  for (const coach of coaches) {
    if (!coach.coach_id?.trim()) continue;
    const slots = coach.availability?.filter((a) => a.is_active && a.start_time && a.end_time) ?? [];
    if (slots.length) {
      const rows = slots.map((a) => ({
        individual_session_type_id: individualSessionTypeId,
        coach_id: coach.coach_id.trim(),
        day_of_week: a.day_of_week,
        start_time: timeNorm(a.start_time),
        end_time: timeNorm(a.end_time),
        is_active: true,
        location: coach.location ?? null,
      }));
      await supabase.from("coach_individual_availability").insert(rows);
    }
  }

  revalidatePath("/admin/schedule", "page");
  revalidatePath("/admin/schedule", "layout");
  return { error: null, id: individualSessionTypeId };
}

export async function updateIndividualSessionType(
  id: string,
  params: SaveIndividualSessionTypeParams
): Promise<SaveIndividualSessionTypeResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertAdmin(result);
  if (authError) return { error: authError };

  if (!id?.trim()) return { error: "ID is required" };

  const supabase = await createClient();
  const {
    session_type_id,
    program_id,
    name,
    color,
    duration_minutes,
    zoom_link,
    description,
    min_booking_notice_hours,
    buffer_before_minutes,
    buffer_after_minutes,
    time_slot_granularity,
    late_cancel_hours,
    booking_confirmation_enabled,
    booking_confirmation_subject,
    booking_confirmation_body,
    reminder_enabled,
    reminder_hours_before,
    reminder_subject,
    reminder_body,
    coaches,
  } = params;

  if (!name?.trim()) return { error: "Name is required" };
  if (!coaches?.length) return { error: "At least one coach is required" };
  const hasAvailability = coaches.some((c) => c.availability?.some((a) => a.is_active));
  if (!hasAvailability) return { error: "At least one availability slot is required" };

  const timeNorm = (t: string) => (/^\d{1,2}:\d{2}$/.test((t ?? "").trim()) ? `${(t as string).trim()}:00` : (t ?? "").trim());

  let locationTypeValue = params.location_type;
  if (!locationTypeValue && session_type_id) {
    const { data: stRow } = await supabase
      .from("session_types")
      .select("category")
      .eq("id", session_type_id.trim())
      .single();
    if (stRow) {
      locationTypeValue = stRow.category === "virtual" ? "virtual" : "on-field";
    }
  }

  const { error: updateError } = await supabase
    .from("individual_session_types")
    .update({
      session_type_id: session_type_id?.trim() ?? undefined,
      program_id: program_id?.trim() ?? undefined,
      name: name.trim(),
      color: (color ?? "#4a90d9").trim(),
      duration_minutes: duration_minutes ?? 60,
      zoom_link: zoom_link?.trim() ?? null,
      description: description?.trim() ?? null,
      location_type: locationTypeValue || "virtual",
      min_booking_notice_hours: min_booking_notice_hours ?? 24,
      buffer_before_minutes: buffer_before_minutes ?? 0,
      buffer_after_minutes: buffer_after_minutes ?? 0,
      time_slot_granularity: time_slot_granularity ?? 30,
      late_cancel_hours: late_cancel_hours ?? 24,
      booking_confirmation_enabled: !!booking_confirmation_enabled,
      booking_confirmation_subject: booking_confirmation_subject?.trim() ?? null,
      booking_confirmation_body: booking_confirmation_body?.trim() ?? null,
      reminder_enabled: !!reminder_enabled,
      reminder_hours_before: reminder_hours_before ?? 24,
      reminder_subject: reminder_subject?.trim() ?? null,
      reminder_body: reminder_body?.trim() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.trim());

  if (updateError) return { error: updateError.message };

  await supabase
    .from("coach_individual_availability")
    .delete()
    .eq("individual_session_type_id", id.trim());

  for (const coach of coaches) {
    if (!coach.coach_id?.trim()) continue;
    const slots = coach.availability?.filter((a) => a.is_active && a.start_time && a.end_time) ?? [];
    if (slots.length) {
      const rows = slots.map((a) => ({
        individual_session_type_id: id.trim(),
        coach_id: coach.coach_id.trim(),
        day_of_week: a.day_of_week,
        start_time: timeNorm(a.start_time),
        end_time: timeNorm(a.end_time),
        is_active: true,
        location: coach.location ?? null,
      }));
      await supabase.from("coach_individual_availability").insert(rows);
    }
  }

  revalidatePath("/admin/schedule", "page");
  revalidatePath("/admin/schedule", "layout");
  return { error: null, id: id.trim() };
}

export async function deleteIndividualSessionType(id: string): Promise<DeleteIndividualSessionTypeResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  const authError = assertAdmin(result);
  if (authError) return { error: authError };

  if (!id?.trim()) return { error: "ID is required" };

  const supabase = await createClient();
  const { error } = await supabase.from("coach_individual_availability").delete().eq("individual_session_type_id", id.trim());
  if (error) return { error: error.message };
  const { error: err2 } = await supabase.from("individual_session_types").delete().eq("id", id.trim());
  if (err2) return { error: err2.message };
  revalidatePath("/admin/schedule", "page");
  revalidatePath("/admin/schedule", "layout");
  return { error: null };
}

export type IndividualSessionTypeRow = {
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CoachIndividualAvailabilityRow = {
  id: string;
  individual_session_type_id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export async function fetchIndividualSessionTypes(_programId?: string | null) {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { data: null, error: "Not authenticated" };
  const authError = assertAdmin(result);
  if (authError) return { data: null, error: authError };

  const supabase = await createClient();
  const q = supabase
    .from("individual_session_types")
    .select("*, coach_individual_availability(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (_programId?.trim()) q.eq("program_id", _programId.trim());
  const { data, error } = await q;
  return { data: data ?? [], error: error?.message ?? null };
}

/**
 * Update a user's role. Only admins can call this.
 * RLS allows admins to update any profile; this action enforces admin check and validates role.
 */
export async function updateUserRole(userId: string, newRole: string): Promise<UpdateRoleResult> {
  const result = await getAuthUserWithProfile();
  if (!result?.profile) return { error: "Not authenticated" };
  if (result.profile.role !== "admin") return { error: "Only admins can change roles" };

  const role = newRole?.trim().toLowerCase();
  if (!role || !isValidRole(role)) return { error: "Invalid role" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  return { error: error?.message ?? null };
}
