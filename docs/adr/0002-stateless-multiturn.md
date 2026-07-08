# ADR 0002 — Stateless multi-turn: the client carries {question, sql} pairs

Status: accepted · Date: 2026-07-08

## Context

Analytics is conversational: "total paid revenue by customer" is followed by "only the top 5" or
"and in Q2?". Answering follow-ups needs context from the previous turns. The obvious place to
keep that context — server-side session state — costs a session store (D1 table, Durable Object)
and turns every Worker instance into a stateful dependency.

## Decision

Multi-turn context is **carried by the client**: each request may include `history`, an array of
`{ question, sql }` pairs from previously *answered* turns. The Worker stays completely stateless.

- **Why `sql` and not results:** the SQL is compact, is already returned on every answer (the
  auditability contract), and is exactly what the model needs to refine — a follow-up is "take
  the last query and narrow it", not "re-read the last result". Result rows can be large and add
  nothing to query refinement.
- **The guard trusts nothing:** history is *model input*, not an execution channel. Every proposed
  statement of every turn goes through the same read-only guard (single statement, SELECT/WITH
  only, LIMIT cap, table allowlist). The Worker also sanitizes the incoming blob — strict
  `{question, sql}` mapping, incomplete turns dropped, capped at the last 8 turns.
- **Refusal still wins:** an ambiguous follow-up ("and the other ones?") gets the same
  `AMBIGUOUS:` refusal path as a first question.

The dashboard renders the conversation as a card-stack (one question → chart + table + exact SQL
per turn) and sends only answered turns as history; "New conversation" clears it.

## Consequences

- No session storage, no TTLs, no sticky routing — a turn is reproducible from its request alone,
  which also makes multi-turn behaviour fully testable offline (see `test/texttosql.test.ts`,
  "multi-turn refinement").
- The context window is bounded by design (8 turns × one SQL each), so prompt size stays flat.
- A malicious or corrupted history cannot widen access: it can only influence what SQL the model
  *proposes*, never what the guard *allows*.

## Alternatives considered

- **Server-side sessions (D1/Durable Object)** — rejected: state, expiry and affinity complexity
  for zero gain at this scale; it would also require deploy-gated infrastructure to test.
- **Sending previous results as context** — rejected: bloats the prompt, leaks more data than
  needed, and refining a query needs the query, not its rows.
