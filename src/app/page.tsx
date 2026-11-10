import { Dashboard } from "@/components/Dashboard";
import { COMPANIES, DATA_RETRIEVED, MARKET_SOURCES } from "@/lib/companies";

const REPO = "https://github.com/vlad-is-dev/rate-sensitivity";

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export default function Page() {
  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Rate Sensitivity</h1>
          <p>What a move in interest rates does to a company&apos;s debt expense, cash flow and value.</p>
        </div>
        <nav aria-label="Page">
          <a href="#method">Method</a>
          <a href="#sources">Sources</a>
          <a href={REPO}>Code on GitHub</a>
        </nav>
      </header>

      <Dashboard />

      <section className="prose" id="method" aria-labelledby="method-heading">
        <h2 id="method-heading">How the model works</h2>
        <div className="prose-grid">
          <div>
            <h3>Debt expense</h3>
            <p>
              Debt is held constant and rolled over at par. A floating share reprices immediately; the fixed
              share matures evenly over the refinancing period and is replaced at the market rate, which is the
              government yield plus the company&apos;s credit spread plus the shock.
            </p>
            <pre>
              {`interest(t) = debt × [ s(t) × (rf + spread + shock)
                    + (1 − s(t)) × fixed coupon ]

s(t) = floating + (1 − floating) × (t − ½) / refinancing years`}
            </pre>
            <p>
              The fixed coupon is not an input. It is backed out so that the blend of floating and fixed debt
              matches the average rate the company reports today.
            </p>
          </div>
          <div>
            <h3>Free cash flow</h3>
            <p>
              Reported free cash flow is turned into unlevered cash flow by adding back net interest after tax.
              That stream grows at one rate for five years and fades to the long-run rate by year ten. Cash
              left for shareholders is the unlevered stream minus that year&apos;s net interest after tax.
            </p>
            <pre>
              {`unlevered FCF = FCF + (interest − cash × cash yield) × (1 − tax)

levered FCF(t) = unlevered FCF(t)
               − (interest(t) − cash × cash yield) × (1 − tax)`}
            </pre>
          </div>
          <div>
            <h3>Valuation</h3>
            <p>
              A ten-year discounted cash flow on the unlevered stream, with a Gordon-growth terminal value.
              The shock is added to the risk-free rate, which raises the cost of equity (CAPM) and the cost of
              new debt together.
            </p>
            <pre>
              {`cost of equity = rf + β × equity risk premium
WACC = E/V × cost of equity + D/V × cost of debt × (1 − tax)
equity value = Σ FCF(t)/(1+WACC)^t + terminal value − debt + cash`}
            </pre>
            <p>
              By default the five-year growth rate is solved so that the model reproduces today&apos;s market
              capitalisation (a reverse DCF). The results then read as a change against the current share
              price, and do not depend on a growth forecast of mine.
            </p>
          </div>
          <div>
            <h3>What it leaves out</h3>
            <ul>
              <li>
                The shock is parallel and permanent: every maturity moves by the same amount and stays there.
              </li>
              <li>
                Credit spreads and the equity risk premium do not react, although in practice they often widen
                when rates jump.
              </li>
              <li>
                Demand does not react. A cruise line or a carmaker sells less when borrowing gets expensive;
                here operating cash flow only changes if you set part of the shock to be inflation.
              </li>
              <li>
                Total debt includes lease liabilities, which do not reprice like bonds, and the average rate is
                interest expense divided by that total.
              </li>
              <li>
                Equity durations come out long because the discount rate moves one-for-one with the shock.
                Treat the valuation numbers as an upper bound on a pure real-rate shock.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="prose" id="sources" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Sources</h2>
        <p>
          Company figures are trailing-twelve-month values retrieved on {formatDate(DATA_RETRIEVED)}. Interest
          expense is derived from EBIT and reported interest cover. Items marked as estimates are my
          assumptions; change them in the panel if you have better numbers.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Share price date</th>
                <th scope="col">Estimates, not reported figures</th>
                <th scope="col">Data</th>
              </tr>
            </thead>
            <tbody>
              {COMPANIES.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.name} ({c.ticker})
                  </th>
                  <td>{formatDate(c.priceDate)}</td>
                  <td>{c.estimated.join("; ")}</td>
                  <td>
                    <a href={c.sourceUrl}>StockAnalysis</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="source-list">
          {MARKET_SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url}>{s.label}</a>
            </li>
          ))}
          <li>
            <a href="https://www.carnivalcorp.com/wp-content/uploads/2026/06/Debt-Schedule-as-of-May-31-2026.pdf">
              Carnival debt schedule, 31 May 2026
            </a>
          </li>
          <li>
            <a href="https://investors.att.com/~/media/Files/A/ATT-IR-V2/financial-reports/t-2026-06-30-10q.pdf">
              AT&amp;T Form 10-Q, second quarter 2026
            </a>
          </li>
        </ul>
      </section>

      <footer className="footer">
        <p>
          Built by <a href="https://github.com/vlad-is-dev">Vladislav Yakunin</a>. An educational model, not
          investment advice.
        </p>
      </footer>
    </main>
  );
}
