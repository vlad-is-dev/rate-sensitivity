import { describe, expect, it } from "vitest";
import {
  analyze,
  averageCostOfDebt,
  baseFcff,
  cashYield,
  costOfCapital,
  fixedCoupon,
  growthInYear,
  impliedGrowth,
  interestExpenseInYear,
  marketCostOfDebt,
  projectYears,
  repricedShare,
  sensitivityCurve,
  shockRange,
  valueCompany,
  type CompanyInputs,
  type MarketInputs,
} from "./model";
import { COMPANIES, MARKETS } from "./companies";

const market: MarketInputs = { riskFree: 0.04, equityRiskPremium: 0.05, cashYieldSpread: -0.005, growthPassThrough: 0 };

/** A simple company whose numbers can be checked by hand. */
const acme: CompanyInputs = {
  freeCashFlow: 10,
  ebit: 20,
  interestExpense: 5,
  taxRate: 0.25,
  totalDebt: 100,
  cash: 0,
  marketCap: 100,
  sharesOutstanding: 10,
  beta: 1,
  floatingShare: 0.2,
  refinancingYears: 10,
  creditSpread: 0.02,
  growth: 0.03,
  terminalGrowth: 0.02,
};

describe("cost of debt", () => {
  it("prices new debt at risk-free plus spread plus shock", () => {
    expect(marketCostOfDebt(acme, market)).toBeCloseTo(0.06);
    expect(marketCostOfDebt(acme, market, 0.01)).toBeCloseTo(0.07);
  });

  it("backs the fixed coupon out of the reported average rate", () => {
    // 5% average = 20% × 6% floating + 80% × fixed  →  fixed = 4.75%
    expect(averageCostOfDebt(acme)).toBeCloseTo(0.05);
    expect(fixedCoupon(acme, market)).toBeCloseTo(0.0475);
  });

  it("never returns a negative coupon", () => {
    expect(fixedCoupon({ ...acme, interestExpense: 0.1 }, market)).toBe(0);
  });
});

describe("repricing", () => {
  it("reprices floating debt at once and fixed debt along the ladder", () => {
    // year 1: 20% floating + 80% × (0.5 / 10) = 24%
    expect(repricedShare(acme, 1)).toBeCloseTo(0.24);
    expect(repricedShare(acme, 10)).toBeCloseTo(0.2 + 0.8 * 0.95);
    expect(repricedShare(acme, 30)).toBe(1);
  });

  it("matches a hand calculation of year-one interest under a +100 bp shock", () => {
    // 100 × (24% × 7% + 76% × 4.75%) = 5.29
    expect(interestExpenseInYear(acme, market, 0.01, 1)).toBeCloseTo(5.29);
  });

  it("passes a shock through fully once the whole book has refinanced", () => {
    const base = interestExpenseInYear(acme, market, 0, 40);
    const up = interestExpenseInYear(acme, market, 0.01, 40);
    expect(up - base).toBeCloseTo(acme.totalDebt * 0.01);
  });

  it("makes an all-floating company feel the whole shock in year one", () => {
    const floater = { ...acme, floatingShare: 1 };
    const delta =
      interestExpenseInYear(floater, market, 0.01, 1) - interestExpenseInYear(floater, market, 0, 1);
    expect(delta).toBeCloseTo(1);
  });

  it("raises interest expense monotonically with the shock", () => {
    const costs = [-0.02, -0.01, 0, 0.01, 0.02].map((s) => interestExpenseInYear(acme, market, s, 5));
    for (let i = 1; i < costs.length; i++) expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
  });
});

describe("cost of capital", () => {
  it("builds WACC from CAPM and the after-tax cost of debt", () => {
    const c = costOfCapital(acme, market);
    expect(c.costOfEquity).toBeCloseTo(0.09);
    expect(c.afterTaxCostOfDebt).toBeCloseTo(0.045);
    expect(c.equityWeight).toBeCloseTo(0.5);
    expect(c.wacc).toBeCloseTo(0.0675);
  });

  it("moves WACC by less than the shock because of the tax shield", () => {
    const delta = costOfCapital(acme, market, 0.01).wacc - costOfCapital(acme, market).wacc;
    // 0.5 × 1% + 0.5 × 1% × (1 − 25%) = 0.875%
    expect(delta).toBeCloseTo(0.00875);
  });
});

describe("cash flows", () => {
  it("adds after-tax net interest back to get unlevered cash flow", () => {
    expect(baseFcff(acme, market)).toBeCloseTo(10 + 5 * 0.75);
  });

  it("credits interest earned on cash", () => {
    const rich = { ...acme, cash: 40 };
    expect(cashYield(market)).toBeCloseTo(0.035);
    expect(baseFcff(rich, market)).toBeCloseTo(10 + (5 - 40 * 0.035) * 0.75);
  });

  it("leaves unlevered cash flow untouched by the shock", () => {
    const base = projectYears(acme, market, 0, 0.03);
    const up = projectYears(acme, market, 0.02, 0.03);
    base.forEach((y, i) => expect(up[i]!.fcff).toBeCloseTo(y.fcff));
  });

  it("lowers levered cash flow for a net borrower when rates rise", () => {
    const base = projectYears(acme, market, 0, 0.03);
    const up = projectYears(acme, market, 0.02, 0.03);
    base.forEach((y, i) => expect(up[i]!.leveredFcf).toBeLessThan(y.leveredFcf));
  });

  it("raises levered cash flow for a cash-rich company when rates rise", () => {
    const rich = { ...acme, cash: 300 };
    const base = projectYears(rich, market, 0, 0.03);
    const up = projectYears(rich, market, 0.02, 0.03);
    expect(up[0]!.leveredFcf).toBeGreaterThan(base[0]!.leveredFcf);
  });

  it("holds growth for five years and then fades to the terminal rate", () => {
    expect(growthInYear(0.1, 0.02, 1)).toBeCloseTo(0.1);
    expect(growthInYear(0.1, 0.02, 5)).toBeCloseTo(0.1);
    expect(growthInYear(0.1, 0.02, 10)).toBeCloseTo(0.02);
    expect(growthInYear(0.1, 0.02, 7)).toBeLessThan(0.1);
    expect(growthInYear(0.1, 0.02, 7)).toBeGreaterThan(0.02);
  });
});

describe("valuation", () => {
  it("collapses to the Gordon growth formula when growth is constant", () => {
    const steady = { ...acme, terminalGrowth: 0.02 };
    const v = valueCompany(steady, market, 0, 0.02);
    const fcff = baseFcff(steady, market);
    const wacc = costOfCapital(steady, market).wacc;
    expect(v.enterpriseValue).toBeCloseTo((fcff * 1.02) / (wacc - 0.02), 6);
    expect(v.equityValue).toBeCloseTo(v.enterpriseValue - 100, 6);
  });

  it("lowers value when rates rise and raises it when they fall", () => {
    const base = valueCompany(acme, market, 0, 0.03).equityValue;
    expect(valueCompany(acme, market, 0.01, 0.03).equityValue).toBeLessThan(base);
    expect(valueCompany(acme, market, -0.01, 0.03).equityValue).toBeGreaterThan(base);
  });

  it("caps terminal growth at the shocked risk-free rate", () => {
    const v = valueCompany(acme, market, -0.03, 0.03);
    expect(v.terminalGrowthUsed).toBeCloseTo(0.01);
  });

  it("softens the hit when part of the shock is inflation the company passes on", () => {
    const real = valueCompany(acme, market, 0.01, 0.03).equityValue;
    const inflation = valueCompany(acme, { ...market, growthPassThrough: 0.5 }, 0.01, 0.03);
    expect(inflation.terminalGrowthUsed).toBeCloseTo(0.025);
    expect(inflation.equityValue).toBeGreaterThan(real);
  });

  it("flags the valuation as invalid when WACC is too close to terminal growth", () => {
    const fragile = { ...acme, beta: 0, creditSpread: 0, terminalGrowth: 0.04 };
    expect(valueCompany(fragile, market, 0, 0.03).valid).toBe(false);
  });
});

describe("reverse DCF", () => {
  it("finds the growth rate that reproduces the market price", () => {
    const g = impliedGrowth(acme, market);
    expect(g).not.toBeNull();
    expect(valueCompany(acme, market, 0, g!).equityValue).toBeCloseTo(acme.marketCap, 4);
  });

  it("returns null when no growth rate in range can explain the price", () => {
    expect(impliedGrowth({ ...acme, marketCap: 1e9 }, market)).toBeNull();
  });
});

describe("analysis", () => {
  it("is a no-op at zero shock", () => {
    const a = analyze(acme, market, 0);
    expect(a.shocked.valuation.equityValue).toBeCloseTo(a.base.valuation.equityValue);
    expect(a.shocked.years[4]!.interestExpense).toBeCloseTo(a.base.years[4]!.interestExpense);
  });

  it("reports a positive equity duration for an ordinary company", () => {
    expect(analyze(acme, market, 0.01).equityDuration).toBeGreaterThan(0);
  });

  it("amplifies the equity move when there is more debt", () => {
    const curve = (c: CompanyInputs) => {
      const g = impliedGrowth(c, market)!;
      return sensitivityCurve(c, market, g, [0.01])[0]!.change;
    };
    const light = { ...acme, totalDebt: 10, interestExpense: 0.5 };
    expect(curve(acme)).toBeLessThan(curve(light));
  });

  it("builds an inclusive shock grid", () => {
    const grid = shockRange(-200, 300, 25);
    expect(grid[0]).toBeCloseTo(-0.02);
    expect(grid[grid.length - 1]).toBeCloseTo(0.03);
    expect(grid).toHaveLength(21);
  });
});

describe("bundled companies", () => {
  it.each(COMPANIES.map((c) => [c.name, c] as const))("%s calibrates to its market price", (_, preset) => {
    const m = MARKETS[preset.currency];
    const a = analyze(preset.inputs, m, 0.01);
    expect(a.growthIsCalibrated).toBe(true);
    expect(a.base.valuation.equityValue).toBeCloseTo(preset.inputs.marketCap, 3);
    expect(a.shocked.valuation.equityValue).toBeLessThan(a.base.valuation.equityValue);
  });

  it.each(COMPANIES.map((c) => [c.name, c] as const))("%s has a market cap consistent with price × shares", (_, preset) => {
    const implied = preset.sharePrice * preset.inputs.sharesOutstanding;
    expect(Math.abs(implied / preset.inputs.marketCap - 1)).toBeLessThan(0.02);
  });
});
