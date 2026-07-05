# ADR 0001 — A read-only guard, and refuse-don't-guess

Status: accepted · Date: 2026-07-05

## Context

A natural-language analytics tool generates SQL from a question and runs it against a real database.
Two things go wrong if you trust the model:

1. **Safety.** A generated statement could write, delete, drop, or launch a runaway full-table scan.
2. **Confidently wrong answers.** On an ambiguous question ("show me the good customers") the model will
   happily invent a definition of "good" and return a plausible, wrong result.

## Decision

**The guard, not the model, decides what runs.** Every proposed query passes through a deterministic gate
before it can touch data:

- single statement only;
- `SELECT` / `WITH` (read) queries only — no `INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/...`;
- an enforced `LIMIT` cap (injected if absent, capped if too large);
- an optional table allowlist (CTE-aware), so a query can be scoped to specific tables.

**The loop is self-correcting.** A guard rejection or an execution error is fed back to the model for a
bounded number of retries, so a first bad attempt is recovered rather than surfaced as a failure.

**Refuse, don't guess.** The model may answer with a single `AMBIGUOUS: <clarification>` line instead of
SQL. Ambiguity becomes a clarifying question, never a fabricated query.

**Always show the SQL.** Every answer returns the exact query that ran, so a human can audit it.

## Consequences

- Safety is a **property of the guard**, unit-tested with no LLM in the loop (`test/guard.test.ts`,
  `test/texttosql.test.ts`): writes, DDL, stacked statements, and out-of-scope tables are rejected; a
  missing `LIMIT` is added.
- Wrong-but-confident answers drop because the system refuses ambiguity instead of guessing.
- Transparency and trust: the returned SQL makes the answer checkable, and an execution-accuracy eval
  (`test/eval.test.ts`) measures whether it answers correctly and refuses when it should.

## Alternatives considered

- **Trust the model to be safe / to only read** — rejected: no guarantee, and a single bad generation is
  destructive.
- **Allow guarded writes behind human confirmation** — out of scope here; this is a read-only analytics
  copilot. The guard is built to allow that extension later (opt-in, per-operation) without weakening the
  default.
