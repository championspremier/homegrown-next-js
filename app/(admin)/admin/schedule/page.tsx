import { createClient } from "@/lib/supabase/server";
import { SessionsTable, type SessionRow, type CoachOption } from "./sessions-table";
import styles from "@/components/layout/layout.module.css";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const supabase = await createClient();

  const { data: sessionsData } = await supabase
    .from("sessions")
    .select("id, type, starts_at, ends_at, capacity, coach_id, coach:profiles!coach_id(full_name, email)")
    .order("starts_at", { ascending: true });

  const { data: coachesData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "coach")
    .order("full_name", { nullsFirst: false });

  const sessions: SessionRow[] = (sessionsData ?? []).map((s: Record<string, unknown>) => {
    const coach = (s.coach ?? s.profiles) as { full_name?: string | null; email?: string | null } | null;
    return {
      id: s.id as string,
      type: s.type as string,
      starts_at: s.starts_at as string,
      ends_at: s.ends_at as string,
      capacity: s.capacity as number,
      coach_id: s.coach_id as string,
      coach_name: coach?.full_name ?? null,
      coach_email: coach?.email ?? null,
    };
  });

  const coaches: CoachOption[] = (coachesData ?? []).map((c: { id: string; full_name: string | null; email: string | null }) => ({
    id: c.id,
    full_name: c.full_name ?? null,
    email: c.email ?? null,
  }));

  return (
    <div>
      <h1 className={styles.pageTitle}>Schedule</h1>
      <p className={styles.muted}>
        View and create sessions. Only admins can manage the schedule.
      </p>
      <SessionsTable sessions={sessions} coaches={coaches} />
    </div>
  );
}
