import { Hono } from "hono";
import { cors } from "hono/cors";
import { ask, DEFAULT_T2S, describeSchema } from "./core/texttosql";
import type { Turn } from "./core/types";
import { ClaudeSqlModel, D1Executor } from "./providers/cloudflare";

interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// The Angular dashboard is served from Cloudflare Pages (a different origin), so allow CORS.
app.use("*", cors());

// Multi-turn context is client-carried {question, sql} pairs — the Worker stays stateless.
// Don't trust the blob: strict map, drop incomplete turns, keep only the last 8.
function sanitizeHistory(history: unknown): Turn[] {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-8)
    .map((t) => ({
      question: String((t as { question?: unknown })?.question ?? ""),
      sql: String((t as { sql?: unknown })?.sql ?? ""),
    }))
    .filter((t) => t.question.length > 0 && t.sql.length > 0);
}

// Ask a question in plain English. Returns { answered, sql, result, attempts, refused?, message? }.
// Follow-ups send `history`; the guard still vets every statement of every turn.
app.post("/ask", async (c) => {
  const body = await c.req.json<{ question?: string; history?: unknown }>();
  const executor = new D1Executor(c.env.DB);
  const schema = await describeSchema(executor);
  const model = new ClaudeSqlModel(c.env.ANTHROPIC_API_KEY);
  const result = await ask(body.question ?? "", { model, executor, schema }, DEFAULT_T2S, sanitizeHistory(body.history));
  return c.json(result);
});

// Expose the schema so the UI can show what's queryable.
app.get("/schema", async (c) => c.json({ schema: await describeSchema(new D1Executor(c.env.DB)) }));

export default app;
