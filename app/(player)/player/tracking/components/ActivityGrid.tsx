"use client";

import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Info } from "lucide-react";
import styles from "./ActivityGrid.module.css";

interface ActivityDay {
  date: string;
  count: number;
  types: string[];
}

interface Props {
  activityData: ActivityDay[];
  eliteTargetHours?: number;
  weeklyTotalHours?: number;
}

interface SelectedDay {
  date: string;
  count: number;
  types: string[];
  x: number;
  y: number;
}

type FilterRange = "year" | "quarter" | "6months" | "all";

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_COLORS: Record<string, string> = {
  "Solo Session": "#3b82f6",
  "Solo": "#3b82f6",
  "HG_TECHNICAL": "#3b82f6",
  "Tec Tac": "#8b5cf6",
  "CPP": "#8b5cf6",
  "Speed Training": "#eab308",
  "HG_SPEED": "#eab308",
  "speed": "#eab308",
  "Strength & Conditioning": "#ef4444",
  "strength": "#ef4444",
  "team-training": "#22c55e",
  "Team Training": "#22c55e",
  "Training": "#22c55e",
  "individual-session": "#8b5cf6",
  "Individual Session": "#8b5cf6",
  "HG_MENTAL": "#14b8a6",
  "HG_TACTICAL_REEL": "#f97316",
  "Session": "#6b7280",
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? "var(--muted)";
}

function getColorLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function getFilterStartDate(filter: FilterRange): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  switch (filter) {
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case "6months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return d;
    }
    case "year": {
      return new Date(now.getFullYear(), 0, 1);
    }
    case "all":
    default: {
      const d = new Date(now);
      d.setDate(d.getDate() - 364);
      return d;
    }
  }
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function groupTypes(types: string[]): { type: string; count: number }[] {
  const map = new Map<string, number>();
  for (const t of types) map.set(t, (map.get(t) ?? 0) + 1);
  return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
}

export default function ActivityGrid({ activityData, eliteTargetHours = 8, weeklyTotalHours = 0 }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const dayTooltipRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterRange>("year");
  const [showInfo, setShowInfo] = useState(false);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);

  const dataMap = useMemo(() => {
    const m = new Map<string, ActivityDay>();
    for (const d of activityData) m.set(d.date, d);
    return m;
  }, [activityData]);

  const { allWeeks, allMonthLabels, totalActiveDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    const weeks: { date: string; count: number; types: string[]; dateObj: Date }[][] = [];
    const labels: { label: string; col: number }[] = [];
    let activeDays = 0;
    let lastMonth = -1;

    const cursor = new Date(startDate);
    let weekIdx = 0;

    while (cursor <= today || weeks.length < 53) {
      const week: { date: string; count: number; types: string[]; dateObj: Date }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = cursor.toISOString().split("T")[0];
        const entry = dataMap.get(dateStr);
        const count = entry?.count ?? 0;
        const types = entry?.types ?? [];
        if (count > 0 && cursor <= today) activeDays++;
        week.push({
          date: dateStr,
          count: cursor > today ? -1 : count,
          types,
          dateObj: new Date(cursor),
        });

        const m = cursor.getMonth();
        if (d === 0 && m !== lastMonth) {
          labels.push({ label: MONTH_NAMES[m], col: weekIdx });
          lastMonth = m;
        }

        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
      weekIdx++;
      if (weeks.length >= 53) break;
    }

    return { allWeeks: weeks, allMonthLabels: labels, totalActiveDays: activeDays };
  }, [dataMap]);

  const { weeks, monthLabels } = useMemo(() => {
    const filterStart = getFilterStartDate(filter);
    const filteredWeeks: typeof allWeeks = [];
    const filteredLabels: { label: string; col: number }[] = [];

    let newCol = 0;
    for (let wi = 0; wi < allWeeks.length; wi++) {
      const week = allWeeks[wi];
      const weekEnd = week[6]?.dateObj ?? week[week.length - 1].dateObj;
      if (weekEnd < filterStart) continue;

      filteredWeeks.push(week);

      const matchingLabel = allMonthLabels.find((l) => l.col === wi);
      if (matchingLabel) {
        filteredLabels.push({ label: matchingLabel.label, col: newCol });
      }
      newCol++;
    }

    return { weeks: filteredWeeks, monthLabels: filteredLabels };
  }, [allWeeks, allMonthLabels, filter]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [filter]);

  // Close info tooltip on outside click
  const handleInfoClickOutside = useCallback((e: MouseEvent) => {
    if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
      setShowInfo(false);
    }
  }, []);

  useEffect(() => {
    if (showInfo) {
      document.addEventListener("mousedown", handleInfoClickOutside);
      return () => document.removeEventListener("mousedown", handleInfoClickOutside);
    }
  }, [showInfo, handleInfoClickOutside]);

  // Close day tooltip on outside click
  const handleDayClickOutside = useCallback((e: MouseEvent) => {
    if (dayTooltipRef.current && !dayTooltipRef.current.contains(e.target as Node)) {
      setSelectedDay(null);
    }
  }, []);

  useEffect(() => {
    if (selectedDay) {
      document.addEventListener("mousedown", handleDayClickOutside);
      return () => document.removeEventListener("mousedown", handleDayClickOutside);
    }
  }, [selectedDay, handleDayClickOutside]);

  function handleCellClick(day: { date: string; count: number; types: string[] }, e: React.MouseEvent) {
    if (day.count <= 0) return;

    if (selectedDay?.date === day.date) {
      setSelectedDay(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let x = rect.left + rect.width / 2;
    let y = rect.bottom + 8;

    // If near bottom, show above
    if (y + 160 > viewportH) {
      y = rect.top - 8;
    }

    // Clamp horizontal to viewport
    const tooltipW = 220;
    x = Math.max(tooltipW / 2 + 8, Math.min(x, viewportW - tooltipW / 2 - 8));

    setSelectedDay({ date: day.date, count: day.count, types: day.types, x, y });
  }

  const tooltipAbove = selectedDay ? selectedDay.y < 100 ? false : selectedDay.y + 160 > window.innerHeight : false;

  return (
    <div className={styles.container}>
      {/* Top bar: summary + controls */}
      <div className={styles.topBar}>
        <p className={styles.summary}>
          <strong>{totalActiveDays}</strong> activities in the last year
        </p>

        <div className={styles.controls}>
          <select
            className={styles.filterSelect}
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterRange)}
          >
            <option value="year">This Year</option>
            <option value="quarter">This Quarter</option>
            <option value="6months">Last 6 Months</option>
            <option value="all">All Time</option>
          </select>

          <div className={styles.infoWrap} ref={infoRef}>
            <button
              className={styles.infoBtn}
              onClick={() => setShowInfo((p) => !p)}
              type="button"
              aria-label="Training info"
            >
              <Info size={15} />
            </button>
            {showInfo && (
              <div className={styles.tooltip}>
                Elite players train consistently at <strong>{eliteTargetHours} hrs/week</strong>.
                You&apos;ve logged <strong>{weeklyTotalHours} hrs</strong> this week.
                Stay consistent &mdash; time is always running out.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.scrollWrapper} ref={scrollRef}>
        <div className={styles.gridOuter}>
          {/* Month labels */}
          <div className={styles.monthRow}>
            <div className={styles.dayLabelSpacer} />
            <div
              className={styles.monthLabels}
              style={{ gridTemplateColumns: `repeat(${weeks.length}, 13px)` }}
            >
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className={styles.monthLabel}
                  style={{ gridColumnStart: m.col + 1 }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.gridRow}>
            <div className={styles.dayLabels}>
              {DAY_LABELS.map((label, i) => (
                <span key={i} className={styles.dayLabel}>{label}</span>
              ))}
            </div>

            <div className={styles.grid}>
              {weeks.map((week, wi) => (
                <div key={wi} className={styles.weekCol}>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`${styles.cell} ${day.count < 0 ? styles.cellFuture : ""} ${day.count > 0 ? styles.cellActive : ""}`}
                      data-level={day.count < 0 ? -1 : getColorLevel(day.count)}
                      title={
                        day.count < 0
                          ? ""
                          : day.count === 0
                            ? `${day.date}: No activities`
                            : `${day.date}: ${day.count} activit${day.count === 1 ? "y" : "ies"} (${day.types.join(", ")})`
                      }
                      onClick={(e) => handleCellClick(day, e)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendText}>Less</span>
        <div className={styles.cell} data-level="0" />
        <div className={styles.cell} data-level="1" />
        <div className={styles.cell} data-level="2" />
        <div className={styles.cell} data-level="3" />
        <div className={styles.cell} data-level="4" />
        <span className={styles.legendText}>More</span>
      </div>

      {/* Day tooltip */}
      {selectedDay && (
        <div
          ref={dayTooltipRef}
          className={styles.dayTooltip}
          style={{
            left: selectedDay.x,
            top: tooltipAbove ? undefined : selectedDay.y,
            bottom: tooltipAbove ? `calc(100vh - ${selectedDay.y}px + 8px)` : undefined,
            transform: "translateX(-50%)",
          }}
        >
          <p className={styles.dayTooltipDate}>{formatFullDate(selectedDay.date)}</p>
          <p className={styles.dayTooltipCount}>
            {selectedDay.count} activit{selectedDay.count === 1 ? "y" : "ies"}
          </p>
          <div className={styles.dayTooltipList}>
            {groupTypes(selectedDay.types).map((item, i) => (
              <div key={i} className={styles.dayTooltipItem}>
                <span
                  className={styles.dayTooltipDot}
                  style={{ backgroundColor: getTypeColor(item.type) }}
                />
                <span>
                  {item.count > 1 ? `${item.count}x ` : ""}
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
