"use client";

import { useMemo, useState } from "react";
import {
  analyze,
  sensitivityCurve,
  shockRange,
  type CompanyInputs,
  type MarketInputs,
} from "@/lib/model";
import { COMPANIES, MARKETS, type CompanyPreset, type Currency } from "@/lib/companies";
import { bp, money, multiple, pct, perShare } from "@/lib/format";
import { Assumptions } from "./Assumptions";
import { LineChart } from "./LineChart";
import { PeerBars, type PeerRow } from "./PeerBars";
import { SHOCK_MAX_BP, SHOCK_MIN_BP, SHOCK_STEP_BP, ShockRuler } from "./ShockRuler";

const CUSTOM_ID = "custom";

/** Starting point for a company the user types in themselves. */
const CUSTOM_TEMPLATE: CompanyInputs = {
  freeCashFlow: 1.2,
  ebit: 2.0,
  interestExpense: 0.5,
  taxRate: 0.25,
  totalDebt: 10,
  cash: 1,
  marketCap: 15,
  sharesOutstanding: 0.5,
  beta: 1,
  floatingShare: 0.3,
  refinancingYears: 6,
  creditSpread: 0.02,
  growth: 0.03,
  terminalGrowth: 0.02,
};

const CURVE_SHOCKS = shockRange(SHOCK_MIN_BP, SHOCK_MAX_BP, SHOCK_STEP_BP);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function Dashboard() {
  const [selectedId, setSelectedId] = useState<string>(COMPANIES[0]!.id);
  const [edits, setEdits] = useState<Record<string, CompanyInputs>>({});
  const [markets, setMarkets] = useState<Record<Currency, MarketInputs>>(MARKETS);
  const [customCurrency, setCustomCurrency] = useState<Currency>("EUR");
  const [shockBp, setShockBp] = useState(100);
  const [passThrough, setPassThrough] = useState(0);
  const [calibrate, setCalibrate] = useState(true);

  const preset: CompanyPreset | null = COMPANIES.find((c) => c.id === selectedId) ?? null;
  const currency: Currency = preset?.currency ?? customCurrency;
  const name = preset?.name ?? "Your company";
  const inputs = edits[selectedId] ?? preset?.inputs ?? CUSTOM_TEMPLATE;
  const market: MarketInputs = { ...markets[currency], growthPassThrough: passThrough };
  const shock = shockBp / 10_000;

  const analysis = useMemo(
    () => analyze(inputs, market, shock, { calibrateToMarket: calibrate }),
    // `market` is rebuilt every render; depend on its parts instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs, market.riskFree, market.equityRiskPremium, market.cashYieldSpread, passThrough, shock, calibrate],
  );
  const curve = useMemo(
    () => sensitivityCurve(inputs, market, analysis.growth, CURVE_SHOCKS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs, market.riskFree, market.equityRiskPremium, market.cashYieldSpread, passThrough, analysis.growth],
  );

  const peers: PeerRow[] = useMemo(
    () =>
      COMPANIES.map((c) => {
        const companyInputs = edits[c.id] ?? c.inputs;
        const m = { ...markets[c.currency], growthPassThrough: passThrough };
        const a = analyze(companyInputs, m, shock);
        const base = a.base.valuation;
        const shocked = a.shocked.valuation;
        return {
          id: c.id,
          name: c.name,
          equityChange:
            base.valid && shocked.valid && base.equityValue > 0
              ? shocked.equityValue / base.equityValue - 1
              : NaN,
          interestDrag:
            (a.shocked.years[4]!.interestExpense - a.base.years[4]!.interestExpense) /
            Math.abs(companyInputs.freeCashFlow),
          netDebtToEquity: (companyInputs.totalDebt - companyInputs.cash) / companyInputs.marketCap,
        };
      }),
    [edits, markets, passThrough, shock],
  );

  const { base, shocked } = analysis;
  const direction = shockBp > 0 ? "up" : shockBp < 0 ? "down" : "flat";
  const scenarioColor = direction === "down" ? "var(--down)" : "var(--up)";
  const scenarioName = `Rates ${bp(shock)}`;

  const y5Base = base.years[4]!;
  const y5Shock = shocked.years[4]!;
  const interestDelta5 = y5Shock.interestExpense - y5Base.interestExpense;
  const fcfDelta5 =
    sum(shocked.years.slice(0, 5).map((y) => y.leveredFcf)) -
    sum(base.years.slice(0, 5).map((y) => y.leveredFcf));
  const valuationOk = base.valuation.valid && shocked.valuation.valid && base.valuation.equityValue > 0;
  const equityChange = valuationOk ? shocked.valuation.equityValue / base.valuation.equityValue - 1 : NaN;
  const marketRate = base.capital.preTaxCostOfDebt;

  const patchInputs = (patch: Partial<CompanyInputs>) =>
    setEdits((prev) => ({ ...prev, [selectedId]: { ...inputs, ...patch } }));
  const patchMarket = (patch: Partial<MarketInputs>) =>
    setMarkets((prev) => ({ ...prev, [currency]: { ...prev[currency], ...patch } }));
  const reset = () => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    setMarkets((prev) => ({ ...prev, [currency]: MARKETS[currency] }));
  };
  const marketEdited =
    markets[currency].riskFree !== MARKETS[currency].riskFree ||
    markets[currency].equityRiskPremium !== MARKETS[currency].equityRiskPremium ||
    markets[currency].cashYieldSpread !== MARKETS[currency].cashYieldSpread;

  const m = (v: number, sign = false) => money(v, currency, { sign });
  const yearTicks = [0, 2, 4, 6, 8, 10];

  return (
    <>
      <section className="hero" aria-label="Scenario">
        <div className="picker" role="group" aria-label="Company">
          {COMPANIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={c.id === selectedId}
              onClick={() => setSelectedId(c.id)}
            >
              {c.name}
              {edits[c.id] && <span className="chip-flag"> (edited)</span>}
            </button>
          ))}
          <button
            type="button"
            className="chip chip-custom"
            aria-pressed={selectedId === CUSTOM_ID}
            onClick={() => setSelectedId(CUSTOM_ID)}
          >
            Enter your own
          </button>
        </div>

        <p className="headline" aria-live="polite">
          {direction === "flat" ? (
            <>
              With rates where they are today, {name}&apos;s yearly interest bill still{" "}
              {y5Base.interestExpense >= inputs.interestExpense ? "rises" : "falls"} from{" "}
              <b>{m(inputs.interestExpense)}</b> to <b>{m(y5Base.interestExpense)}</b> by year five, as debt
              fixed at {pct(analysis.fixedCoupon)} is refinanced at {pct(marketRate)}.
            </>
          ) : (
            <>
              If rates {direction === "up" ? "rise" : "fall"} by{" "}
              <b className={`mark mark-${direction}`}>{Math.abs(shockBp)} basis points</b>, {name} pays{" "}
              <b>{m(Math.abs(interestDelta5))}</b> {interestDelta5 >= 0 ? "more" : "less"} interest a year by
              year five, its shareholders get <b>{m(Math.abs(fcfDelta5))}</b> {fcfDelta5 >= 0 ? "more" : "less"}{" "}
              cash over those five years, and{" "}
              {valuationOk ? (
                <>
                  its equity is worth{" "}
                  <b className={`mark mark-${direction}`}>
                    {pct(Math.abs(equityChange), 0)} {equityChange >= 0 ? "more" : "less"}
                  </b>
                  .
                </>
              ) : (
                <>the valuation can no longer be computed: the discount rate falls too close to long-run growth.</>
              )}
            </>
          )}
        </p>

        <ShockRuler shockBp={shockBp} riskFree={markets[currency].riskFree} onChange={setShockBp} />

        <div className="nature">
          <label htmlFor="pass-through">
            What kind of shock is it?
            <span>
              {passThrough === 0
                ? "Real rates move; cash flows stay as they were."
                : passThrough === 1
                  ? "Pure inflation, passed on in full through prices."
                  : `${Math.round(passThrough * 100)}% of the move is inflation the company passes on.`}
            </span>
          </label>
          <div className="nature-slider">
            <span>Real rates</span>
            <input
              id="pass-through"
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={passThrough}
              onChange={(e) => setPassThrough(Number(e.target.value))}
            />
            <span>Inflation</span>
          </div>
        </div>

        {preset && <p className="company-note">{preset.note}</p>}
      </section>

      <div className="layout">
        <div className="panels">
          <section className="panel" aria-labelledby="debt-heading">
            <h2 id="debt-heading">Debt expense</h2>
            <p className="panel-lede">
              Floating-rate debt reprices at once. Fixed-rate bonds keep their coupon until they mature and are
              replaced at the going rate, so the full effect arrives over {inputs.refinancingYears} years.
            </p>
            <dl className="stats">
              <div>
                <dt>Average rate paid today</dt>
                <dd>{pct(analysis.averageCostOfDebt)}</dd>
              </div>
              <div>
                <dt>Rate on new debt, today</dt>
                <dd>{pct(marketRate)}</dd>
              </div>
              <div>
                <dt>Rate on new debt, after the shock</dt>
                <dd>{pct(shocked.capital.preTaxCostOfDebt)}</dd>
              </div>
              <div>
                <dt>Debt repriced within five years</dt>
                <dd>{pct(y5Base.repricedShare, 0)}</dd>
              </div>
            </dl>
            <LineChart
              ariaLabel={`Yearly interest expense of ${name} over ten years, with and without the rate shock`}
              series={[
                {
                  key: "shocked",
                  name: scenarioName,
                  color: scenarioColor,
                  points: [[0, inputs.interestExpense], ...shocked.years.map((y) => [y.year, y.interestExpense] as [number, number])],
                },
                {
                  key: "base",
                  name: "Unchanged",
                  color: "var(--series-base)",
                  dashed: true,
                  points: [[0, inputs.interestExpense], ...base.years.map((y) => [y.year, y.interestExpense] as [number, number])],
                },
              ]}
              xTicks={yearTicks}
              formatX={(x) => (x === 0 ? "Now" : `Yr ${x}`)}
              describeX={(x) => (x === 0 ? "Last 12 months" : `Year ${x}`)}
              formatY={(y) => m(y)}
            />
          </section>

          <section className="panel" aria-labelledby="fcf-heading">
            <h2 id="fcf-heading">Free cash flow</h2>
            <p className="panel-lede">
              Cash left for shareholders after interest. Interest is tax-deductible, so each extra{" "}
              {currency === "USD" ? "dollar" : "euro"} of it costs {(1 - inputs.taxRate).toFixed(2)} after tax.
              Interest earned on {m(inputs.cash)} of cash moves the other way.
            </p>
            <dl className="stats">
              <div>
                <dt>Free cash flow, year 5</dt>
                <dd>
                  {m(y5Base.leveredFcf)} → {m(y5Shock.leveredFcf)}
                </dd>
              </div>
              <div>
                <dt>Five-year total, change</dt>
                <dd>{m(fcfDelta5, true)}</dd>
              </div>
              <div>
                <dt>Interest cover, year 5</dt>
                <dd>
                  {multiple(y5Base.interestCoverage)} → {multiple(y5Shock.interestCoverage)}
                </dd>
              </div>
              <div>
                <dt>Extra interest income on cash</dt>
                <dd>{m(y5Shock.interestIncome - y5Base.interestIncome, true)}</dd>
              </div>
            </dl>
            <LineChart
              ariaLabel={`Free cash flow to shareholders of ${name} over ten years, with and without the rate shock`}
              series={[
                {
                  key: "shocked",
                  name: scenarioName,
                  color: scenarioColor,
                  points: shocked.years.map((y) => [y.year, y.leveredFcf]),
                },
                {
                  key: "base",
                  name: "Unchanged",
                  color: "var(--series-base)",
                  dashed: true,
                  points: base.years.map((y) => [y.year, y.leveredFcf]),
                },
              ]}
              xTicks={[1, 2, 4, 6, 8, 10]}
              formatX={(x) => `Yr ${x}`}
              describeX={(x) => `Year ${x}`}
              formatY={(y) => m(y)}
            />
            <details className="table-view">
              <summary>Year-by-year figures</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Year</th>
                      <th scope="col" className="num">Debt repriced</th>
                      <th scope="col" className="num">Interest, unchanged</th>
                      <th scope="col" className="num">Interest, shocked</th>
                      <th scope="col" className="num">Cash flow, unchanged</th>
                      <th scope="col" className="num">Cash flow, shocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {base.years.map((y, i) => (
                      <tr key={y.year}>
                        <th scope="row">{y.year}</th>
                        <td className="num">{pct(y.repricedShare, 0)}</td>
                        <td className="num">{m(y.interestExpense)}</td>
                        <td className="num">{m(shocked.years[i]!.interestExpense)}</td>
                        <td className="num">{m(y.leveredFcf)}</td>
                        <td className="num">{m(shocked.years[i]!.leveredFcf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="panel" aria-labelledby="valuation-heading">
            <h2 id="valuation-heading">Valuation</h2>
            <p className="panel-lede">
              The risk-free rate sits inside both the cost of equity and the cost of debt. When it moves, every
              future cash flow is discounted at a different rate, and the cash flows furthest away move most.
            </p>
            <dl className="stats">
              <div>
                <dt>Discount rate (WACC)</dt>
                <dd>
                  {pct(base.capital.wacc, 2)} → {pct(shocked.capital.wacc, 2)}
                </dd>
              </div>
              <div>
                <dt>Value per share</dt>
                <dd>
                  {perShare(base.valuation.valuePerShare, currency)} →{" "}
                  {perShare(shocked.valuation.valuePerShare, currency)}
                </dd>
              </div>
              <div>
                <dt>Value from beyond year 10</dt>
                <dd>{pct(base.valuation.terminalShare, 0)}</dd>
              </div>
              <div>
                <dt>Equity duration</dt>
                <dd>{analysis.equityDuration === null ? "n/a" : `${analysis.equityDuration.toFixed(1)} yrs`}</dd>
              </div>
            </dl>
            <LineChart
              ariaLabel={`Change in the equity value of ${name} for rate shocks from −200 to +300 basis points`}
              series={[
                {
                  key: "curve",
                  name: "Equity value against today",
                  color: "var(--ink)",
                  points: curve.map((p) => [Math.round(p.shock * 10_000), p.change]),
                },
              ]}
              xTicks={[-200, -100, 0, 100, 200, 300]}
              formatX={(x) => (x === 0 ? "0" : `${x > 0 ? "+" : "−"}${Math.abs(x)}`)}
              describeX={(x) => `Rates ${bp(x / 10_000)}`}
              formatY={(y) => pct(y, 0, { sign: true })}
              marker={{ x: shockBp, color: direction === "flat" ? "var(--ink)" : scenarioColor }}
              zeroLine
            />
            <p className="chart-caption">
              Change in equity value for each size of shock, in basis points. The dot is the scenario on the
              ruler.
              {curve.some((p) => !p.valid) &&
                " The line stops where the discount rate falls too close to long-run growth for the model to hold."}
              {inputs.terminalGrowth > market.riskFree + SHOCK_MIN_BP / 10_000 &&
                " It flattens on the left where long-run growth is capped at the risk-free rate."}
            </p>

            <div className="table-scroll">
              <table className="bridge">
                <caption>How the discount rate is built</caption>
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col" className="num">Today</th>
                    <th scope="col" className="num">After the shock</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Risk-free rate</th>
                    <td className="num">{pct(base.capital.riskFree, 2)}</td>
                    <td className="num">{pct(shocked.capital.riskFree, 2)}</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      Cost of equity <span>risk-free + {inputs.beta.toFixed(2)} × {pct(market.equityRiskPremium, 2)}</span>
                    </th>
                    <td className="num">{pct(base.capital.costOfEquity, 2)}</td>
                    <td className="num">{pct(shocked.capital.costOfEquity, 2)}</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      Cost of debt after tax <span>(risk-free + {pct(inputs.creditSpread, 2)}) × (1 − {pct(inputs.taxRate, 0)})</span>
                    </th>
                    <td className="num">{pct(base.capital.afterTaxCostOfDebt, 2)}</td>
                    <td className="num">{pct(shocked.capital.afterTaxCostOfDebt, 2)}</td>
                  </tr>
                  <tr>
                    <th scope="row">
                      WACC <span>{pct(base.capital.equityWeight, 0)} equity, {pct(base.capital.debtWeight, 0)} debt</span>
                    </th>
                    <td className="num">{pct(base.capital.wacc, 2)}</td>
                    <td className="num">{pct(shocked.capital.wacc, 2)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Long-run growth</th>
                    <td className="num">{pct(base.valuation.terminalGrowthUsed, 2)}</td>
                    <td className="num">{pct(shocked.valuation.terminalGrowthUsed, 2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" aria-labelledby="peers-heading">
            <h2 id="peers-heading">The same shock, six balance sheets</h2>
            <p className="panel-lede">
              {direction === "flat"
                ? "Move the ruler to compare how each company takes the same shock."
                : `Rates ${bp(shock)} for every company, each against its own currency's government yield.`}{" "}
              Select a row to open that company.
            </p>
            <div className="table-scroll">
              <PeerBars rows={peers} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </section>
        </div>

        <Assumptions
          preset={preset}
          currency={currency}
          inputs={inputs}
          market={markets[currency]}
          calibrate={calibrate}
          impliedGrowth={analysis.growth}
          growthIsCalibrated={analysis.growthIsCalibrated}
          edited={!!edits[selectedId] || marketEdited}
          onInputs={patchInputs}
          onMarket={patchMarket}
          onCalibrate={setCalibrate}
          onCurrency={setCustomCurrency}
          onReset={reset}
        />
      </div>
    </>
  );
}
