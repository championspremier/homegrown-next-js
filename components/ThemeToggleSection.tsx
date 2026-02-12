"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, toggleTheme as doToggleTheme } from "@/lib/theme";
import styles from "@/components/layout/layout.module.css";

export function ThemeToggleSection() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  return (
    <section className={styles.widget}>
      <h2 className={styles.widgetTitle}>Appearance</h2>
      <div className={styles.themeRow}>
        <span className={styles.themeLabel}>Theme</span>
        <div className={styles.themeButtons}>
          <button
            type="button"
            className={theme === "light" ? styles.themeBtnActive : styles.themeBtn}
            onClick={() => theme !== "light" && setTheme(doToggleTheme())}
            aria-pressed={theme === "light"}
          >
            <Sun size={18} />
            Light
          </button>
          <button
            type="button"
            className={theme === "dark" ? styles.themeBtnActive : styles.themeBtn}
            onClick={() => theme !== "dark" && setTheme(doToggleTheme())}
            aria-pressed={theme === "dark"}
          >
            <Moon size={18} />
            Dark
          </button>
        </div>
      </div>
    </section>
  );
}
