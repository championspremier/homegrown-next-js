import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { ScheduleCalendar } from "@/app/(admin)/admin/schedule/schedule-calendar";
import type {
  SessionForCalendar,
  CoachOption,
  ProgramOption,
  SessionTypeOption,
} from "@/app/(admin)/admin/schedule/page";

export const dynamic = "force-dynamic";

export default async function CoachSchedulePage() {
  const { profile } = await requireRole("coach");
  const supabase = await createClient();

  const { data: sessionsData } = await supabase
    .from("sessions")
    .select(
      "id, coach_id, assistant_coach_ids, gk_coach_id, title, session_type, session_date, session_time, duration_minutes, attendance_limit, current_reservations, location_type, location, zoom_link, description, session_plan, status, program_id, recurring_group_id"
    )
    .or(
      `coach_id.eq.${profile.id},assistant_coach_ids.cs.{${profile.id}},gk_coach_id.eq.${profile.id}`
    )
    .in("status", ["scheduled", "in-progress"])
    .order("session_date", { ascending: true })
    .order("session_time", { ascending: true });

  const sessions: SessionForCalendar[] = (sessionsData ?? []).map(
    (s: Record<string, unknown>) => ({
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
      current_reservations: (s.current_reservations as number) ?? 0,
      location_type: (s.location_type as string) ?? "on-field",
      location: (s.location as string) ?? null,
      zoom_link: (s.zoom_link as string) ?? null,
      description: (s.description as string) ?? null,
      session_plan: (s.session_plan as string) ?? null,
      status: (s.status as string) ?? "scheduled",
      program_id: s.program_id as string,
      recurring_group_id: (s.recurring_group_id as string) ?? null,
    })
  );

  const allCoachIds = new Set<string>();
  allCoachIds.add(profile.id);
  sessions.forEach((s) => {
    if (s.coach_id) allCoachIds.add(s.coach_id);
    if (s.gk_coach_id) allCoachIds.add(s.gk_coach_id);
    if (Array.isArray(s.assistant_coach_ids)) {
      s.assistant_coach_ids.forEach((id) => allCoachIds.add(id));
    }
  });

  const { data: coachesData } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("id", Array.from(allCoachIds));

  const coaches: CoachOption[] = (coachesData ?? []).map(
    (c: { id: string; full_name: string | null }) => ({
      id: c.id,
      display_name: (c.full_name ?? "").trim() || "Coach",
    })
  );

  const { data: programsData } = await supabase
    .from("programs")
    .select("id, name, slug, is_platform_owner")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const programs: ProgramOption[] = (programsData ?? []).map(
    (p: { id: string; name: string; slug: string; is_platform_owner: boolean }) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      is_platform_owner: p.is_platform_owner,
    })
  );

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

  return (
    <div>
      <ScheduleCalendar
        sessions={sessions}
        coaches={coaches}
        programs={programs}
        sessionTypes={sessionTypes}
        role="coach"
        currentCoachId={profile.id}
      />
    </div>
  );
}
