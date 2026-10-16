#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { bootstrapCI, createCli, mockAdapter, openaiCompatAdapter, openrouterAdapter, renderMarkdown, run as runBenchmark, serve, type Benchmark, type ModelAdapter, type RunOptions, type RunReport, type Task } from "benchmark-core";
import { createApiHandler } from "./api.js";
import { benchmark, benchmarkWithTasks } from "./benchmark.js";
import { attachBreakdown, breakdownMarkdown, type ReportWithBreakdown } from "./report.js";

class UsageError extends Error {}

let tasksFile: string | undefined;
const rest: string[] = [];
const rawArgs = process.argv.slice(2);
for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index] ?? "";
  if (arg === "--tasks") { index += 1; tasksFile = rawArgs[index] ?? ""; }
  else if (arg.startsWith("--tasks=")) tasksFile = arg.slice("--tasks=".length);
  else rest.push(arg);
}
const bench: Benchmark<Task> = tasksFile ? benchmarkWithTasks(tasksFile) : benchmark;

function adapterFor(provider: string, model: string, seed: number): ModelAdapter {
  if (provider === "mock") return mockAdapter({ seed, ...(bench.definition.mockPolicies ? { policies: bench.definition.mockPolicies } : {}) });
  if (provider === "openrouter") return openrouterAdapter({ model });
  if (provider === "openai") return openaiCompatAdapter({ model });
  throw new UsageError("--provider must be openrouter, openai, or mock.");
}

function printReport(report: ReportWithBreakdown, jsonOutput: boolean) {
  console.log(jsonOutput ? JSON.stringify(report) : `${renderMarkdown(report)}${breakdownMarkdown(report.breakdown)}`);
}

async function main(argv: string[]): Promise<number> {
  const command = argv[0];
  const jsonOutput = argv.slice(1).includes("--json");
  const clean = argv.slice(1).filter((arg) => arg !== "--json");
  if (command === "run") {
    const withDefaults = [...clean];
    const mock = withDefaults.includes("--provider=mock") || (withDefaults.includes("--provider") && withDefaults[withDefaults.indexOf("--provider") + 1] === "mock");
    if (mock && !withDefaults.some((arg) => arg === "--model" || arg.startsWith("--model="))) withDefaults.push("--model", "offline");
    const parsed = parseArgs({ args: withDefaults, options: { model: { type: "string" }, provider: { type: "string" }, concurrency: { type: "string" }, timeout: { type: "string" }, retries: { type: "string" }, seed: { type: "string" }, "max-turns": { type: "string" }, "max-tool-calls": { type: "string" }, budget: { type: "string" } }, strict: true });
    const model = parsed.values.model;
    const provider = parsed.values.provider;
    if (!model || !provider) throw new UsageError("run needs --model and --provider.");
    const seed = Number(parsed.values.seed ?? 1);
    const options: RunOptions = { seed };
    if (parsed.values.concurrency) options.concurrency = Number(parsed.values.concurrency);
    if (parsed.values.timeout) options.timeoutMs = Number(parsed.values.timeout);
    if (parsed.values.retries) options.retries = Number(parsed.values.retries);
    if (parsed.values["max-turns"]) options.maxTurns = Number(parsed.values["max-turns"]);
    if (parsed.values["max-tool-calls"]) options.maxToolCalls = Number(parsed.values["max-tool-calls"]);
    if (parsed.values.budget) options.budgetUsd = Number(parsed.values.budget);
    const report = await attachBreakdown(bench, await runBenchmark(bench, adapterFor(provider, model, seed), options));
    printReport(report, jsonOutput);
    return report.rows.some((row) => row.error) ? 2 : 0;
  }
  if (command === "score") {
    const file = clean[0];
    if (!file) throw new UsageError("score needs a results JSON file.");
    const original = JSON.parse(await readFile(file, "utf8")) as RunReport;
    if (!Array.isArray(original?.rows)) throw new UsageError("File is not a run report.");
    const rows = [];
    for (const row of original.rows) {
      const task = await bench.getTask(row.taskId);
      if (!task || row.submission === undefined) throw new UsageError(`Cannot score task ${row.taskId}.`);
      const grade = await bench.score(task, row.submission, { seed: original.seed });
      rows.push({ ...row, score: grade.score, reason: grade.reason });
    }
    const scores = rows.map((row) => row.score);
    const rescored = { ...original, rows, mean: scores.reduce((sum, value) => sum + value, 0) / scores.length, confidenceInterval95: bootstrapCI(scores, original.seed) };
    printReport(await attachBreakdown(bench, rescored), jsonOutput);
    return 0;
  }
  if (command === "serve") {
    const parsed = parseArgs({ args: clean, options: { host: { type: "string" } }, allowPositionals: true, strict: true });
    if (parsed.positionals.length > 1) throw new UsageError("serve accepts at most one port.");
    const port = Number(parsed.positionals[0] ?? process.env.PORT ?? 3000);
    const hostname = parsed.values.host ?? "127.0.0.1";
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new UsageError("serve port must be an integer from 0 to 65535.");
    if (!hostname.trim()) throw new UsageError("--host must not be empty.");
    await serve(createApiHandler(tasksFile), { port, hostname });
    console.log(jsonOutput ? JSON.stringify({ listening: port, host: hostname }) : `Listening on http://${hostname}:${port}`);
    return 0;
  }
  return createCli(bench, { bin: "benchmark-checkout-consent" }).main(argv);
}

try {
  if (tasksFile !== undefined && !tasksFile) throw new UsageError("--tasks needs a path to a tasks JSONL file.");
  process.exitCode = await main(rest);
} catch (caught) {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(message);
  const usage = caught instanceof UsageError || (typeof Reflect.get(caught ?? {}, "code") === "string" && (Reflect.get(caught ?? {}, "code") as string).startsWith("ERR_PARSE_ARGS"));
  if (usage) console.error(`Usage: benchmark-checkout-consent <list|show|run|score|card|provenance|index-entry|serve|mcp> [options] [--tasks <tasks.jsonl>]`);
  process.exitCode = usage ? 1 : 2;
}
