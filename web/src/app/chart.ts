// Chart selection by result shape — pure data-in, model-out (no Angular, no DOM), so the
// heuristics are unit-tested from the root vitest suite and the component only renders.
//
// Forms follow the data's job: a single number → stat tile; a time series → line;
// categories with a measure → bars; anything else → table only.

export interface QueryResultLike {
  columns: string[];
  rows: unknown[][];
}

export interface Bar {
  label: string;
  value: number;
  pct: number; // 0..100, relative to the max value
  display: string;
}

export interface LinePoint {
  x: number;
  y: number;
  label: string;
  value: number;
  display: string;
  labelled: boolean; // selective direct labels: first, max and last — never every point
  anchor: "start" | "middle" | "end";
}

export type ChartModel =
  | { kind: "stat"; label: string; display: string }
  | {
      kind: "line";
      width: number;
      height: number;
      path: string;
      points: LinePoint[];
      xFirst: string;
      xLast: string;
      baselineY: number;
      topY: number;
      padL: number;
      padR: number;
    }
  | { kind: "bar"; bars: Bar[] }
  | { kind: "none" };

const MAX_BARS = 20;
const W = 600;
const H = 200;
const PAD = { l: 12, r: 12, t: 26, b: 26 };

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

// YYYY-MM / YYYY-MM-DD / YYYY-Qn, or a month name ("Jan", "January 2026").
const DATEISH = /^(\d{4}-\d{2}(-\d{2})?|\d{4}-?q[1-4])$/i;
const MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*( \d{4})?$/i;

function isDateLike(v: unknown): boolean {
  const s = String(v).trim();
  return DATEISH.test(s) || MONTHS.test(s);
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

export function buildChart(result: QueryResultLike): ChartModel {
  const { columns, rows } = result;

  // Single numeric value → a headline, not a chart.
  if (rows.length === 1 && columns.length === 1 && Number.isFinite(num(rows[0][0]))) {
    return { kind: "stat", label: columns[0], display: fmt.format(num(rows[0][0])) };
  }

  if (columns.length < 2) return { kind: "none" };

  const pairs = rows
    .map((row) => ({ label: String(row[0]), value: num(row[1]) }))
    .filter((p) => Number.isFinite(p.value));
  if (pairs.length === 0) return { kind: "none" };

  // Time series: every label date-like and at least three points.
  if (pairs.length >= 3 && pairs.every((p) => isDateLike(p.label))) {
    return line(pairs);
  }

  const bars = pairs.slice(0, MAX_BARS);
  const max = Math.max(...bars.map((b) => b.value), 0);
  return {
    kind: "bar",
    bars: bars.map(
      (b): Bar => ({
        label: b.label,
        value: b.value,
        pct: max > 0 ? Math.max((b.value / max) * 100, 0) : 0,
        display: fmt.format(b.value),
      }),
    ),
  };
}

function line(pairs: { label: string; value: number }[]): ChartModel {
  const values = pairs.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // flat series renders as a mid-height line
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxIdx = values.indexOf(max);

  const points = pairs.map((p, i): LinePoint => {
    const x = PAD.l + (pairs.length === 1 ? innerW / 2 : (i / (pairs.length - 1)) * innerW);
    const y = PAD.t + (1 - (p.value - min) / span) * innerH;
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      label: p.label,
      value: p.value,
      display: fmt.format(p.value),
      labelled: i === 0 || i === pairs.length - 1 || i === maxIdx,
      anchor: i === 0 ? "start" : i === pairs.length - 1 ? "end" : "middle",
    };
  });

  return {
    kind: "line",
    width: W,
    height: H,
    path: points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" "),
    points,
    xFirst: pairs[0].label,
    xLast: pairs[pairs.length - 1].label,
    baselineY: PAD.t + innerH,
    topY: PAD.t,
    padL: PAD.l,
    padR: PAD.r,
  };
}
