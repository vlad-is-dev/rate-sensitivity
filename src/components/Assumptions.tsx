"use client";

import { useEffect, useId, useState } from "react";
import type { CompanyInputs, MarketInputs } from "@/lib/model";
import type { CompanyPreset, Currency } from "@/lib/companies";
import { pct } from "@/lib/format";

interface FieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** "pct" stores a decimal and shows a percentage. */
  kind?: "pct" | "number";
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  disabled?: boolean;
}

function Field({ label, value, onChange, kind = "number", unit, step, min, max, hint, disabled }: FieldProps) {
  const id = useId();
  const scale = kind === "pct" ? 100 : 1;
  const shown = Number((value * scale).toFixed(kind === "pct" ? 2 : 3));
  const [text, setText] = useState(String(shown));

  // Follow outside changes (new company, reset) without fighting the user's typing.
  useEffect(() => {
    setText((current) => (Number(current) === shown ? current : String(shown)));
  }, [shown]);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          step={step ?? (kind === "pct" ? 0.1 : 0.1)}
          min={min}
          max={max}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = Number(e.target.value);
            if (e.target.value === "" || !Number.isFinite(parsed)) return;
            const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
            onChange(bounded / scale);
          }}
          onBlur={() => setText(String(shown))}
        />
        <span>{unit}</span>
      </div>
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface Props {
  preset: CompanyPreset | null;
  currency: Currency;
  inputs: CompanyInputs;
  market: MarketInputs;
  calibrate: boolean;
  impliedGrowth: number;
  growthIsCalibrated: boolean;
  edited: boolean;
  onInputs: (patch: Partial<CompanyInputs>) => void;
  onMarket: (patch: Partial<MarketInputs>) => void;
  onCalibrate: (value: boolean) => void;
  onCurrency: (currency: Currency) => void;
  onReset: () => void;
}

export function Assumptions({
  preset,
  currency,
  inputs,
  market,
  calibrate,
  impliedGrowth,
  growthIsCalibrated,
  edited,
  onInputs,
  onMarket,
  onCalibrate,
  onCurrency,
  onReset,
}: Props) {
  const bn = `${currency === "USD" ? "$" : "€"}bn`;
  const calibrateId = useId();

  return (
    <aside className="assumptions" aria-label="Assumptions">
      <div className="assumptions-head">
        <h2>Assumptions</h2>
        {preset && edited && (
          <button type="button" className="link-button" onClick={onReset}>
            Restore reported figures
          </button>
        )}
      </div>
      <p className="assumptions-lede">
        Every number feeds the model directly. Change one and the page recalculates.
      </p>

      <details open>
        <summary>Debt</summary>
        <Field label="Total debt" value={inputs.totalDebt} onChange={(v) => onInputs({ totalDebt: v })} unit={bn} min={0} />
        <Field
          label="Interest expense, last 12 months"
          value={inputs.interestExpense}
          onChange={(v) => onInputs({ interestExpense: v })}
          unit={bn}
          min={0}
          step={0.01}
        />
        <Field
          label="Floating-rate share"
          kind="pct"
          value={inputs.floatingShare}
          onChange={(v) => onInputs({ floatingShare: v })}
          unit="%"
          min={0}
          max={100}
          step={1}
          hint="Debt that reprices straight away: loans, floating notes, commercial paper."
        />
        <Field
          label="Years to refinance the fixed debt"
          value={inputs.refinancingYears}
          onChange={(v) => onInputs({ refinancingYears: v })}
          unit="yrs"
          min={1}
          max={40}
          step={1}
          hint="Fixed bonds are assumed to mature evenly over this period."
        />
        <Field
          label="Credit spread on new debt"
          kind="pct"
          value={inputs.creditSpread}
          onChange={(v) => onInputs({ creditSpread: v })}
          unit="%"
          min={0}
          max={15}
          hint="What the company pays above the government yield."
        />
        {preset && <p className="field-note">{preset.debtMixNote}</p>}
      </details>

      <details open>
        <summary>Cash flow</summary>
        <Field
          label="Free cash flow, last 12 months"
          value={inputs.freeCashFlow}
          onChange={(v) => onInputs({ freeCashFlow: v })}
          unit={bn}
          hint="Operating cash flow minus capital expenditure."
        />
        <Field label="Operating profit (EBIT)" value={inputs.ebit} onChange={(v) => onInputs({ ebit: v })} unit={bn} />
        <Field label="Cash and securities" value={inputs.cash} onChange={(v) => onInputs({ cash: v })} unit={bn} min={0} />
        <Field label="Tax rate" kind="pct" value={inputs.taxRate} onChange={(v) => onInputs({ taxRate: v })} unit="%" min={0} max={60} step={1} />
      </details>

      <details open>
        <summary>Valuation</summary>
        <Field label="Market capitalisation" value={inputs.marketCap} onChange={(v) => onInputs({ marketCap: v })} unit={bn} min={0} step={1} />
        <Field
          label="Shares outstanding"
          value={inputs.sharesOutstanding}
          onChange={(v) => onInputs({ sharesOutstanding: v })}
          unit="bn"
          min={0}
          step={0.01}
        />
        <Field
          label="Beta"
          value={inputs.beta}
          onChange={(v) => onInputs({ beta: v })}
          unit="×"
          min={0}
          max={4}
          step={0.05}
          hint={preset ? `Blume-adjusted from a raw five-year beta of ${preset.rawBeta.toFixed(2)}.` : undefined}
        />
        <Field
          label="Long-run growth"
          kind="pct"
          value={inputs.terminalGrowth}
          onChange={(v) => onInputs({ terminalGrowth: v })}
          unit="%"
          min={-2}
          max={5}
          hint="Growth after year 10. Capped at the risk-free rate."
        />
        <div className="check">
          <input
            id={calibrateId}
            type="checkbox"
            checked={calibrate}
            onChange={(e) => onCalibrate(e.target.checked)}
          />
          <label htmlFor={calibrateId}>Use the growth rate implied by the share price</label>
        </div>
        {calibrate && growthIsCalibrated && (
          <p className="field-note">
            Today&apos;s price implies cash flow growing {pct(impliedGrowth, 1)} a year for five years, then fading
            to the long-run rate.
          </p>
        )}
        {calibrate && !growthIsCalibrated && (
          <p className="field-note field-warning">
            No growth rate between −25% and 60% explains this market value, so the growth rate below is used
            instead.
          </p>
        )}
        <Field
          label="Growth, years 1–5"
          kind="pct"
          value={calibrate && growthIsCalibrated ? impliedGrowth : inputs.growth}
          onChange={(v) => onInputs({ growth: v })}
          unit="%"
          min={-25}
          max={60}
          step={0.5}
          disabled={calibrate && growthIsCalibrated}
        />
      </details>

      <details>
        <summary>Market</summary>
        {!preset && (
          <div className="field">
            <label htmlFor="currency">Currency</label>
            <div className="field-input">
              <select id="currency" value={currency} onChange={(e) => onCurrency(e.target.value as Currency)}>
                <option value="USD">US dollar</option>
                <option value="EUR">Euro</option>
              </select>
            </div>
          </div>
        )}
        <Field
          label="Risk-free rate"
          kind="pct"
          value={market.riskFree}
          onChange={(v) => onMarket({ riskFree: v })}
          unit="%"
          min={0}
          max={15}
          hint={currency === "USD" ? "10-year US Treasury yield." : "10-year German Bund yield."}
        />
        <Field
          label="Equity risk premium"
          kind="pct"
          value={market.equityRiskPremium}
          onChange={(v) => onMarket({ equityRiskPremium: v })}
          unit="%"
          min={0}
          max={12}
        />
        <Field
          label="Yield on cash versus risk-free"
          kind="pct"
          value={market.cashYieldSpread}
          onChange={(v) => onMarket({ cashYieldSpread: v })}
          unit="%"
          min={-5}
          max={2}
        />
      </details>
    </aside>
  );
}
