import Link from "next/link";
import styles from "@/components/layout/layout.module.css";

export default function CoachAvailabilityPage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Availability</h1>
      <p className={styles.muted}>
        Manage your available slots. (Placeholder — connect to coach_availability when ready.)
      </p>
      <Link href="/coach" className={`${styles.card} ${styles.linkBlock}`}>
        ← Back to coach home
      </Link>
    </div>
  );
}
