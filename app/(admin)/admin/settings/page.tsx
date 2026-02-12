"use client";

import Link from "next/link";
import { ThemeToggleSection } from "@/components/ThemeToggleSection";
import styles from "@/components/layout/layout.module.css";

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.muted}>
        App and org settings. (Placeholder — connect to settings when ready.)
      </p>
      <ThemeToggleSection />
      <Link href="/admin" className={`${styles.card} ${styles.linkBlock}`}>
        ← Back to admin home
      </Link>
    </div>
  );
}
