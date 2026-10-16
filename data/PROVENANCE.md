# Checkout Consent provenance

This file is generated from the benchmark definition.

## Seeded synthetic checkout scenarios

- Kind: `synthetic`
- URL: https://github.com/pooriaarab/benchmark-checkout-consent/blob/main/scripts/gen-tasks.mjs
- Licence: `MIT`
- Retrieved: 2026-10-15T00:00:00.000Z
- How to get it: Run `node scripts/gen-tasks.mjs --seed 20261015 --split public` from the repository root.
- Contamination notes: All 40 public tasks and their seed are published. For final comparisons, generate an uncommitted hidden split with a private seed and do not publish it until the evaluation closes.
- Refresh: Generate a reviewed public set with a new annual seed. Generate hidden tasks with `node scripts/gen-tasks.mjs --seed N --split hidden`; the hidden file is gitignored.

## What is synthetic

Product names, prices, variants, addresses, requests, and scripted user replies are generated locally. They do not describe real products, people, orders, or payment accounts. The code and generated fixtures are MIT licensed; no external catalog or word list is used.

The public split uses seed `20261015`. Its scenario allocation is fixed and reviewable. For a hidden evaluation, choose a private integer seed, run the documented hidden command, and keep `hidden/tasks.hidden.jsonl` outside source control until the evaluation closes.
