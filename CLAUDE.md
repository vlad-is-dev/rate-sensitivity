# CLAUDE.md

Interactive tool showing how a parallel interest-rate shock (−200…+300 bp) moves a company's debt expense, free cash flow and equity value. Static single-page app, deployed on Vercel (https://rate-sensitivity.vercel.app/).

## Stack

- Next.js 16 (App Router), React 19, TypeScript 5 (strict, `noUncheckedIndexedAccess`)
- Vitest for unit tests (model only, no component tests)
- Charts are hand-written SVG — no charting library; don't add one
- Font: `@fontsource-variable/archivo`; plain CSS in `src/app/globals.css`
- Node ≥ 22.12 recommended (CI uses 22). Vitest 5 declares `^22.12 || ^24 || >=26`; on Node 20 `npm ci` warns (EBADENGINE) but tests currently still pass. README still says "Node 20 or newer".

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

CI (`.github/workflows/ci.yml`) runs `npm ci` → typecheck → test → build. Run all three before considering a change done.

## Structure

```
src/
  lib/model.ts        financial model: pure functions, no UI, no I/O
  lib/model.test.ts   unit tests (hand calculations + bundled-company calibration)
  lib/companies.ts    6 company presets + market inputs (USD/EUR), with sources
  lib/format.ts       money/percent/bp formatting (amounts are in billions)
  components/
    Dashboard.tsx     client component: all state, calls analyze()/sensitivityCurve()
    ShockRuler.tsx    shock slider (SHOCK_MIN_BP/MAX_BP/STEP_BP constants)
    Assumptions.tsx   editable inputs panel
    LineChart.tsx     SVG line chart with hover
    PeerBars.tsx      peer comparison bars
  app/page.tsx        page shell + "How the model works" / sources prose
  app/layout.tsx, globals.css, icon.svg
```

Import alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.mts`).

## How the calculations work (`src/lib/model.ts`)

Units: money in **billions** of reporting currency, rates as **decimals** (0.05 = 5%), shock as a decimal (100 bp = 0.01). Horizon 10 years; growth flat for years 1–5 (`STAGE_ONE_YEARS`) then fades linearly to terminal by year 10.

1. **Debt expense.** Debt is constant, rolled at par.
   - `marketCostOfDebt = max(0, rf + shock + creditSpread)`
   - `repricedShare(t) = floating + (1 − floating) × clamp((t − ½) / refinancingYears, 0, 1)`
   - `fixedCoupon` is *not* an input: backed out so floating×market + fixed×(1−floating) equals reported `interestExpense / totalDebt`.
   - `interest(t) = debt × [s(t) × marketCost + (1 − s(t)) × fixedCoupon]`
2. **Free cash flow.** `baseFcff = FCF + (interest − cash × cashYield) × (1 − tax)` (unlevered). Unlevered FCF is unaffected by the shock; `leveredFcf(t) = fcff(t) − (interest(t) − interestIncome) × (1 − tax)`. `cashYield = max(0, rf + shock + cashYieldSpread)`.
3. **Valuation.** CAPM cost of equity `rf + shock + β × ERP`; WACC with market-value weights (marketCap vs totalDebt). 10-year DCF on unlevered FCF + Gordon terminal value; `equity = EV − debt + cash`. Invalid if `WACC − g < MIN_TERMINAL_SPREAD` (0.5%) → values are `NaN`, `valid: false`.
   - Terminal growth after shock: `min(terminalGrowth + passThrough × shock, max(rf + shock, 0))` — the cap causes the visible kink for big cuts.
4. **Reverse DCF** (`impliedGrowth`): bisection over growth ∈ [−25%, 60%] so base equity value = market cap. Default in `analyze()` (`calibrateToMarket: true`); falls back to `company.growth` if no solution.
5. **`analyze()`** returns base and shocked `Scenario`s plus `equityDuration` (central difference at ±100 bp). `sensitivityCurve()` values a grid of shocks with growth held fixed.

## Conventions

- Keep `model.ts` pure and UI-free; every new formula gets a hand-checkable test in `model.test.ts`.
- Tests assert every bundled company calibrates to its market cap and that price × shares ≈ market cap (±2%). Changing data in `companies.ts` must keep these passing.
- Data in `companies.ts` is sourced and dated; estimated inputs are listed in each preset's `estimated` array and flagged in the UI. Update `DATA_RETRIEVED`, sources and the README data table together.
- If formulas change, update the prose in `src/app/page.tsx` and the README "The model" section to match.
- Betas are Blume-adjusted via `adjustBeta(raw)`; the raw beta is stored in `rawBeta`.
- UI text uses typographic minus (`−`) in formatted numbers (see `format.ts`).
