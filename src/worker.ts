import { Hono } from "hono";
import { cors } from "hono/cors";
import { ask, describeSchema } from "./core/texttosql";
import { ClaudeSqlModel, D1Executor } from "./providers/cloudflare";

interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// The Angular dashboard is served from Cloudflare Pages (a different origin), so allow CORS.
app.use("*", cors());

// Ask a question in plain English. Returns { answered, sql, result, attempts, refused?, message? }.
app.post("/ask", async (c) => {
  const body = await c.req.json<{ question?: string }>();
  const executor = new D1Executor(c.env.DB);
  const schema = await describeSchema(executor);
  const model = new ClaudeSqlModel(c.env.ANTHROPIC_API_KEY);
  const result = await ask(body.question ?? "", { model, executor, schema });
  return c.json(result);
});

// Expose the schema so the UI can show what's queryable.
app.get("/schema", async (c) => c.json({ schema: await describeSchema(new D1Executor(c.env.DB)) }));

export default app;
