"use client";

import { ThemeToggleSection } from "@/components/ThemeToggleSection";
import styles from "@/components/layout/layout.module.css";

export default function CoachSettingsPage() {
  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.muted}>App and coach settings.</p>
      <ThemeToggleSection />
    </div>
  );
}
