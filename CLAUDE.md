# askwarehouse — Regras do repo

Peça de portfólio do carreira-os (Cloudflare): text-to-SQL **read-only e guardado** — pergunta em
linguagem natural → Claude propõe SQL → guard decide o que roda (single statement, SELECT/WITH
only, LIMIT capado, allowlist) → D1 → resposta + chart + o SQL exato. Worker (Hono + D1 + Claude)
+ dashboard Angular/RxJS em `web/`. Decisão load-bearing: `docs/adr/0001-read-only-guard.md`
(o guard, não o modelo, decide o que executa). Core provider-agnostic (`src/core`), testado
offline contra SQLite (sql.js) — sem conta nem API key.

## Comandos

- `npm test` (suíte offline) · `npx wrangler dev` (Worker local) · `web/`: Angular padrão.

## Gates (só o dono decide)

- Deploy real na Cloudflare, chave de API paga, divulgação/uso em candidatura.
- Idioma do repo é EN (portfólio) — manter README/docs/commits deste repo em inglês.

## Artefatos: 3 destinos <!-- origem: ~/projects/CLAUDE.md · v1 · copiado 2026-07-28 -->

- Arquivo gerado (screenshot, dump, export, peça em rascunho) NUNCA na raiz: lixo → `descarte/`
  (gitignored, só o dono apaga) · reutilizável fora de uso → `bkp/AAAA-MM-<slug>/` (gitignored,
  indexado em `bkp/LEIA-ME.md`) · versão FINAL → caminho canônico, nome estável (sem -v2/-final).
- MDs de estado guardam SÓ estado final (sem "era X virou Y"); contradição = corrigir na hora.
