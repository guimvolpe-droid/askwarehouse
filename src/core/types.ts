// Provider-agnostic contracts. The text-to-SQL core depends only on these, so the guard,
// the self-correction loop, and the eval are all tested offline against a real SQLite sandbox.

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
}

export interface SqlExecutor {
  // Runs a query in a read-only sandbox. Implementations throw on SQL error.
  execute(sql: string): Promise<QueryResult>;
}

export interface SqlModel {
  // Returns a SQL string, or an ambiguity line starting with "AMBIGUOUS:" when the
  // question can't be answered unambiguously from the schema.
  propose(input: { schema: string; question: string; priorError?: string }): Promise<string>;
}
