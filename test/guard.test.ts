import { describe, it, expect } from "vitest";
import { DEFAULT_POLICY, guardSql } from "../src/core/guard";

describe("guardSql", () => {
  it("rejects data-modifying statements", () => {
    for (const q of [
      "INSERT INTO orders VALUES (1)",
      "UPDATE orders SET amount=0",
      "DELETE FROM orders",
      "DROP TABLE orders",
    ]) {
      expect(guardSql(q).ok, q).toBe(false);
    }
  });

  it("rejects multiple statements", () => {
    expect(guardSql("SELECT 1; DROP TABLE orders").ok).toBe(false);
  });

  it("rejects non-read statements", () => {
    expect(guardSql("PRAGMA table_info(orders)").ok).toBe(false);
  });

  it("injects a LIMIT when absent and caps an oversized one", () => {
    const a = guardSql("SELECT id FROM orders", { ...DEFAULT_POLICY, maxRows: 100 });
    expect(a.ok).toBe(true);
    expect(a.sql).toMatch(/LIMIT 100$/);

    const b = guardSql("SELECT id FROM orders LIMIT 999999", { ...DEFAULT_POLICY, maxRows: 100 });
    expect(b.sql).toMatch(/LIMIT 100/);
  });

  it("enforces a table allowlist but permits CTE names", () => {
    const p = { ...DEFAULT_POLICY, allowedTables: ["orders"] };
    expect(guardSql("SELECT id FROM customers", p).ok).toBe(false);
    expect(guardSql("SELECT id FROM orders", p).ok).toBe(true);
    expect(guardSql("WITH recent AS (SELECT * FROM orders) SELECT * FROM recent", p).ok).toBe(true);
  });

  it("can forbid SELECT *", () => {
    expect(guardSql("SELECT * FROM orders", { ...DEFAULT_POLICY, allowSelectStar: false }).ok).toBe(false);
    expect(guardSql("SELECT id FROM orders", { ...DEFAULT_POLICY, allowSelectStar: false }).ok).toBe(true);
  });
});
