import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import AvailabilityClient from "@/app/(coach)/coach/availability/availability-client";

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  const { user, profile } = await requireRole("admin");
  const coachId = profile.id ?? user.id;
  const supabase = await createClient();

  // Fetch all coaches and admins for the switcher
  const { data: coachesData } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name, role")
    .in("role", ["coach", "admin"])
    .order("full_name");

  const coachList = (coachesData || []).map(
    (c: { id: string; full_name: string | null; first_name: string | null; last_name: string | null }) => ({
      id: c.id,
      name:
        c.full_name ||
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        "Coach",
    })
  );

  // Fetch initial data for the default coach (the admin themselves)
  const [
    { data: recurringAvailability },
    { data: dateOverrides },
    { data: assignedTypes },
  ] = await Promise.all([
    supabase
      .from("coach_individual_availability")
      .select("id, individual_session_type_id, day_of_week, start_time, end_time, is_active")
      .eq("coach_id", coachId)
      .eq("is_active", true),
    supabase
      .from("coach_date_overrides")
      .select("id, override_date, is_blocked, custom_start_time, custom_end_time, reason")
      .eq("coach_id", coachId),
    supabase
      .from("coach_individual_availability")
      .select("individual_session_type_id, individual_session_types(id, name, color, location_type)")
      .eq("coach_id", coachId)
      .eq("is_active", true),
  ]);

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
      coachName={(profile.full_name as string) || (profile.first_name as string) || "Admin"}
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
      isAdmin={true}
      coaches={coachList}
    />
  );
}
