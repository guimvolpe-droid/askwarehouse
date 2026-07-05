import { describe, it, expect, beforeAll } from "vitest";
import { SqlJsExecutor } from "../src/providers/local";
import { describeSchema } from "../src/core/texttosql";
import { SEED_SQL } from "../demo/seed";

let ex: SqlJsExecutor;

beforeAll(async () => {
  ex = await SqlJsExecutor.create(SEED_SQL);
});

describe("SqlJsExecutor + describeSchema", () => {
  it("runs a SELECT and returns columns + rows", async () => {
    const r = await ex.execute("SELECT count(*) AS n FROM orders");
    expect(r.columns).toEqual(["n"]);
    expect(Number(r.rows[0][0])).toBe(5);
  });

  it("reads the schema DDL for both tables", async () => {
    const s = await describeSchema(ex);
    expect(s).toMatch(/customers/);
    expect(s).toMatch(/orders/);
  });
});
