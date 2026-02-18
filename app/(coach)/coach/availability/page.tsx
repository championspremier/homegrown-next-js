import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import AvailabilityClient from "./availability-client";

export default async function CoachAvailabilityPage() {
  const { user, profile } = await requireRole("coach");
  const coachId = profile.id ?? user.id;
  const supabase = await createClient();

  // Fetch this coach's recurring availability
  const { data: recurringAvailability } = await supabase
    .from("coach_individual_availability")
    .select("id, individual_session_type_id, day_of_week, start_time, end_time, is_active")
    .eq("coach_id", coachId)
    .eq("is_active", true);

  // Fetch this coach's date overrides
  const { data: dateOverrides } = await supabase
    .from("coach_date_overrides")
    .select("id, override_date, is_blocked, custom_start_time, custom_end_time, reason")
    .eq("coach_id", coachId);

  // Fetch individual session types this coach is assigned to
  const { data: assignedTypes } = await supabase
    .from("coach_individual_availability")
    .select("individual_session_type_id, individual_session_types(id, name, color, location_type)")
    .eq("coach_id", coachId)
    .eq("is_active", true);

  // Deduplicate session types
  const sessionTypes = Array.from(
    new Map(
      (assignedTypes || [])
        .filter((a: Record<string, unknown>) => a.individual_session_types)
        .map((a: Record<string, unknown>) => {
          const st = a.individual_session_types as { id: string; name: string; color: string | null; location_type: string };
          return [st.id, st] as const;
        })
    ).values()
  );

  return (
    <AvailabilityClient
      coachId={coachId}
      coachName={(profile.full_name as string) || (profile.first_name as string) || "Coach"}
      recurringAvailability={recurringAvailability || []}
      dateOverrides={(dateOverrides || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        override_date: d.override_date as string,
        is_blocked: d.is_blocked as boolean,
        custom_start_time: (d.custom_start_time as string) || null,
        custom_end_time: (d.custom_end_time as string) || null,
        reason: (d.reason as string) || null,
      }))}
      sessionTypes={sessionTypes}
    />
  );
}
