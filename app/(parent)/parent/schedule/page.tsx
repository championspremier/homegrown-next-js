import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import ParentScheduleClient from "./parent-schedule-client";
import type { PlayerIndividualSessionType } from "@/app/(player)/player/schedule/page";

export default async function ParentSchedulePage() {
  const { user } = await requireRole("parent");
  const parentId = user.id;

  const supabase = await createClient();

  const { data: relationships } = await supabase
    .from("parent_player_relationships")
    .select("player_id")
    .eq("parent_id", parentId);

  const playerIds = (relationships ?? []).map((r: { player_id: string }) => r.player_id);

  let players: { id: string; first_name: string | null; last_name: string | null }[] = [];
  if (playerIds.length > 0) {
    const { data: playerProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", playerIds);

    players = (playerProfiles ?? []).map((p: { id: string; first_name: string | null; last_name: string | null }) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
    }));
  }

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

  const coachNames: Record<string, string> = {};
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
    <ParentScheduleClient
      parentId={parentId}
      players={players}
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
  );
}