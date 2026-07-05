import { describe, it, expect, beforeAll } from "vitest";
import { FnSqlModel, SqlJsExecutor } from "../src/providers/local";
import { evaluate, type GoldenCase } from "../src/core/eval";
import type { TextToSqlDeps } from "../src/core/texttosql";
import { SEED_SQL } from "../demo/seed";

let executor: SqlJsExecutor;

beforeAll(async () => {
  executor = await SqlJsExecutor.create(SEED_SQL);
});

const ANSWERS: Record<string, string> = {
  "how many customers": "SELECT count(*) AS n FROM customers",
  "total paid revenue": "SELECT sum(amount) AS total FROM orders WHERE status='paid'",
  "which are the good orders": "AMBIGUOUS: define 'good'",
};

const GOLDEN: GoldenCase[] = [
  { question: "how many customers", expectAnswered: true, expectFirstCell: 3 },
  { question: "total paid revenue", expectAnswered: true, expectFirstCell: 375 },
  { question: "which are the good orders", expectAnswered: false },
];

describe("execution-accuracy eval", () => {
  it("answers correctly when possible and refuses ambiguity (100% on the golden set)", async () => {
    const model = new FnSqlModel((i) => ANSWERS[i.question] ?? "AMBIGUOUS: unknown");
    const deps: TextToSqlDeps = { model, executor, schema: "" };
    const res = await evaluate(GOLDEN, deps);
    expect(res.accuracy).toBe(1);
    expect(res.cases.every((c) => c.ok)).toBe(true);
  });
});
