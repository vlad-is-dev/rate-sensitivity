/**
 * Interest-rate sensitivity model.
 *
 * Pure functions, no UI and no I/O. All money amounts are in billions of the
 * company's reporting currency; all rates are decimals (0.05 = 5%).
 *
 * A parallel rate shock reaches a company through three channels:
 *
 *   1. Debt expense  – floating debt reprices at once, fixed debt reprices as
 *                      it matures and is refinanced at the new market rate.
 *   2. Free cash flow – higher net interest (after tax) leaves less cash for
 *                      shareholders; interest earned on cash partly offsets it.
 *   3. Valuation     – the risk-free rate feeds the cost of equity and the
 *                      cost of debt, so WACC moves and future cash flows are
 *                      discounted harder.
 */

export const HORIZON_YEARS = 10;
/** Years of constant growth before it fades to the terminal rate. */
export const STAGE_ONE_YEARS = 5;
/** Smallest WACC − terminal growth gap for which a Gordon terminal value is meaningful. */
export const MIN_TERMINAL_SPREAD = 0.005;

export interface MarketInputs {
  /** 10-year government bond yield in the company's currency. */
  riskFree: number;
  /** Equity risk premium. */
  equityRiskPremium: number;
  /** Yield on corporate cash relative to the risk-free rate (usually negative). */
  cashYieldSpread: number;
  /**
   * Share of the rate shock that shows up as higher long-run nominal growth.
   * 0 = a pure real-rate shock (cash flows unchanged); 1 = a pure inflation
   * shock that the company passes on in full.
   */
  growthPassThrough: number;
}

export interface CompanyInputs {
  /** Reported free cash flow to equity holders: operating cash flow − capex. */
  freeCashFlow: number;
  ebit: number;
  /** Interest expense over the same trailing period. */
  interestExpense: number;
  taxRate: number;
  totalDebt: number;
  cash: number;
  marketCap: number;
  sharesOutstanding: number;
  beta: number;
  /** Share of debt that reprices immediately (floating notes, bank loans, commercial paper). */
  floatingShare: number;
  /** Years until the whole fixed-rate book has matured, assuming an even maturity ladder. */
  refinancingYears: number;
  /** Spread over the risk-free rate at which the company can borrow today. */
  creditSpread: number;
  /** Cash-flow growth for the first five years. Ignored when calibrating to the market price. */
  growth: number;
  terminalGrowth: number;
}

export interface CostOfCapital {
  riskFree: number;
  costOfEquity: number;
  preTaxCostOfDebt: number;
  afterTaxCostOfDebt: number;
  equityWeight: number;
  debtWeight: number;
  wacc: number;
}

export interface YearProjection {
  year: number;
  /** Share of total debt already paying the current market rate. */
  repricedShare: number;
  interestExpense: number;
  interestIncome: number;
  /** Unlevered free cash flow (to all capital providers). */
  fcff: number;
  /** Free cash flow after net interest, i.e. what is left for shareholders. */
  leveredFcf: number;
  ebit: number;
  interestCoverage: number;
}

export interface Valuation {
  valid: boolean;
  enterpriseValue: number;
  equityValue: number;
  valuePerShare: number;
  /** Share of enterprise value that comes from the terminal value. */
  terminalShare: number;
  terminalGrowthUsed: number;
}

export interface Scenario {
  shock: number;
  capital: CostOfCapital;
  years: YearProjection[];
  valuation: Valuation;
}

export interface Analysis {
  growth: number;
  growthIsCalibrated: boolean;
  fixedCoupon: number;
  averageCostOfDebt: number;
  base: Scenario;
  shocked: Scenario;
  /** Percentage fall in equity value per +1 percentage point in rates, measured around today's level. */
  equityDuration: number | null;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Rate the company would pay on debt issued today, after the shock. */
export function marketCostOfDebt(company: CompanyInputs, market: MarketInputs, shock = 0): number {
  return Math.max(0, market.riskFree + shock + company.creditSpread);
}

/** Average rate currently paid on the whole debt book. */
export function averageCostOfDebt(company: CompanyInputs): number {
  return company.totalDebt > 0 ? company.interestExpense / company.totalDebt : 0;
}

/**
 * Coupon locked in on the fixed-rate part of the book.
 *
 * The reported average rate is a blend: floating debt already pays today's
 * market rate, so the fixed coupon is whatever makes the blend add up.
 */
export function fixedCoupon(company: CompanyInputs, market: MarketInputs): number {
  const f = clamp(company.floatingShare, 0, 1);
  const average = averageCostOfDebt(company);
  if (f >= 1) return marketCostOfDebt(company, market);
  return Math.max(0, (average - f * marketCostOfDebt(company, market)) / (1 - f));
}

/** Yield earned on the cash pile after the shock. */
export function cashYield(market: MarketInputs, shock = 0): number {
  return Math.max(0, market.riskFree + shock + market.cashYieldSpread);
}

/**
 * Share of total debt that pays the post-shock market rate during `year`.
 * Fixed debt matures evenly over `refinancingYears`; debt maturing within a
 * year is assumed to roll over mid-year on average.
 */
export function repricedShare(company: CompanyInputs, year: number): number {
  const f = clamp(company.floatingShare, 0, 1);
  const ladder = Math.max(company.refinancingYears, 0.5);
  const fixedRepriced = clamp((year - 0.5) / ladder, 0, 1);
  return f + (1 - f) * fixedRepriced;
}

/** Interest expense in a given future year. Debt is held constant and rolled over at par. */
export function interestExpenseInYear(
  company: CompanyInputs,
  market: MarketInputs,
  shock: number,
  year: number,
): number {
  const share = repricedShare(company, year);
  const blended =
    share * marketCostOfDebt(company, market, shock) + (1 - share) * fixedCoupon(company, market);
  return company.totalDebt * blended;
}

export function costOfCapital(
  company: CompanyInputs,
  market: MarketInputs,
  shock = 0,
): CostOfCapital {
  const riskFree = market.riskFree + shock;
  const costOfEquity = riskFree + company.beta * market.equityRiskPremium;
  const preTaxCostOfDebt = marketCostOfDebt(company, market, shock);
  const afterTaxCostOfDebt = preTaxCostOfDebt * (1 - company.taxRate);
  const total = company.marketCap + company.totalDebt;
  const equityWeight = total > 0 ? company.marketCap / total : 1;
  const debtWeight = 1 - equityWeight;
  return {
    riskFree,
    costOfEquity,
    preTaxCostOfDebt,
    afterTaxCostOfDebt,
    equityWeight,
    debtWeight,
    wacc: equityWeight * costOfEquity + debtWeight * afterTaxCostOfDebt,
  };
}

/**
 * Unlevered free cash flow today: add after-tax net interest back to the
 * reported (levered) free cash flow.
 */
export function baseFcff(company: CompanyInputs, market: MarketInputs): number {
  const netInterest = company.interestExpense - company.cash * cashYield(market);
  return company.freeCashFlow + netInterest * (1 - company.taxRate);
}

/** Growth rate applied in a given year: flat for five years, then a linear fade to terminal. */
export function growthInYear(growth: number, terminalGrowth: number, year: number): number {
  if (year <= STAGE_ONE_YEARS) return growth;
  const fadeYears = HORIZON_YEARS - STAGE_ONE_YEARS;
  const step = (year - STAGE_ONE_YEARS) / fadeYears;
  return growth + (terminalGrowth - growth) * clamp(step, 0, 1);
}

/**
 * Long-run growth after the shock: the base assumption plus whatever part of
 * the shock is inflation the company can pass on, capped at the shocked
 * risk-free rate. A company cannot outgrow the economy forever, and the
 * risk-free rate is the usual proxy for long-run nominal growth.
 */
export function terminalGrowthAfterShock(
  company: CompanyInputs,
  market: MarketInputs,
  shock = 0,
): number {
  const passedThrough = company.terminalGrowth + clamp(market.growthPassThrough, 0, 1) * shock;
  return Math.min(passedThrough, Math.max(market.riskFree + shock, 0));
}

/** Cumulative growth factor from today to the end of `year`. */
function growthFactors(growth: number, terminalGrowth: number): number[] {
  const factors: number[] = [];
  let level = 1;
  for (let year = 1; year <= HORIZON_YEARS; year++) {
    level *= 1 + growthInYear(growth, terminalGrowth, year);
    factors.push(level);
  }
  return factors;
}

export function projectYears(
  company: CompanyInputs,
  market: MarketInputs,
  shock: number,
  growth: number,
): YearProjection[] {
  const fcff0 = baseFcff(company, market);
  const factors = growthFactors(growth, terminalGrowthAfterShock(company, market, shock));
  const interestIncome = company.cash * cashYield(market, shock);

  return factors.map((factor, i) => {
    const year = i + 1;
    const interestExpense = interestExpenseInYear(company, market, shock, year);
    const fcff = fcff0 * factor;
    const ebit = company.ebit * factor;
    return {
      year,
      repricedShare: repricedShare(company, year),
      interestExpense,
      interestIncome,
      fcff,
      leveredFcf: fcff - (interestExpense - interestIncome) * (1 - company.taxRate),
      ebit,
      interestCoverage: interestExpense > 0 ? ebit / interestExpense : Infinity,
    };
  });
}

/** Two-stage discounted cash flow on unlevered free cash flow. */
export function valueCompany(
  company: CompanyInputs,
  market: MarketInputs,
  shock: number,
  growth: number,
): Valuation {
  const { wacc } = costOfCapital(company, market, shock);
  const terminalGrowthUsed = terminalGrowthAfterShock(company, market, shock);
  const fcff0 = baseFcff(company, market);
  const factors = growthFactors(growth, terminalGrowthUsed);

  const invalid: Valuation = {
    valid: false,
    enterpriseValue: NaN,
    equityValue: NaN,
    valuePerShare: NaN,
    terminalShare: NaN,
    terminalGrowthUsed,
  };
  if (wacc - terminalGrowthUsed < MIN_TERMINAL_SPREAD || wacc <= -1) return invalid;

  let presentValue = 0;
  factors.forEach((factor, i) => {
    presentValue += (fcff0 * factor) / Math.pow(1 + wacc, i + 1);
  });

  const lastFcff = fcff0 * (factors[HORIZON_YEARS - 1] ?? 1);
  const terminalValue = (lastFcff * (1 + terminalGrowthUsed)) / (wacc - terminalGrowthUsed);
  const terminalPresentValue = terminalValue / Math.pow(1 + wacc, HORIZON_YEARS);

  const enterpriseValue = presentValue + terminalPresentValue;
  const equityValue = enterpriseValue - company.totalDebt + company.cash;
  return {
    valid: true,
    enterpriseValue,
    equityValue,
    valuePerShare: company.sharesOutstanding > 0 ? equityValue / company.sharesOutstanding : NaN,
    terminalShare: enterpriseValue !== 0 ? terminalPresentValue / enterpriseValue : NaN,
    terminalGrowthUsed,
  };
}

export const GROWTH_SEARCH_MIN = -0.25;
export const GROWTH_SEARCH_MAX = 0.6;

/**
 * Reverse DCF: the five-year growth rate at which the model's equity value
 * equals today's market capitalisation. Returns null when no growth rate in
 * the search range reproduces the market price.
 */
export function impliedGrowth(company: CompanyInputs, market: MarketInputs): number | null {
  const gap = (g: number) => {
    const v = valueCompany(company, market, 0, g);
    return v.valid ? v.equityValue - company.marketCap : NaN;
  };
  let lo = GROWTH_SEARCH_MIN;
  let hi = GROWTH_SEARCH_MAX;
  const gapLo = gap(lo);
  const gapHi = gap(hi);
  if (!Number.isFinite(gapLo) || !Number.isFinite(gapHi)) return null;
  if (gapLo > 0 || gapHi < 0) return null;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (gap(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function runScenario(
  company: CompanyInputs,
  market: MarketInputs,
  shock: number,
  growth: number,
): Scenario {
  return {
    shock,
    capital: costOfCapital(company, market, shock),
    years: projectYears(company, market, shock, growth),
    valuation: valueCompany(company, market, shock, growth),
  };
}

export interface AnalyzeOptions {
  /** Solve for the growth rate that reproduces the market price instead of using `company.growth`. */
  calibrateToMarket: boolean;
}

export function analyze(
  company: CompanyInputs,
  market: MarketInputs,
  shock: number,
  options: AnalyzeOptions = { calibrateToMarket: true },
): Analysis {
  const implied = options.calibrateToMarket ? impliedGrowth(company, market) : null;
  const growth = implied ?? company.growth;

  const base = runScenario(company, market, 0, growth);
  const shocked = runScenario(company, market, shock, growth);

  const step = 0.01;
  const up = valueCompany(company, market, step, growth);
  const down = valueCompany(company, market, -step, growth);
  const v0 = base.valuation;
  const equityDuration =
    up.valid && down.valid && v0.valid && v0.equityValue > 0
      ? -(up.equityValue - down.equityValue) / (2 * step * v0.equityValue)
      : null;

  return {
    growth,
    growthIsCalibrated: implied !== null,
    fixedCoupon: fixedCoupon(company, market),
    averageCostOfDebt: averageCostOfDebt(company),
    base,
    shocked,
    equityDuration,
  };
}

export interface CurvePoint {
  shock: number;
  valid: boolean;
  valuePerShare: number;
  equityValue: number;
  /** Change in equity value against the no-shock case. */
  change: number;
}

/** Equity value across a range of shocks, holding the growth path fixed. */
export function sensitivityCurve(
  company: CompanyInputs,
  market: MarketInputs,
  growth: number,
  shocks: number[],
): CurvePoint[] {
  const base = valueCompany(company, market, 0, growth);
  return shocks.map((shock) => {
    const v = valueCompany(company, market, shock, growth);
    const comparable = v.valid && base.valid && base.equityValue > 0;
    return {
      shock,
      valid: v.valid,
      valuePerShare: v.valuePerShare,
      equityValue: v.equityValue,
      change: comparable ? v.equityValue / base.equityValue - 1 : NaN,
    };
  });
}

/** Evenly spaced shocks in basis points, returned as decimals. */
export function shockRange(minBp: number, maxBp: number, stepBp: number): number[] {
  const out: number[] = [];
  for (let bp = minBp; bp <= maxBp + 1e-9; bp += stepBp) out.push(bp / 10_000);
  return out;
}
