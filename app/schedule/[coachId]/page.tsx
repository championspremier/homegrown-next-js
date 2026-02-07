import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActivePlayerIdServer } from "@/lib/active-player";
import { getLinkedPlayers } from "@/lib/db";
import ScheduleCoach from "./schedule-coach";
import styles from "../schedule.module.css";

interface PageProps {
  params: Promise<{ coachId: string }>;
}

export default async function ScheduleCoachPage({ params }: PageProps) {
  const { coachId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: coachData } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", coachId)
    .eq("role", "coach")
    .single();
  const coach = coachData as { id: string; full_name: string | null } | null;
  if (!coach) notFound();

  const { data: sessionTypesData } = await supabase
    .from("session_types")
    .select("id, name, duration_minutes")
    .order("name");
  const sessionTypes = (sessionTypesData ?? []) as { id: string; name: string; duration_minutes: number }[];
  const linkedPlayers = await getLinkedPlayers(user.id);
  const activePlayerId = await getActivePlayerIdServer();
  const playerId = activePlayerId ?? (linkedPlayers[0]?.player_id ?? user.id);

  return (
    <main className={styles.scheduleMain}>
      <h1 className={styles.scheduleTitle}>Book with {coach.full_name ?? "Coach"}</h1>
      <p className={styles.scheduleMuted}>
        Choose a session type and available slot.
      </p>
      <ScheduleCoach
        coachId={coachId}
        coachName={coach.full_name ?? "Coach"}
        sessionTypes={sessionTypes}
        parentId={user.id}
        playerId={playerId}
        linkedPlayers={linkedPlayers}
      />
    </main>
  );
}
