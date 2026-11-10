"use client";

import { bp, pct } from "@/lib/format";

export const SHOCK_MIN_BP = -200;
export const SHOCK_MAX_BP = 300;
export const SHOCK_STEP_BP = 25;

interface Props {
  shockBp: number;
  riskFree: number;
  onChange: (bp: number) => void;
}

/** The main control: a ruler in basis points with the rate shock as its needle. */
export function ShockRuler({ shockBp, riskFree, onChange }: Props) {
  const span = SHOCK_MAX_BP - SHOCK_MIN_BP;
  const position = (shockBp - SHOCK_MIN_BP) / span;
  const ticks: number[] = [];
  for (let v = SHOCK_MIN_BP; v <= SHOCK_MAX_BP; v += SHOCK_STEP_BP) ticks.push(v);
  const direction = shockBp > 0 ? "up" : shockBp < 0 ? "down" : "flat";

  return (
    <div className={`ruler ruler-${direction}`} style={{ "--pos": position } as React.CSSProperties}>
      <div className="ruler-readout" aria-hidden="true">
        <strong>{bp(shockBp / 10_000)}</strong>
        <span>
          risk-free {pct(riskFree, 2)} → {pct(Math.max(0, riskFree + shockBp / 10_000), 2)}
        </span>
      </div>

      <div className="ruler-track">
        <div className="ruler-ticks" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t}
              className={`ruler-tick${t % 100 === 0 ? " ruler-tick-major" : ""}${t === 0 ? " ruler-tick-zero" : ""}`}
              style={{ left: `${((t - SHOCK_MIN_BP) / span) * 100}%` }}
            >
              {t % 100 === 0 && <em>{t === 0 ? "today" : `${t > 0 ? "+" : "−"}${Math.abs(t)}`}</em>}
            </span>
          ))}
        </div>
        <input
          type="range"
          min={SHOCK_MIN_BP}
          max={SHOCK_MAX_BP}
          step={SHOCK_STEP_BP}
          value={shockBp}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Interest-rate shock in basis points"
          aria-valuetext={`${bp(shockBp / 10_000)}, risk-free rate ${pct(riskFree + shockBp / 10_000, 2)}`}
        />
      </div>

      <div className="ruler-actions">
        <span className="ruler-hint">Basis points. 100 bp = 1 percentage point.</span>
        <button type="button" onClick={() => onChange(0)} disabled={shockBp === 0}>
          Reset to today
        </button>
      </div>
    </div>
  );
}
