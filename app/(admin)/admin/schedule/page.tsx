import { createClient } from "@/lib/supabase/server";
import { ScheduleCalendar } from "./schedule-calendar";

/** Recurring sessions require recurring_group_id on sessions. Run in Supabase SQL editor:
 *  ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS recurring_group_id UUID DEFAULT NULL;
 *  CREATE INDEX IF NOT EXISTS idx_sessions_recurring_group ON public.sessions(recurring_group_id);
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export type SessionForCalendar = {
  id: string;
  coach_id: string;
  assistant_coach_ids: string[] | null;
  gk_coach_id: string | null;
  title: string | null;
  session_type: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  attendance_limit: number;
  current_reservations: number;
  location_type: string;
  location: string | null;
  zoom_link: string | null;
  description: string | null;
  session_plan: string | null;
  status: string;
  program_id: string;
  recurring_group_id: string | null;
};

export type CoachOption = { id: string; display_name: string };

export type ProgramOption = { id: string; name: string; slug: string; is_platform_owner: boolean };

export type SessionTypeOption = {
  id: string;
  name: string;
  color: string;
  category: string;
  program_id: string | null;
  is_default: boolean;
  sort_order: number;
  allow_individual?: boolean;
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
  location_type?: "on-field" | "virtual";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  coach_individual_availability?: CoachIndividualAvailabilityRow[];
};

export default async function AdminSchedulePage() {
  const supabase = await createClient();

  const { data: sessionsData } = await supabase
    .from("sessions")
    .select(
      "id, coach_id, assistant_coach_ids, gk_coach_id, title, session_type, session_date, session_time, duration_minutes, attendance_limit, location_type, location, zoom_link, description, session_plan, status, program_id, recurring_group_id"
    )
    .in("status", ["scheduled", "in-progress"])
    .order("session_date", { ascending: true })
    .order("session_time", { ascending: true });

  const calendarSessionIds = (sessionsData ?? []).map((s: Record<string, unknown>) => s.id as string);
  const calendarCountMap: Record<string, number> = {};
  if (calendarSessionIds.length > 0) {
    const { data: countData } = await supabase
      .from("session_reservations")
      .select("session_id")
      .in("session_id", calendarSessionIds)
      .eq("reservation_status", "reserved");
    (countData ?? []).forEach((r: { session_id: string }) => {
      calendarCountMap[r.session_id] = (calendarCountMap[r.session_id] || 0) + 1;
    });
  }

  const { data: coachesData } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["coach", "admin"])
    .order("full_name", { nullsFirst: false });

  const { data: programsData } = await supabase
    .from("programs")
    .select("id, name, slug, is_platform_owner")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const sessions: SessionForCalendar[] = (sessionsData ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    coach_id: s.coach_id as string,
    assistant_coach_ids: (s.assistant_coach_ids as string[] | null) ?? null,
    gk_coach_id: (s.gk_coach_id as string | null) ?? null,
    title: (s.title as string) ?? null,
    session_type: (s.session_type as string) ?? "",
    session_date: (s.session_date as string) ?? "",
    session_time: (s.session_time as string) ?? "",
    duration_minutes: (s.duration_minutes as number) ?? 60,
    attendance_limit: (s.attendance_limit as number) ?? 0,
    current_reservations: calendarCountMap[s.id as string] ?? 0,
    location_type: (s.location_type as string) ?? "on-field",
    location: (s.location as string) ?? null,
    zoom_link: (s.zoom_link as string) ?? null,
    description: (s.description as string) ?? null,
    session_plan: (s.session_plan as string) ?? null,
    status: (s.status as string) ?? "scheduled",
    program_id: s.program_id as string,
    recurring_group_id: (s.recurring_group_id as string) ?? null,
  }));

  const coaches: CoachOption[] = (coachesData ?? []).map(
    (c: { id: string; full_name: string | null }) => ({
      id: c.id,
      display_name: (c.full_name ?? "").trim() || "Coach",
    })
  );

  const programs: ProgramOption[] = (programsData ?? []).map((p: { id: string; name: string; slug: string; is_platform_owner: boolean }) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    is_platform_owner: p.is_platform_owner,
  }));

  const { data: sessionTypesData } = await supabase
    .from("session_types")
    .select("id, name, color, category, program_id, is_default, sort_order, allow_individual")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const sessionTypes: SessionTypeOption[] = (sessionTypesData ?? []).map(
    (row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      color: (row.color as string) ?? "#4a90d9",
      category: (row.category as string) ?? "both",
      program_id: row.program_id as string | null,
      is_default: (row.is_default as boolean) ?? false,
      sort_order: (row.sort_order as number) ?? 0,
      allow_individual: (row.allow_individual as boolean) ?? false,
    })
  );

  const { data: individualSessionTypesData } = await supabase
    .from("individual_session_types")
    .select("*, coach_individual_availability(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const individualSessionTypes: IndividualSessionType[] = (individualSessionTypesData ?? []).map(
    (row: Record<string, unknown>) => ({
      id: row.id as string,
      session_type_id: row.session_type_id as string,
      program_id: row.program_id as string,
      name: row.name as string,
      color: (row.color as string) ?? "#4a90d9",
      duration_minutes: (row.duration_minutes as number) ?? 60,
      zoom_link: (row.zoom_link as string) ?? null,
      description: (row.description as string) ?? null,
      min_booking_notice_hours: (row.min_booking_notice_hours as number) ?? 24,
      buffer_before_minutes: (row.buffer_before_minutes as number) ?? 0,
      buffer_after_minutes: (row.buffer_after_minutes as number) ?? 0,
      time_slot_granularity: (row.time_slot_granularity as number) ?? 30,
      late_cancel_hours: (row.late_cancel_hours as number) ?? 24,
      booking_confirmation_enabled: (row.booking_confirmation_enabled as boolean) ?? true,
      booking_confirmation_subject: (row.booking_confirmation_subject as string) ?? null,
      booking_confirmation_body: (row.booking_confirmation_body as string) ?? null,
      reminder_enabled: (row.reminder_enabled as boolean) ?? true,
      reminder_hours_before: (row.reminder_hours_before as number) ?? null,
      reminder_subject: (row.reminder_subject as string) ?? null,
      reminder_body: (row.reminder_body as string) ?? null,
      location_type: (row.location_type as "on-field" | "virtual") ?? undefined,
      is_active: (row.is_active as boolean) ?? true,
      created_at: (row.created_at as string) ?? "",
      updated_at: (row.updated_at as string) ?? "",
      coach_individual_availability: (row.coach_individual_availability as CoachIndividualAvailabilityRow[]) ?? [],
    })
  );

  return (
    <div>
      <ScheduleCalendar
        sessions={sessions}
        coaches={coaches}
        programs={programs}
        sessionTypes={sessionTypes}
        individualSessionTypes={individualSessionTypes}
      />
    </div>
  );
}
