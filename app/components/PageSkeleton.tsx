import styles from "./PageSkeleton.module.css";

interface Props {
  variant?: "home" | "schedule" | "dashboard" | "table" | "settings" | "default";
}

export default function PageSkeleton({ variant = "default" }: Props) {
  if (variant === "home") {
    return (
      <div className={styles.container}>
        <div className={styles.leaderboardRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.leaderboardItem}>
              <div className={`${styles.shimmer} ${styles.avatarCircle}`} />
              <div className={`${styles.shimmer} ${styles.textSmall}`} />
              <div className={`${styles.shimmer} ${styles.textTiny}`} />
            </div>
          ))}
        </div>
        <div className={styles.toggleRow}>
          <div className={`${styles.shimmer} ${styles.toggleCard}`} />
          <div className={`${styles.shimmer} ${styles.toggleCardActive}`} />
        </div>
        <div className={styles.calendarRow}>
          <div className={`${styles.shimmer} ${styles.calNavBtn}`} />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={styles.calDay}>
              <div className={`${styles.shimmer} ${styles.textTiny}`} />
              <div className={`${styles.shimmer} ${styles.calDayCircle}`} />
            </div>
          ))}
          <div className={`${styles.shimmer} ${styles.calNavBtn}`} />
        </div>
        <div className={styles.sessionRow}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={`${styles.shimmer} ${styles.sessionCard}`} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div>
            <div className={`${styles.shimmer} ${styles.textLarge}`} />
            <div className={`${styles.shimmer} ${styles.textMedium}`} style={{ marginTop: 8 }} />
          </div>
        </div>
        <div className={styles.sectionTitle}>
          <div className={`${styles.shimmer} ${styles.textMedium}`} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${styles.shimmer} ${styles.listItem}`} />
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={styles.container}>
        <div className={styles.shimmer} style={{ width: 120, height: 28, borderRadius: 6, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <div className={styles.shimmer} style={{ width: 200, height: 40, borderRadius: 10 }} />
          <div style={{ flex: 1 }} />
          <div className={styles.shimmer} style={{ width: 160, height: 36, borderRadius: 8 }} />
          <div className={styles.shimmer} style={{ width: 200, height: 36, borderRadius: 8 }} />
        </div>
        <div className={styles.shimmer} style={{ width: "100%", height: 44, borderRadius: "8px 8px 0 0", marginBottom: 1 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles.shimmer} style={{ width: "100%", height: 56, borderRadius: 0, marginBottom: 1, opacity: 1 - i * 0.08 }} />
        ))}
      </div>
    );
  }

  if (variant === "settings") {
    return (
      <div className={styles.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div className={styles.shimmer} style={{ width: 180, height: 28, borderRadius: 6 }} />
          <div className={styles.shimmer} style={{ width: 140, height: 40, borderRadius: 8 }} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.shimmer} style={{ width: "100%", height: 120, borderRadius: 12, marginBottom: 16, opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  if (variant === "schedule") {
    return (
      <div className={styles.container}>
        <div className={styles.centerRow}>
          <div className={`${styles.shimmer} ${styles.textMedium}`} />
        </div>
        <div className={styles.calendarRow}>
          <div className={`${styles.shimmer} ${styles.calNavBtn}`} />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={styles.calDay}>
              <div className={`${styles.shimmer} ${styles.textTiny}`} />
              <div className={`${styles.shimmer} ${styles.calDayCircle}`} />
            </div>
          ))}
          <div className={`${styles.shimmer} ${styles.calNavBtn}`} />
        </div>
        <div className={styles.centerRow}>
          <div className={`${styles.shimmer} ${styles.textSmall}`} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`${styles.shimmer} ${styles.slotCard}`} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={`${styles.shimmer} ${styles.textLarge}`} />
      <div className={`${styles.shimmer} ${styles.textMedium}`} style={{ marginTop: 12 }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={`${styles.shimmer} ${styles.listItem}`} style={{ marginTop: 16 }} />
      ))}
    </div>
  );
}
