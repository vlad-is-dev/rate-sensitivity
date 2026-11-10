import type { Currency } from "./companies";

const SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€" };

/** Format an amount given in billions, e.g. 1.18 → "$1.18bn", 4980 → "$4.98tn". */
export function money(billions: number, currency: Currency, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(billions)) return "n/a";
  const abs = Math.abs(billions);
  const sign = billions < 0 ? "−" : opts.sign && billions > 0 ? "+" : "";
  let body: string;
  if (abs >= 1000) body = `${(abs / 1000).toFixed(2)}tn`;
  else if (abs >= 100) body = `${abs.toFixed(0)}bn`;
  else if (abs >= 10) body = `${abs.toFixed(1)}bn`;
  else if (abs >= 1) body = `${abs.toFixed(2)}bn`;
  else body = `${(abs * 1000).toFixed(0)}m`;
  return `${sign}${SYMBOL[currency]}${body}`;
}

export function perShare(value: number, currency: Currency): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${SYMBOL[currency]}${value.toFixed(2)}`;
}

export function pct(value: number, digits = 1, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "n/a";
  const v = value * 100;
  const rounded = Number(v.toFixed(digits));
  const sign = rounded < 0 ? "−" : opts.sign && rounded > 0 ? "+" : "";
  return `${sign}${Math.abs(rounded).toFixed(digits)}%`;
}

/** Format a shock given as a decimal in basis points, e.g. 0.01 → "+100 bp". */
export function bp(shock: number): string {
  const v = Math.round(shock * 10_000);
  if (v === 0) return "0 bp";
  return `${v > 0 ? "+" : "−"}${Math.abs(v)} bp`;
}

export function multiple(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value >= 100) return `${value.toFixed(0)}×`;
  return `${value.toFixed(1)}×`;
}

/** Round tick values for an axis covering [min, max]. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const rawStep = (max - min) / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const step = (residual >= 5 ? 5 : residual >= 2 ? 2 : 1) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}
