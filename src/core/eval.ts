import { ask, type TextToSqlDeps, type TextToSqlOptions } from "./texttosql";

export interface GoldenCase {
  question: string;
  expectAnswered: boolean; // should it answer, or refuse (ambiguous/unanswerable)?
  expectFirstCell?: unknown; // optional: assert the top-left cell of the result (execution accuracy)
}

export interface EvalCase extends GoldenCase {
  gotAnswered: boolean;
  ok: boolean;
  sql?: string;
}

export interface EvalResult {
  total: number;
  correct: number;
  accuracy: number;
  cases: EvalCase[];
}

// Execution-accuracy style eval: did it answer when it should, refuse when it should, and (when
// checked) return the right value?
export async function evaluate(
  golden: GoldenCase[],
  deps: TextToSqlDeps,
  opts?: TextToSqlOptions,
): Promise<EvalResult> {
  const cases: EvalCase[] = [];
  let correct = 0;

  for (const g of golden) {
    const r = await ask(g.question, deps, opts);
    let ok = r.answered === g.expectAnswered;
    if (ok && g.expectAnswered && g.expectFirstCell !== undefined) {
      const cell = r.result?.rows[0]?.[0];
      ok = String(cell) === String(g.expectFirstCell);
    }
    if (ok) correct++;
    cases.push({ ...g, gotAnswered: r.answered, ok, sql: r.sql });
  }

  return { total: golden.length, correct, accuracy: golden.length ? correct / golden.length : 0, cases };
}
