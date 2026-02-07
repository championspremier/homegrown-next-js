import Link from "next/link";
import styles from "@/components/layout/layout.module.css";

export default function PlayerHomePage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Player home</h1>
      <p className={styles.muted}>
        Your sessions and bookings.
      </p>
      <div className={styles.cardGrid}>
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
