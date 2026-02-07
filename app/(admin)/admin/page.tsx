import Link from "next/link";
import styles from "@/components/layout/layout.module.css";

export default function AdminHomePage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Admin home</h1>
      <p className={styles.muted}>
        Admin tools and settings.
      </p>
      <div className={styles.cardGrid}>
        <Link href="/admin/users" className={styles.card}>
          <span className={styles.cardTitle}>Users</span>
          <p className={styles.cardDesc}>Manage users and roles</p>
        </Link>
        <Link href="/admin/settings" className={styles.card}>
          <span className={styles.cardTitle}>Settings</span>
          <p className={styles.cardDesc}>App and org settings</p>
        </Link>
        <Link href="/dashboard/profile" className={styles.card}>
          <span className={styles.cardTitle}>Profile</span>
          <p className={styles.cardDesc}>Photo & settings</p>
        </Link>
      </div>
    </div>
  );
}
