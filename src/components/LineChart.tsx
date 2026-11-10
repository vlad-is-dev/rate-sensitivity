"use client";

import { useEffect, useId, useRef, useState } from "react";
import { niceTicks } from "@/lib/format";

export interface Series {
  key: string;
  name: string;
  /** CSS colour, normally a custom property such as `var(--up)`. */
  color: string;
  points: Array<[number, number]>;
  dashed?: boolean;
}

interface Props {
  series: Series[];
  xTicks: number[];
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  /** Longer x label used in the tooltip heading. */
  describeX?: (x: number) => string;
  /** Highlight one x position with a ringed dot on the first series. */
  marker?: { x: number; color: string };
  /** Draw a horizontal reference line at y = 0. */
  zeroLine?: boolean;
  height?: number;
  ariaLabel: string;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function LineChart({
  series,
  xTicks,
  formatX,
  formatY,
  describeX,
  marker,
  zeroLine,
  height = 260,
  ariaLabel,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const titleId = useId();

  const clean = series.map((s) => ({
    ...s,
    points: s.points.filter(([, y]) => Number.isFinite(y)),
  }));
  const all = clean.flatMap((s) => s.points);
  const multi = clean.length > 1;
  // End-of-line labels need room; on narrow screens the legend carries identity alone.
  const labelled = multi && width >= 520;

  const margin = { top: 12, right: labelled ? 112 : 20, bottom: 30, left: 56 };
  const innerW = Math.max(40, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;

  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const xMin = Math.min(...xs, ...xTicks);
  const xMax = Math.max(...xs, ...xTicks);
  let yLo = Math.min(...ys);
  let yHi = Math.max(...ys);
  if (zeroLine) {
    yLo = Math.min(yLo, 0);
    yHi = Math.max(yHi, 0);
  }
  if (!Number.isFinite(yLo) || !Number.isFinite(yHi)) {
    yLo = 0;
    yHi = 1;
  }
  const pad = (yHi - yLo) * 0.08 || Math.abs(yHi) * 0.08 || 1;
  const yTicks = niceTicks(yLo - pad, yHi + pad, 4);
  const yMin = yTicks[0] ?? 0;
  const yMax = yTicks[yTicks.length - 1] ?? 1;

  const sx = (x: number) => margin.left + ((x - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (y: number) => margin.top + (1 - (y - yMin) / (yMax - yMin || 1)) * innerH;

  const path = (points: Array<[number, number]>) =>
    points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join("");

  // End-of-line labels, pushed apart so they never overlap.
  const endLabels = clean
    .map((s) => {
      const last = s.points[s.points.length - 1];
      return last ? { key: s.key, name: s.name, color: s.color, y: sy(last[1]) } : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    const prev = endLabels[i - 1]!;
    const cur = endLabels[i]!;
    if (cur.y - prev.y < 16) {
      const mid = (cur.y + prev.y) / 2;
      prev.y = mid - 8;
      cur.y = mid + 8;
    }
  }

  const xValues = Array.from(new Set(xs)).sort((a, b) => a - b);
  const nearest = (clientX: number, rect: DOMRect) => {
    const x = xMin + ((clientX - rect.left - margin.left) / innerW) * (xMax - xMin);
    return xValues.reduce((best, v) => (Math.abs(v - x) < Math.abs(best - x) ? v : best), xValues[0] ?? 0);
  };

  const hovered =
    hoverX === null
      ? null
      : clean
          .map((s) => ({ s, point: s.points.find(([x]) => x === hoverX) }))
          .filter((h): h is { s: (typeof clean)[number]; point: [number, number] } => !!h.point);

  const markerPoint = marker ? clean[0]?.points.find(([x]) => Math.abs(x - marker.x) < 1e-9) : undefined;
  const tooltipLeft = hoverX === null ? 0 : sx(hoverX);
  const flip = tooltipLeft > width * 0.6;

  return (
    <div className="chart" ref={ref}>
      {multi && (
        <ul className="legend" aria-hidden="true">
          {clean.map((s) => (
            <li key={s.key}>
              <span className={`swatch${s.dashed ? " swatch-dashed" : ""}`} style={{ color: s.color }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="chart-plot">
        <svg
          width={width}
          height={height}
          role="img"
          aria-labelledby={titleId}
          onPointerMove={(e) => setHoverX(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHoverX(null)}
        >
          <title id={titleId}>{ariaLabel}</title>

          {yTicks.map((t) => (
            <g key={t}>
              <line className="grid" x1={margin.left} x2={margin.left + innerW} y1={sy(t)} y2={sy(t)} />
              <text className="tick" x={margin.left - 8} y={sy(t)} dy="0.32em" textAnchor="end">
                {formatY(t)}
              </text>
            </g>
          ))}
          {zeroLine && yMin < 0 && yMax > 0 && (
            <line className="zero" x1={margin.left} x2={margin.left + innerW} y1={sy(0)} y2={sy(0)} />
          )}
          {xTicks.map((t) => (
            <text key={t} className="tick" x={sx(t)} y={height - 8} textAnchor="middle">
              {formatX(t)}
            </text>
          ))}

          {hoverX !== null && (
            <line className="crosshair" x1={sx(hoverX)} x2={sx(hoverX)} y1={margin.top} y2={margin.top + innerH} />
          )}

          {clean.map((s) => (
            <path
              key={s.key}
              d={path(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "5 5" : undefined}
            />
          ))}

          {labelled &&
            endLabels.map((l) => (
              <text key={l.key} className="end-label" x={margin.left + innerW + 8} y={l.y} dy="0.32em">
                {l.name}
              </text>
            ))}

          {markerPoint && marker && (
            <circle
              cx={sx(markerPoint[0])}
              cy={sy(markerPoint[1])}
              r={6}
              fill={marker.color}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )}

          {hovered?.map(({ s, point }) => (
            <circle
              key={s.key}
              cx={sx(point[0])}
              cy={sy(point[1])}
              r={4.5}
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
        </svg>

        {hovered && hovered.length > 0 && hoverX !== null && (
          <div
            className="tooltip"
            style={{
              left: tooltipLeft,
              transform: flip ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <div className="tooltip-title">{(describeX ?? formatX)(hoverX)}</div>
            {hovered.map(({ s, point }) => (
              <div className="tooltip-row" key={s.key}>
                <span className={`swatch${s.dashed ? " swatch-dashed" : ""}`} style={{ color: s.color }} />
                <span>{s.name}</span>
                <strong>{formatY(point[1])}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
