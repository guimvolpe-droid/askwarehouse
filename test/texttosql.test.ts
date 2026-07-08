import { describe, it, expect, beforeAll } from "vitest";
import { FnSqlModel, ScriptedSqlModel, SqlJsExecutor } from "../src/providers/local";
import { ask, type TextToSqlDeps } from "../src/core/texttosql";
import type { SqlModel } from "../src/core/types";
import { SEED_SQL } from "../demo/seed";

let executor: SqlJsExecutor;
const schema = "customers(id,name,country); orders(id,customer_id,amount,status,created_at)";

beforeAll(async () => {
  executor = await SqlJsExecutor.create(SEED_SQL);
});

const deps = (model: SqlModel): TextToSqlDeps => ({ model, executor, schema });

describe("text-to-SQL loop", () => {
  it("answers a valid query and returns the exact SQL that ran", async () => {
    const r = await ask(
      "total paid revenue",
      deps(new ScriptedSqlModel(["SELECT sum(amount) AS total FROM orders WHERE status='paid'"])),
    );
    expect(r.answered).toBe(true);
    expect(r.sql).toMatch(/sum\(amount\)/i);
    expect(Number(r.result!.rows[0][0])).toBe(375);
  });

  it("self-corrects after a policy rejection", async () => {
    const model = new ScriptedSqlModel(["DELETE FROM orders", "SELECT count(*) AS n FROM orders"]);
    const r = await ask("how many orders", deps(model));
    expect(r.answered).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it("refuses an ambiguous question instead of guessing", async () => {
    const r = await ask(
      "show me the good ones",
      deps(new ScriptedSqlModel(["AMBIGUOUS: which metric defines 'good'?"])),
    );
    expect(r.answered).toBe(false);
    expect(r.refused).toBe("ambiguous");
    expect(r.message).toMatch(/good/i);
  });

  it("gives up after max attempts on repeated execution errors", async () => {
    const r = await ask(
      "bad",
      deps(new ScriptedSqlModel(["SELECT id FROM does_not_exist"])),
      { maxAttempts: 2 },
    );
    expect(r.answered).toBe(false);
    expect(r.refused).toBe("failed");
    expect(r.attempts).toBe(2);
  });
});

describe("multi-turn refinement (client-carried history)", () => {
  // A model that behaves like a follow-up-aware LLM: with history it narrows the previous SQL.
  const followUpModel = () =>
    new FnSqlModel((input) => {
      if (!input.history?.length) return "SELECT sum(amount) AS total FROM orders";
      return input.history[input.history.length - 1].sql.replace(
        "FROM orders",
        "FROM orders WHERE status='paid'",
      );
    });

  it("a follow-up refines the previous turn's SQL and runs the refined query", async () => {
    const model = followUpModel();
    const first = await ask("total revenue", deps(model));
    expect(first.answered).toBe(true);
    expect(Number(first.result!.rows[0][0])).toBeGreaterThan(375); // all statuses

    const followUp = await ask("only the paid ones", deps(model), undefined, [
      { question: "total revenue", sql: first.sql! },
    ]);
    expect(followUp.answered).toBe(true);
    expect(followUp.sql).toContain("status='paid'");
    expect(Number(followUp.result!.rows[0][0])).toBe(375);
  });

  it("the guard vets every turn — a mutating follow-up is rejected and self-corrected", async () => {
    const model = new ScriptedSqlModel([
      "DELETE FROM orders WHERE status='pending'",
      "SELECT count(*) AS n FROM orders WHERE status='pending'",
    ]);
    const r = await ask("drop the pending ones", deps(model), undefined, [
      { question: "how many orders", sql: "SELECT count(*) AS n FROM orders" },
    ]);
    expect(r.answered).toBe(true);
    expect(r.attempts).toBe(2); // first proposal rejected by policy, not executed
    expect(r.sql).toMatch(/^SELECT/i);
  });

  it("an ambiguous follow-up still refuses instead of guessing", async () => {
    const r = await ask(
      "and the other ones?",
      deps(new ScriptedSqlModel(["AMBIGUOUS: other than what — status, customer, or period?"])),
      undefined,
      [{ question: "total paid revenue", sql: "SELECT sum(amount) FROM orders WHERE status='paid'" }],
    );
    expect(r.answered).toBe(false);
    expect(r.refused).toBe("ambiguous");
  });

  it("empty history behaves exactly like a single-turn ask (no history key sent)", async () => {
    const model = new FnSqlModel((input) => {
      expect(input.history).toBeUndefined();
      return "SELECT count(*) AS n FROM orders";
    });
    const r = await ask("how many orders", deps(model), undefined, []);
    expect(r.answered).toBe(true);
  });
});
