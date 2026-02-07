import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getUpcomingBookingsForCoach } from "@/lib/db";
import styles from "@/components/layout/layout.module.css";

export default async function CoachHomePage() {
  const { user } = await requireRole("coach");
  const upcomingBookings = await getUpcomingBookingsForCoach(user.id);

  return (
    <div>
      <h1 className={styles.pageTitle}>Coach home</h1>
      <p className={styles.muted}>
        Manage availability and sessions.
      </p>

      <section className={styles.widget}>
        <h2 className={styles.widgetTitle}>Upcoming sessions</h2>
        {upcomingBookings.length === 0 ? (
          <p className={styles.muted}>
            No upcoming individual sessions. Manage your availability to get booked.
          </p>
        ) : (
          <ul className={styles.widgetList}>
            {upcomingBookings.slice(0, 5).map((b) => (
              <li key={b.id} className={styles.widgetItem}>
                {b.booking_date} {b.booking_time} — {(b.session_type as { name?: string })?.name ?? "Session"} with {(b.player as { full_name?: string })?.full_name ?? "Player"}
              </li>
            ))}
          </ul>
        )}
        <Link href="/coach/availability" className={`${styles.card} ${styles.linkBlock}`}>
          Manage availability →
        </Link>
      </section>

      <div className={`${styles.cardGrid} ${styles.cardGridTop}`}>
        <Link href="/coach/availability" className={styles.card}>
          <span className={styles.cardTitle}>Availability</span>
          <p className={styles.cardDesc}>Set your available slots</p>
        </Link>
        <Link href="/dashboard/profile" className={styles.card}>
          <span className={styles.cardTitle}>Profile</span>
          <p className={styles.cardDesc}>Photo & settings</p>
        </Link>
      </div>
    </div>
  );
}
