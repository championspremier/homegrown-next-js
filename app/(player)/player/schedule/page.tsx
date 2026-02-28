import { createClient } from "@/lib/supabase/server";
import { requireActiveRole } from "@/lib/auth";
import PlayerScheduleClient from "./schedule-client";
import styles from "./schedule.module.css";

export type PlayerIndividualSessionType = {
  id: string;
  name: string;
  duration_minutes: number;
  time_slot_granularity: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  location_type: string; // "on-field" or "virtual"
  location: string | null;
  description: string | null;
  color?: string | null;
  zoom_link?: string | null;
  min_booking_notice_hours?: number;
};

export default async function PlayerSchedulePage() {
  const { user, activeProfile } = await requireActiveRole("player");
  const playerId = activeProfile.id;

  const supabase = await createClient();

  const { data: relationship } = await supabase
    .from("parent_player_relationships")
    .select("parent_id")
    .eq("player_id", playerId)
    .limit(1)
    .maybeSingle();
  const parentId = (relationship as { parent_id: string } | null)?.parent_id ?? null;

  const { data: onFieldRows } = await supabase
    .from("sessions")
    .select("session_type")
    .eq("location_type", "on-field")
    .eq("status", "scheduled");
  const onFieldSessionTypes = [
    ...new Set(
      (onFieldRows ?? [])
        .map((r: { session_type: string | null }) => r.session_type)
        .filter((s): s is string => s != null && s !== "")
    ),
  ].sort();

  const { data: virtualGroupRows } = await supabase
    .from("sessions")
    .select("session_type")
    .eq("location_type", "virtual")
    .eq("status", "scheduled");
  const virtualGroupSessionTypes = [
    ...new Set(
      (virtualGroupRows ?? [])
        .map((r: { session_type: string | null }) => r.session_type)
        .filter((s): s is string => s != null && s !== "")
    ),
  ].sort();

  // Fetch all unique coach IDs from scheduled sessions (server-side bypasses RLS)
  const { data: allSessions } = await supabase
    .from("sessions")
    .select("coach_id, assistant_coach_ids, gk_coach_id")
    .eq("status", "scheduled")
    .not("coach_id", "is", null);

  const allCoachIds = new Set<string>();
  (allSessions ?? []).forEach((s: { coach_id: string | null; assistant_coach_ids: string[] | null; gk_coach_id: string | null }) => {
    if (s.coach_id) allCoachIds.add(s.coach_id);
    if (s.gk_coach_id) allCoachIds.add(s.gk_coach_id);
    if (Array.isArray(s.assistant_coach_ids)) {
      s.assistant_coach_ids.forEach((id: string) => allCoachIds.add(id));
    }
  });
  const uniqueCoachIds = [...allCoachIds];

  let coachNames: Record<string, string> = {};
  const coachFullNames: Record<string, string> = {};
  const coachProfileDetails: Record<string, { coachRole: string; profilePhotoUrl: string | null; teamLogos: string[] }> = {};
  if (uniqueCoachIds.length > 0) {
    const { data: coachProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, first_name, coach_role, team_logos, profile_photo_url")
      .in("id", uniqueCoachIds);

    if (coachProfiles) {
      for (const p of coachProfiles as Record<string, unknown>[]) {
        const id = p.id as string;
        const firstName = (p.first_name as string)?.trim() || (p.full_name as string)?.split(" ")[0]?.trim() || "Coach";
        coachNames[id] = `Coach ${firstName}`;
        coachFullNames[id] = (p.full_name as string)?.trim() || (p.first_name as string)?.trim() || "Coach";

        let photoUrl: string | null = (p.profile_photo_url as string) || null;
        if (!photoUrl) {
          const { data: photoFiles } = await supabase.storage
            .from("profile-photos")
            .list(id, { limit: 1, search: "avatar" });
          if (photoFiles && photoFiles.length > 0) {
            const { data: photoData } = supabase.storage
              .from("profile-photos")
              .getPublicUrl(`${id}/${photoFiles[0].name}`);
            photoUrl = photoData?.publicUrl || null;
          }
        }

        coachProfileDetails[id] = {
          coachRole: (p.coach_role as string) || "Coach",
          profilePhotoUrl: photoUrl,
          teamLogos: (p.team_logos as string[]) || [],
        };
      }
    }
  }

  // Fetch group session type colors
  const { data: sessionTypesRows } = await supabase
    .from("session_types")
    .select("name, color")
    .eq("is_active", true);
  const sessionTypeColors: Record<string, string> = {};
  (sessionTypesRows ?? []).forEach((row: { name: string; color: string | null }) => {
    if (row.name && row.color) sessionTypeColors[row.name] = row.color;
  });

  const { data: individualRows } = await supabase
    .from("individual_session_types")
    .select("id, name, duration_minutes, time_slot_granularity, buffer_before_minutes, buffer_after_minutes, location_type, location, description, color, zoom_link, min_booking_notice_hours")
    .eq("is_active", true)
    .order("name");
  const allIndividual: PlayerIndividualSessionType[] = (individualRows ?? []).map(
    (row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      duration_minutes: (row.duration_minutes as number) ?? 60,
      time_slot_granularity: (row.time_slot_granularity as number) ?? 30,
      buffer_before_minutes: (row.buffer_before_minutes as number) ?? 0,
      buffer_after_minutes: (row.buffer_after_minutes as number) ?? 0,
      location_type: (row.location_type as string) ?? "on-field",
      location: (row.location as string) ?? null,
      description: (row.description as string) ?? null,
      color: (row.color as string) ?? null,
      zoom_link: (row.zoom_link as string) ?? null,
      min_booking_notice_hours: (row.min_booking_notice_hours as number) ?? 8,
    })
  );
  const onFieldIndividualSessionTypes = allIndividual.filter((t) => t.location_type === "on-field");
  const virtualIndividualSessionTypes = allIndividual.filter((t) => t.location_type === "virtual");

  let onFieldProgramLogoUrl: string | null = null;
  const { data: onFieldProgramSession } = await supabase
    .from("sessions")
    .select("program_id")
    .eq("location_type", "on-field")
    .eq("status", "scheduled")
    .not("program_id", "is", null)
    .limit(1)
    .maybeSingle();

  const programId = (onFieldProgramSession as Record<string, unknown> | null)?.program_id as string | null;
  if (programId) {
    const { data: programData } = await supabase
      .from("programs")
      .select("logo_url")
      .eq("id", programId)
      .single();
    onFieldProgramLogoUrl = ((programData ?? null) as Record<string, unknown> | null)?.logo_url as string | null;
  }

  return (
    <div className={styles.scheduleContainer}>
      <h1 className={styles.pageTitle}>Schedule</h1>
      <PlayerScheduleClient
        playerId={playerId}
        parentId={parentId}
        onFieldSessionTypes={onFieldSessionTypes}
        virtualGroupSessionTypes={virtualGroupSessionTypes}
        onFieldIndividualSessionTypes={onFieldIndividualSessionTypes}
        virtualIndividualSessionTypes={virtualIndividualSessionTypes}
        coachNames={coachNames}
        coachFullNames={coachFullNames}
        sessionTypeColors={sessionTypeColors}
        coachProfileDetails={coachProfileDetails}
        onFieldProgramLogoUrl={onFieldProgramLogoUrl}
      />
    </div>
  );
}
