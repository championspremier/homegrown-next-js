"use client";

import { ReactNode } from "react";
import styles from "./layout.module.css";

interface TopbarProps {
  onMenuToggle: () => void;
  rightSlot?: ReactNode;
}

export function Topbar({ onMenuToggle, rightSlot }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <button
          type="button"
          className={styles.menuToggle}
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>
      <div className={styles.topbarRight}>
        {rightSlot}
        <form method="POST" action="/api/auth/signout">
          <button type="submit" className={styles.signOutBtn}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
