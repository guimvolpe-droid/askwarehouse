// The security core: everything the model proposes passes through here before it can touch data.
// Read-only, single-statement, no DDL/DML, row cap enforced, optional table allowlist.

export interface GuardPolicy {
  allowedTables: string[]; // empty => any table
  maxRows: number; // enforced LIMIT cap
  allowSelectStar: boolean;
}

export const DEFAULT_POLICY: GuardPolicy = { allowedTables: [], maxRows: 1000, allowSelectStar: true };

export interface GuardResult {
  ok: boolean;
  sql: string; // possibly rewritten (LIMIT injected/capped)
  reason?: string;
}

const FORBIDDEN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i;

export function guardSql(rawSql: string, policy: GuardPolicy = DEFAULT_POLICY): GuardResult {
  let sql = stripComments(rawSql).trim().replace(/;+\s*$/, "").trim();

  if (!sql) return { ok: false, sql: rawSql, reason: "empty query" };
  if (sql.includes(";")) return { ok: false, sql: rawSql, reason: "only a single statement is allowed" };

  const head = sql.replace(/^\(+/, "").trimStart();
  if (!/^(SELECT|WITH)\b/i.test(head)) {
    return { ok: false, sql: rawSql, reason: "only read-only SELECT/WITH queries are allowed" };
  }
  if (FORBIDDEN.test(sql)) {
    return { ok: false, sql: rawSql, reason: "data-modifying or DDL statements are not allowed" };
  }
  if (!policy.allowSelectStar && /\bSELECT\s+\*/i.test(sql)) {
    return { ok: false, sql: rawSql, reason: "SELECT * is not allowed; list columns explicitly" };
  }
  if (policy.allowedTables.length) {
    const allowed = policy.allowedTables.map((t) => t.toLowerCase());
    const bad = referencedTables(sql).filter((t) => !allowed.includes(t.toLowerCase()));
    if (bad.length) return { ok: false, sql: rawSql, reason: `table(s) out of scope: ${bad.join(", ")}` };
  }

  return { ok: true, sql: enforceLimit(sql, policy.maxRows) };
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

function enforceLimit(sql: string, max: number): string {
  const m = sql.match(/\bLIMIT\s+(\d+)\b/i);
  if (m) {
    const n = Math.min(parseInt(m[1], 10), max);
    return sql.replace(/\bLIMIT\s+\d+\b/i, `LIMIT ${n}`);
  }
  return `${sql} LIMIT ${max}`;
}

// Best-effort: the tables referenced after FROM/JOIN, excluding CTE names declared with WITH ... AS (...).
function referencedTables(sql: string): string[] {
  const ctes = new Set<string>();
  const cteRe = /(?:\bWITH\b|,)\s*([A-Za-z_]\w*)\s+AS\s*\(/gi;
  for (let m = cteRe.exec(sql); m; m = cteRe.exec(sql)) ctes.add(m[1].toLowerCase());

  const tables = new Set<string>();
  const re = /\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    if (!ctes.has(m[1].toLowerCase())) tables.add(m[1]);
  }
  return [...tables];
}
