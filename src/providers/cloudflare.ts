import { AMBIGUOUS_PREFIX } from "../core/texttosql";
import type { QueryResult, SqlExecutor, SqlModel } from "../core/types";

// Production providers. Not exercised by the offline test suite; verified at deploy (needs a
// Cloudflare account = the owner's budget gate). The guard + loop are identical either way.

// Cloudflare D1 (SQLite) as the read-only sandbox. The guard guarantees SELECT-only before we reach here.
export class D1Executor implements SqlExecutor {
  constructor(private readonly db: D1Database) {}

  async execute(sql: string): Promise<QueryResult> {
    const res = await this.db.prepare(sql).all();
    const rows = (res.results ?? []) as Record<string, unknown>[];
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { columns, rows: rows.map((r) => columns.map((c) => r[c])), rowCount: rows.length };
  }
}

const SQL_SYSTEM = [
  "You translate a question into a single read-only SQLite SELECT query over the given schema.",
  "Use ONLY the tables and columns in the schema. Return ONLY the SQL — no prose, no code fences.",
  `If the question is ambiguous or cannot be answered from the schema, reply with one line: "${AMBIGUOUS_PREFIX} <what needs clarifying>".`,
  "Never write to the database.",
].join(" ");

// Claude (Sonnet for tool-use quality) proposes the SQL. Cheap/strong split is a config choice.
export class ClaudeSqlModel implements SqlModel {
  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-sonnet-5",
    private readonly baseUrl = "https://api.anthropic.com",
  ) {}

  async propose(input: { schema: string; question: string; priorError?: string }): Promise<string> {
    const user =
      `Schema:\n${input.schema}\n\nQuestion: ${input.question}` +
      (input.priorError ? `\n\nYour previous attempt failed: ${input.priorError}\nReturn a corrected query.` : "");

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 700,
        system: SQL_SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    return stripFences(text);
  }
}

function stripFences(s: string): string {
  return s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
}
