import { mkdir, writeFile } from "node:fs/promises";
import { provenanceMarkdown } from "benchmark-core";
import { benchmark } from "../dist/index.js";
const notes = `## What is synthetic

Product names, prices, variants, addresses, requests, and scripted user replies are generated locally. They do not describe real products, people, orders, or payment accounts. The code and generated fixtures are MIT licensed; no external catalog or word list is used.

The public split uses seed \`20261015\`. Its scenario allocation is fixed and reviewable. For a hidden evaluation, choose a private integer seed, run the documented hidden command, and keep \`hidden/tasks.hidden.jsonl\` outside source control until the evaluation closes.
`;
await mkdir("data", { recursive: true });
await writeFile("data/PROVENANCE.md", `${provenanceMarkdown(benchmark)}\n${notes}`);
console.log("wrote data/PROVENANCE.md");
