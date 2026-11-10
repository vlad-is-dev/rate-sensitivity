import type { CompanyInputs, MarketInputs } from "./model";

export type Currency = "USD" | "EUR";

export interface CompanyPreset {
  id: string;
  name: string;
  ticker: string;
  currency: Currency;
  /** One line on why this company is an interesting rate case. */
  note: string;
  /** Date of the share price behind the market capitalisation. */
  priceDate: string;
  sharePrice: number;
  /** Raw five-year beta as published; the model uses the Blume-adjusted value. */
  rawBeta: number;
  /** Whether the floating share and maturity ladder come from a filing or are placeholders. */
  debtMix: "disclosed" | "assumed";
  debtMixNote: string;
  /** Model inputs that are estimates rather than reported numbers. */
  estimated: string[];
  sourceUrl: string;
  inputs: CompanyInputs;
}

/** Blume adjustment: betas drift towards 1 over time. */
export const adjustBeta = (raw: number) => (2 / 3) * raw + 1 / 3;

/**
 * Market inputs by currency.
 *
 * USD risk-free rate and equity risk premium: Aswath Damodaran's implied ERP
 * update of 1 November 2026 (T-bond rate 5.29%, implied premium 4.41%).
 * EUR risk-free rate: 10-year Bund yield of 3.26% on 9 November 2026.
 * The same premium is used for both currencies.
 */
export const MARKETS: Record<Currency, MarketInputs> = {
  USD: { riskFree: 0.0529, equityRiskPremium: 0.0441, cashYieldSpread: -0.005, growthPassThrough: 0 },
  EUR: { riskFree: 0.0326, equityRiskPremium: 0.0441, cashYieldSpread: -0.005, growthPassThrough: 0 },
};

export const MARKET_SOURCES = [
  {
    label: "US risk-free rate and implied equity risk premium, 1 Nov 2026 (A. Damodaran, NYU Stern)",
    url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm",
  },
  {
    label: "German 10-year Bund yield, 9 Nov 2026 (Trading Economics)",
    url: "https://tradingeconomics.com/germany/government-bond-yield",
  },
];

/*
 * Company figures are trailing-twelve-month values from StockAnalysis.com
 * statistics pages, retrieved 10 November 2026. Amounts are in billions.
 * Interest expense is derived as EBIT / interest coverage where the page
 * reports coverage. Total debt includes lease liabilities.
 */
export const COMPANIES: CompanyPreset[] = [
  {
    id: "carnival",
    name: "Carnival",
    ticker: "CCL",
    currency: "USD",
    note: "Pandemic-era borrowing left a large debt pile; it pays almost no income tax, so interest has no tax shield.",
    priceDate: "2026-10-23",
    sharePrice: 26.11,
    rawBeta: 2.38,
    debtMix: "disclosed",
    debtMixNote:
      "15.4% floating per Carnival's debt schedule of 31 May 2026; ladder approximated from its maturity table.",
    estimated: ["Credit spread", "Refinancing ladder"],
    sourceUrl: "https://stockanalysis.com/stocks/ccl/statistics/",
    inputs: {
      freeCashFlow: 3.18,
      ebit: 4.39,
      interestExpense: 4.39 / 3.73,
      taxRate: 0.0101,
      totalDebt: 25.16,
      cash: 1.22,
      marketCap: 35.11,
      sharesOutstanding: 1.34,
      beta: adjustBeta(2.38),
      floatingShare: 0.154,
      refinancingYears: 8,
      creditSpread: 0.018,
      growth: 0.04,
      terminalGrowth: 0.025,
    },
  },
  {
    id: "att",
    name: "AT&T",
    ticker: "T",
    currency: "USD",
    note: "One of the largest corporate borrowers in the world, but almost all of it is long-dated fixed-rate bonds.",
    priceDate: "2026-10-27",
    sharePrice: 20.96,
    rawBeta: 0.44,
    debtMix: "assumed",
    debtMixNote:
      "AT&T's Q2 2026 10-Q reports no interest-rate swaps and no term-loan borrowings, so floating debt is set near zero. The 15-year ladder is an assumption.",
    estimated: ["Floating share", "Refinancing ladder", "Credit spread"],
    sourceUrl: "https://stockanalysis.com/stocks/t/statistics/",
    inputs: {
      freeCashFlow: 18.01,
      ebit: 29.11,
      interestExpense: 29.11 / 3.9,
      taxRate: 0.1904,
      totalDebt: 180.61,
      cash: 10.77,
      marketCap: 141.16,
      sharesOutstanding: 6.74,
      beta: adjustBeta(0.44),
      floatingShare: 0.02,
      refinancingYears: 15,
      creditSpread: 0.013,
      growth: 0.02,
      terminalGrowth: 0.02,
    },
  },
  {
    id: "bayer",
    name: "Bayer",
    ticker: "BAYN",
    currency: "EUR",
    note: "Debt from the Monsanto deal is almost as large as the market value of its equity, and interest cover is thin.",
    priceDate: "2026-10-23",
    sharePrice: 43.98,
    rawBeta: 0.84,
    debtMix: "assumed",
    debtMixNote: "Floating share and ladder are placeholders, not taken from Bayer's filings.",
    estimated: ["Floating share", "Refinancing ladder", "Credit spread", "Tax rate (25%; reported pre-tax result is negative)"],
    sourceUrl: "https://stockanalysis.com/quote/etr/BAYN/statistics/",
    inputs: {
      freeCashFlow: 2.08,
      ebit: 5.41,
      interestExpense: 5.41 / 2.71,
      taxRate: 0.25,
      totalDebt: 38.43,
      cash: 5.08,
      marketCap: 43.21,
      sharesOutstanding: 0.98242,
      beta: adjustBeta(0.84),
      floatingShare: 0.15,
      refinancingYears: 7,
      creditSpread: 0.015,
      growth: 0.03,
      terminalGrowth: 0.015,
    },
  },
  {
    id: "sap",
    name: "SAP",
    ticker: "SAP",
    currency: "EUR",
    note: "Holds about as much cash as debt. Rates barely touch its interest bill; the effect is all in the discount rate.",
    priceDate: "2026-10-23",
    sharePrice: 214.4,
    rawBeta: 0.76,
    debtMix: "assumed",
    debtMixNote: "Floating share and ladder are placeholders, not taken from SAP's filings.",
    estimated: ["Floating share", "Refinancing ladder", "Credit spread"],
    sourceUrl: "https://stockanalysis.com/quote/etr/SAP/statistics/",
    inputs: {
      freeCashFlow: 9.18,
      ebit: 11.47,
      interestExpense: 11.47 / 21.4,
      taxRate: 0.2791,
      totalDebt: 10.59,
      cash: 11.0,
      marketCap: 247.46,
      sharesOutstanding: 1.15,
      beta: adjustBeta(0.76),
      floatingShare: 0.15,
      refinancingYears: 6,
      creditSpread: 0.006,
      growth: 0.1,
      terminalGrowth: 0.02,
    },
  },
  {
    id: "apple",
    name: "Apple",
    ticker: "AAPL",
    currency: "USD",
    note: "More cash and securities than debt: higher rates raise its interest income while lowering its valuation.",
    priceDate: "2026-11-06",
    sharePrice: 342.37,
    rawBeta: 1.09,
    debtMix: "assumed",
    debtMixNote: "Floating share and ladder are placeholders, not taken from Apple's filings.",
    estimated: [
      "Interest expense (3.5% of debt; Apple no longer reports it separately)",
      "Floating share",
      "Refinancing ladder",
      "Credit spread",
    ],
    sourceUrl: "https://stockanalysis.com/stocks/aapl/statistics/",
    inputs: {
      freeCashFlow: 136.06,
      ebit: 158.06,
      interestExpense: 94.48 * 0.035,
      taxRate: 0.1699,
      totalDebt: 94.48,
      cash: 136.94,
      marketCap: 4980,
      sharesOutstanding: 14.53,
      beta: adjustBeta(1.09),
      floatingShare: 0.1,
      refinancingYears: 10,
      creditSpread: 0.004,
      growth: 0.08,
      terminalGrowth: 0.025,
    },
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    ticker: "NVDA",
    currency: "USD",
    note: "Almost no interest bill, yet highly rate-sensitive: its value sits in cash flows far in the future.",
    priceDate: "2026-11-06",
    sharePrice: 186.64,
    rawBeta: 2.25,
    debtMix: "assumed",
    debtMixNote: "Floating share and ladder are placeholders, not taken from NVIDIA's filings.",
    estimated: ["Floating share", "Refinancing ladder", "Credit spread"],
    sourceUrl: "https://stockanalysis.com/stocks/nvda/statistics/",
    inputs: {
      freeCashFlow: 127.01,
      ebit: 197.58,
      interestExpense: 197.58 / 425.82,
      taxRate: 0.1605,
      totalDebt: 38.86,
      cash: 62.47,
      marketCap: 4510,
      sharesOutstanding: 24.15,
      beta: adjustBeta(2.25),
      floatingShare: 0,
      refinancingYears: 10,
      creditSpread: 0.005,
      growth: 0.2,
      terminalGrowth: 0.025,
    },
  },
];

export const DATA_RETRIEVED = "2026-11-10";

export function getCompany(id: string): CompanyPreset {
  const found = COMPANIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown company: ${id}`);
  return found;
}
