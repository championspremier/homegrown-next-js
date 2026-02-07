import Link from "next/link";
import { getActiveProfileIdFromCookies } from "@/lib/active-profile";
import { getLinkedPlayers, getPlayerDashboard, getUpcomingGroupReservations, getUpcomingIndividualBookings } from "@/lib/db";
import { requireActiveRole } from "@/lib/auth";
import styles from "@/components/layout/layout.module.css";

export default async function ParentHomePage() {
  const { user, activeProfile } = await requireActiveRole("parent");
  const linkedPlayers = await getLinkedPlayers(activeProfile.id);
  const activeProfileId = await getActiveProfileIdFromCookies();
  const effectivePlayerId = activeProfileId && activeProfileId !== activeProfile.id ? activeProfileId : linkedPlayers[0]?.player_id ?? user.id;

  const [dashboard, groupReservations, individualBookings] = await Promise.all([
    getPlayerDashboard(effectivePlayerId),
    getUpcomingGroupReservations(effectivePlayerId),
    getUpcomingIndividualBookings(effectivePlayerId),
  ]);

  const activeName = dashboard?.profile.full_name ?? dashboard?.profile.email ?? "Active player";

  return (
    <div>
      <h1 className={styles.pageTitle}>Parent home</h1>
      <p className={styles.muted}>
        Manage your linked players, bookings, and profile.
      </p>

      {dashboard && (
        <section className={styles.widget}>
          <h2 className={styles.widgetTitle}>Active player</h2>
          <p className={styles.mutedNoMargin}>
            {activeName} — {dashboard.upcomingGroupCount + dashboard.upcomingIndividualCount} upcoming
          </p>
          <Link href="/dashboard/player" className={`${styles.card} ${styles.linkBlock}`}>
            View player →
          </Link>
        </section>
      )}

      <section className={styles.widget}>
        <h2 className={styles.widgetTitle}>Upcoming bookings</h2>
        {individualBookings.length === 0 && groupReservations.length === 0 ? (
          <p className={styles.muted}>No upcoming sessions.</p>
        ) : (
          <ul className={styles.widgetList}>
            {individualBookings.slice(0, 5).map((b) => (
              <li key={b.id} className={styles.widgetItem}>
                {b.booking_date} {b.booking_time} — {(b.session_type as { name?: string })?.name ?? "Session"} with {(b.coach as { full_name?: string })?.full_name ?? "Coach"}
              </li>
            ))}
            {groupReservations.slice(0, 5).map((r) => (
              <li key={r.id} className={styles.widgetItem}>
                {(r.group_session as { title?: string })?.title ?? "Group"} — {(r.group_session as { session_date?: string })?.session_date} {(r.group_session as { session_time?: string })?.session_time}
              </li>
            ))}
          </ul>
        )}
        <Link href="/dashboard/bookings" className={`${styles.card} ${styles.linkBlock}`}>
          View all bookings →
        </Link>
      </section>

      <div className={`${styles.cardGrid} ${styles.cardGridTop}`}>
        <Link href="/dashboard/player" className={styles.card}>
          <span className={styles.cardTitle}>Player</span>
          <p className={styles.cardDesc}>Overview & context</p>
        </Link>
        <Link href="/dashboard/bookings" className={styles.card}>
          <span className={styles.cardTitle}>Bookings</span>
          <p className={styles.cardDesc}>Group & individual sessions</p>
        </Link>
        <Link href="/dashboard/profile" className={styles.card}>
          <span className={styles.cardTitle}>Profile</span>
          <p className={styles.cardDesc}>Photo & settings</p>
        </Link>
      </div>
    </div>
  );
}
