"use client";

import { pct } from "@/lib/format";

export interface PeerRow {
  id: string;
  name: string;
  /** Change in equity value against the no-shock case. */
  equityChange: number;
  /** Change in year-five interest expense as a share of today's free cash flow. */
  interestDrag: number;
  netDebtToEquity: number;
}

interface Props {
  rows: PeerRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Diverging horizontal bars: one row per company, zero in the middle. */
export function PeerBars({ rows, selectedId, onSelect }: Props) {
  const extent = Math.max(0.05, ...rows.map((r) => (Number.isFinite(r.equityChange) ? Math.abs(r.equityChange) : 0)));

  return (
    <table className="peers">
      <thead>
        <tr>
          <th scope="col">Company</th>
          <th scope="col" className="peers-bar-head">
            Change in equity value
          </th>
          <th scope="col" className="num">
            Extra interest in year 5, % of today&apos;s free cash flow
          </th>
          <th scope="col" className="num">
            Net debt / equity
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const valid = Number.isFinite(r.equityChange);
          // Rounded so the server-rendered style matches what the browser
          // serialises; otherwise hydration reports an attribute mismatch.
          const half = valid ? round2((Math.abs(r.equityChange) / extent) * 34) : 0;
          const labelOffset = round2(50 + half);
          const negative = r.equityChange < 0;
          return (
            <tr key={r.id} className={r.id === selectedId ? "is-selected" : undefined}>
              <th scope="row">
                <button type="button" onClick={() => onSelect(r.id)} aria-pressed={r.id === selectedId}>
                  {r.name}
                </button>
              </th>
              <td className="peers-bar-cell">
                <div className="peers-bar-track">
                  {valid && half > 0 && (
                    <span
                      className={`peers-bar ${negative ? "peers-bar-neg" : "peers-bar-pos"}`}
                      style={negative ? { right: "50%", width: `${half}%` } : { left: "50%", width: `${half}%` }}
                    />
                  )}
                  <span
                    className="peers-bar-value"
                    style={
                      negative
                        ? { right: `calc(${labelOffset}% + 6px)` }
                        : { left: `calc(${labelOffset}% + 6px)` }
                    }
                  >
                    {valid ? pct(r.equityChange, 0, { sign: true }) : "n/a"}
                  </span>
                </div>
              </td>
              <td className="num">{pct(r.interestDrag, 1, { sign: true })}</td>
              <td className="num">{pct(r.netDebtToEquity, 0)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
