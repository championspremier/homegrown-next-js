"use client";

import styles from "./SpiderChart.module.css";

interface Axis {
  key: string;
  label: string;
  coachOnly: boolean;
}

interface Props {
  axes: Axis[];
  scores: Record<string, number | null>;
}

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 85;
const LEVELS = [2, 4, 6, 8, 10];
const LABEL_R = R + 30;

function polarToXY(cx: number, cy: number, angle: number, radius: number): [number, number] {
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
}

function polygonPoints(n: number, radius: number, startAngle: number): string {
  return Array.from({ length: n }, (_, i) => {
    const angle = startAngle + (2 * Math.PI * i) / n;
    const [x, y] = polarToXY(CX, CY, angle, radius);
    return `${x},${y}`;
  }).join(" ");
}

function getTextAnchor(angle: number): string {
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg > 45 && deg < 135) return "middle";
  if (deg >= 135 && deg <= 225) return "end";
  if (deg > 225 && deg < 315) return "middle";
  return "start";
}

export default function SpiderChart({ axes, scores }: Props) {
  const n = axes.length;
  const startAngle = -Math.PI / 2;

  const dataPoints = axes
    .map((axis, i) => {
      const score = scores[axis.key];
      const val = score != null ? score : 0;
      const angle = startAngle + (2 * Math.PI * i) / n;
      const r = (val / 10) * R;
      return polarToXY(CX, CY, angle, r);
    })
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.svg}>
      {/* Grid rings */}
      {LEVELS.map((level) => (
        <polygon
          key={level}
          points={polygonPoints(n, (level / 10) * R, startAngle)}
          className={styles.ring}
        />
      ))}

      {/* Axis lines */}
      {axes.map((axis, i) => {
        const angle = startAngle + (2 * Math.PI * i) / n;
        const [x, y] = polarToXY(CX, CY, angle, R);
        return (
          <line
            key={axis.key}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            className={`${styles.axisLine} ${axis.coachOnly ? styles.axisLineCoach : ""}`}
          />
        );
      })}

      {/* Data polygon */}
      <polygon points={dataPoints} className={styles.dataPolygon} />

      {/* Data dots */}
      {axes.map((axis, i) => {
        const score = scores[axis.key];
        if (score == null || score === 0) return null;
        const angle = startAngle + (2 * Math.PI * i) / n;
        const r = (score / 10) * R;
        const [x, y] = polarToXY(CX, CY, angle, r);
        return (
          <circle key={axis.key} cx={x} cy={y} r={3} className={styles.dataDot} />
        );
      })}

      {/* Labels */}
      {axes.map((axis, i) => {
        const angle = startAngle + (2 * Math.PI * i) / n;
        const [x, y] = polarToXY(CX, CY, angle, LABEL_R);
        const anchor = getTextAnchor(angle);
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            className={`${styles.label} ${axis.coachOnly ? styles.labelCoach : ""}`}
            textAnchor={anchor}
            dominantBaseline="central"
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}
