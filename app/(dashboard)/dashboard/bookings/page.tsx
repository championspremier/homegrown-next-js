import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActivePlayerIdServer } from "@/lib/active-player";
import { getLinkedPlayers } from "@/lib/db";
import {
  getUpcomingGroupReservations,
  getUpcomingIndividualBookings,
} from "@/lib/db";
import Link from "next/link";
import styles from "@/components/layout/layout.module.css";

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activePlayerId = await getActivePlayerIdServer();
  const linkedPlayers = await getLinkedPlayers(user.id);
  const effectivePlayerId = activePlayerId ?? user.id;

  const [groupReservations, individualBookings] = await Promise.all([
    getUpcomingGroupReservations(effectivePlayerId),
    getUpcomingIndividualBookings(effectivePlayerId),
  ]);

  const { data: coachesData } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "coach");
  const coaches = (coachesData ?? []) as { id: string; full_name: string | null }[];

  return (
    <div>
      <h1 className={styles.pageTitle}>Bookings</h1>
      <p className={styles.muted}>
        Group reservations and individual sessions.
      </p>

      <section className={styles.sectionBottom}>
        <h2 className={styles.sectionTitle}>Individual sessions</h2>
        {individualBookings.length === 0 ? (
          <p className={styles.mutedSmall}>No upcoming individual sessions.</p>
        ) : (
          <ul className={styles.listUnstyled}>
            {individualBookings.map((b: Record<string, unknown>) => (
              <li key={String(b.id)} className={styles.bookingItem}>
                {String(b.booking_date)} {String(b.booking_time)} —{" "}
                {(b.session_type as { name?: string })?.name ?? "Session"} with{" "}
                {(b.coach as { full_name?: string })?.full_name ?? "Coach"} ({String(b.status)})
              </li>
            ))}
          </ul>
        )}
        {coaches.length ? (
          <p className={`${styles.mutedSmall} ${styles.marginTop}`}>
            Book:{" "}
            {coaches.map((c) => (
              <Link key={c.id} href={`/schedule/${c.id}`} className={styles.coachLink}>
                {c.full_name ?? c.id}
              </Link>
            ))}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Group reservations</h2>
        {groupReservations.length === 0 ? (
          <p className={styles.mutedSmall}>No upcoming group reservations.</p>
        ) : (
          <ul className={styles.listUnstyled}>
            {groupReservations.map((r: Record<string, unknown>) => (
              <li key={String(r.id)} className={styles.bookingItem}>
                {(r.group_session as { title?: string; session_date?: string; session_time?: string })?.title ??
                  "Group"} —{" "}
                {(r.group_session as { session_date?: string })?.session_date}{" "}
                {(r.group_session as { session_time?: string })?.session_time} ({String(r.status)})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
