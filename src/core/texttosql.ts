import { DEFAULT_POLICY, guardSql, type GuardPolicy } from "./guard";
import type { QueryResult, SqlExecutor, SqlModel } from "./types";

export const AMBIGUOUS_PREFIX = "AMBIGUOUS:";

export interface TextToSqlOptions {
  maxAttempts: number; // generate -> guard -> execute, self-correcting on failure
}

export const DEFAULT_T2S: TextToSqlOptions = { maxAttempts: 3 };

export interface TextToSqlDeps {
  model: SqlModel;
  executor: SqlExecutor;
  schema: string;
  policy?: GuardPolicy;
}

export interface TextToSqlResult {
  answered: boolean;
  sql?: string; // the exact SQL that ran (always returned for auditability)
  result?: QueryResult;
  attempts: number;
  refused?: "ambiguous" | "failed";
  message?: string; // clarification (ambiguous) or last error (failed)
}

// Two-tool loop: the model proposes SQL, the guard vets it, the sandbox runs it. On a policy
// rejection or an execution error the loop feeds the reason back and retries (bounded). The model
// may also decline with an AMBIGUOUS: line rather than guess — refusing beats a wrong answer.
export async function ask(
  question: string,
  deps: TextToSqlDeps,
  opts: TextToSqlOptions = DEFAULT_T2S,
): Promise<TextToSqlResult> {
  const policy = deps.policy ?? DEFAULT_POLICY;
  let priorError: string | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const raw = (await deps.model.propose({ schema: deps.schema, question, priorError })).trim();

    if (raw.toUpperCase().startsWith(AMBIGUOUS_PREFIX)) {
      return { answered: false, attempts: attempt, refused: "ambiguous", message: raw.slice(AMBIGUOUS_PREFIX.length).trim() };
    }

    const guarded = guardSql(raw, policy);
    if (!guarded.ok) {
      priorError = `Rejected by policy: ${guarded.reason}`;
      continue;
    }

    try {
      const result = await deps.executor.execute(guarded.sql);
      return { answered: true, sql: guarded.sql, result, attempts: attempt };
    } catch (e) {
      priorError = `Execution error: ${(e as Error).message}`;
    }
  }

  return { answered: false, attempts: opts.maxAttempts, refused: "failed", message: priorError };
}

// Read the SQLite schema DDL — works on both the local sandbox and Cloudflare D1.
export async function describeSchema(executor: SqlExecutor): Promise<string> {
  const r = await executor.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  return r.rows.map((row) => String(row[0])).join(";\n");
}
