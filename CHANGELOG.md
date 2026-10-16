# Changelog

## 0.2.0 - 2026-10-16

Scoring changed; results from `0.1.0` are not comparable.

- The outcome ledger rule now gates the whole score: a trace that never reaches the scripted pay or decline scores `0` instead of up to `0.75`.
- The cap rule earns credit only after a correct pay or decline.
- Each `ask_user` call beyond the needed ones subtracts `0.05`.
- Consent matching normalises money (`$38.25`, `38.25 USD`, `3825 cents`) and common street abbreviations instead of requiring exact strings.
- The upsell scenario now offers an upgrade with the quote, and quantity-variant-swap substitutes a variant once and releases its scripted correction.
- `run` and `score` reports expose a `breakdown` with per-rule pass counts, per-scenario means, and `ask_user` totals.
- A `--tasks <path>` option runs an alternate split file on the CLI, the SDK `run(adapter, { tasks })`, and the API (`?tasks=` or a POST `tasks` field).
- The hidden split is generated fully from its private seed — product, variant, quantity, address, prices, and scenario order — and writes to `hidden/tasks.hidden.jsonl`, outside the packaged `data/` directory.

## 0.1.0 - 2026-10-15

Initial public release: 40 seeded checkout episodes, deterministic ledger grader, SDK, CLI, MCP server, and HTTP API.
