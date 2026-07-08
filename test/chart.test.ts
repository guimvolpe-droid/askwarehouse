import { describe, it, expect } from "vitest";
import { buildChart } from "../web/src/app/chart";

// The chart heuristics are pure (no Angular, no DOM), so the shape → form decision
// is proven here in the root suite; the component only renders the model.

describe("buildChart: form follows the result's shape", () => {
  it("1 row × 1 numeric column → stat tile", () => {
    const c = buildChart({ columns: ["total_cents"], rows: [[123456]] });
    expect(c.kind).toBe("stat");
    if (c.kind !== "stat") return;
    expect(c.label).toBe("total_cents");
    expect(c.display).toBe("123,456");
  });

  it("date-like first column + numeric second + ≥3 rows → line", () => {
    const c = buildChart({
      columns: ["month", "revenue"],
      rows: [
        ["2026-01", 100],
        ["2026-02", 300],
        ["2026-03", 200],
      ],
    });
    expect(c.kind).toBe("line");
    if (c.kind !== "line") return;
    expect(c.points).toHaveLength(3);
    // Peak (300) sits above the others: smaller y = higher on screen.
    expect(c.points[1].y).toBeLessThan(c.points[0].y);
    expect(c.points[1].y).toBeLessThan(c.points[2].y);
    // First, max and last are direct-labelled — never every point.
    expect(c.points.map((p) => p.labelled)).toEqual([true, true, true]);
    expect(c.path.startsWith("M")).toBe(true);
    expect(c.xFirst).toBe("2026-01");
    expect(c.xLast).toBe("2026-03");
  });

  it("labels only first, max and last on longer series", () => {
    const rows: unknown[][] = [
      ["2026-01", 10],
      ["2026-02", 50],
      ["2026-03", 20],
      ["2026-04", 30],
    ];
    const c = buildChart({ columns: ["month", "v"], rows });
    if (c.kind !== "line") throw new Error("expected line");
    expect(c.points.map((p) => p.labelled)).toEqual([true, true, false, true]);
  });

  it("categorical first column + numeric second → bar, capped at 20", () => {
    const rows: unknown[][] = Array.from({ length: 30 }, (_, i) => [`customer ${i}`, i + 1]);
    const c = buildChart({ columns: ["customer", "orders"], rows });
    expect(c.kind).toBe("bar");
    if (c.kind !== "bar") return;
    expect(c.bars).toHaveLength(20);
    const top = c.bars.reduce((a, b) => (b.value > a.value ? b : a));
    expect(top.pct).toBe(100);
  });

  it("two date-like rows are too few for a line — falls back to bar", () => {
    const c = buildChart({
      columns: ["month", "v"],
      rows: [
        ["2026-01", 1],
        ["2026-02", 2],
      ],
    });
    expect(c.kind).toBe("bar");
  });

  it("non-numeric values are filtered; all-text results get no chart", () => {
    const mixed = buildChart({
      columns: ["name", "score"],
      rows: [
        ["a", 10],
        ["b", "n/a"],
      ],
    });
    if (mixed.kind !== "bar") throw new Error("expected bar");
    expect(mixed.bars).toHaveLength(1);

    const text = buildChart({
      columns: ["name", "city"],
      rows: [
        ["a", "Lisbon"],
        ["b", "Porto"],
      ],
    });
    expect(text.kind).toBe("none");
  });

  it("single non-numeric cell and empty results get no chart", () => {
    expect(buildChart({ columns: ["name"], rows: [["acme"]] }).kind).toBe("none");
    expect(buildChart({ columns: ["a", "b"], rows: [] }).kind).toBe("none");
  });

  it("a flat series still renders (no divide-by-zero)", () => {
    const c = buildChart({
      columns: ["month", "v"],
      rows: [
        ["2026-01", 5],
        ["2026-02", 5],
        ["2026-03", 5],
      ],
    });
    if (c.kind !== "line") throw new Error("expected line");
    const ys = new Set(c.points.map((p) => p.y));
    expect(ys.size).toBe(1);
    expect(Number.isFinite(c.points[0].y)).toBe(true);
  });
});
