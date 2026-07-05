import { describe, it, expect, beforeAll } from "vitest";
import { ScriptedSqlModel, SqlJsExecutor } from "../src/providers/local";
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
