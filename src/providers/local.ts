import initSqlJs, { type Database } from "sql.js";
import type { ProposeInput, QueryResult, SqlExecutor, SqlModel } from "../core/types";

// Local read-only SQLite sandbox (sql.js / WASM). Lets us run real queries in tests and dev
// without a Cloudflare account. Production uses D1 (also SQLite) via the Cloudflare provider.
export class SqlJsExecutor implements SqlExecutor {
  private constructor(private readonly db: Database) {}

  static async create(setupSql: string): Promise<SqlJsExecutor> {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run(setupSql);
    return new SqlJsExecutor(db);
  }

  async execute(sql: string): Promise<QueryResult> {
    const res = this.db.exec(sql); // throws on SQL error
    if (res.length === 0) return { columns: [], rows: [], rowCount: 0 };
    const { columns, values } = res[0];
    return { columns, rows: values as unknown[][], rowCount: values.length };
  }
}

// Deterministic models for tests: a fixed script (returned in order) or a function of the input.
export class ScriptedSqlModel implements SqlModel {
  private i = 0;
  constructor(private readonly script: string[]) {}
  async propose(): Promise<string> {
    const r = this.script[Math.min(this.i, this.script.length - 1)];
    this.i++;
    return r;
  }
}

export class FnSqlModel implements SqlModel {
  constructor(private readonly fn: (input: ProposeInput) => string) {}
  async propose(input: ProposeInput): Promise<string> {
    return this.fn(input);
  }
}
