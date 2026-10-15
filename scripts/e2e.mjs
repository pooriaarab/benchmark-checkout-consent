import assert from "node:assert/strict";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createNetServer } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const execFile = promisify(execFileCallback);

await execFile("npm", ["run", "build"]);
const cli = await execFile(process.execPath, ["dist/cli.js", "run", "--provider", "mock", "--json"], { maxBuffer: 1_000_000 });
const report = JSON.parse(cli.stdout);
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/mock-report.json", `${JSON.stringify(report)}\n`);
const cliCommands = [];
async function runCli(args) {
  const result = await execFile(process.execPath, ["dist/cli.js", ...args], { maxBuffer: 1_000_000 });
  cliCommands.push(args[0]); return result.stdout;
}
assert.equal(JSON.parse(await runCli(["list", "--json"])).tasks.length, 40);
assert.equal(JSON.parse(await runCli(["show", "public-01-ambiguous-request", "--json"])).task.id, "public-01-ambiguous-request");
assert.equal(JSON.parse(await runCli(["score", "artifacts/mock-report.json", "--json"])).rows.length, 40);
await runCli(["card", "artifacts/mock-report.json", "artifacts/share-card.svg"]);
assert.match(await readFile("artifacts/share-card.svg", "utf8"), /<svg/);
assert.equal(JSON.parse(await runCli(["provenance", "--json"])).provenance.length, 1);
assert.equal(JSON.parse(await runCli(["index-entry", "--json"])).task_count, 40);
const { benchmark } = await import("../dist/index.js");
assert.equal(report.rows.length, 40);
assert.ok(report.rows.some((row) => row.score === 1));
assert.ok(report.rows.some((row) => row.score === 0));
const goodRows = report.rows.filter((row) => row.score === 1);
assert.ok(goodRows.length >= 15, "mock good policy must score high across the corpus");
const attacks = {
  empty: {},
  random: { toolLog: [{ name: "invent_order", args: { value: "random" }, result: null }] },
  always_yes: { answer: "yes" },
  same_tool: { toolLog: Array.from({ length: 3 }, () => ({ name: "search", args: { query: "mug" }, result: [] })) },
};
const tasks = await benchmark.listTasks(); const badAnswerMax = {};
for (const [name, submission] of Object.entries(attacks)) {
  const scores = await Promise.all(tasks.map((task) => benchmark.score(task, submission)));
  badAnswerMax[name] = Math.max(...scores.map((score) => score.score));
  assert.ok(badAnswerMax[name] <= 0.25, `${name} attack scored too high`);
}

const probe = createNetServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const address = probe.address(); assert.ok(address && typeof address === "object");
await new Promise((resolve) => probe.close(resolve));
const server = spawn(process.execPath, ["dist/cli.js", "serve", String(address.port)], { stdio: ["ignore", "pipe", "pipe"] });
const base = `http://127.0.0.1:${address.port}`; const routes = {};
async function get(path) {
  const response = await fetch(`${base}${path}`); routes[`GET ${path}`] = response.status;
  return { response, value: await response.json() };
}
try {
  for (let attempt = 0; attempt < 100; attempt++) { try { await get("/health"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 20)); } }
  const health = await get("/health"); assert.equal(health.response.status, 200);
  const listed = await get("/v1/tasks"); assert.equal(listed.value.tasks.length, 40);
  const shown = await get("/v1/tasks/public-01-ambiguous-request"); assert.equal(shown.value.task.id, "public-01-ambiguous-request");
  const score = await fetch(`${base}/v1/score`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: "public-01-ambiguous-request", submission: report.rows[0].submission }) });
  routes["POST /v1/score"] = score.status; assert.equal(score.status, 200);
  assert.equal((await get("/v1/provenance")).response.status, 200);
  assert.equal((await get("/v1/index-entry")).value.task_count, 40);
} finally { if (server.exitCode === null) { server.kill("SIGTERM"); await once(server, "exit"); } }

const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/cli.js", "mcp"], cwd: process.cwd(), stderr: "pipe" });
const client = new Client({ name: "benchmark-checkout-consent-e2e", version: "0.1.0" });
await client.connect(transport); let toolNames;
try {
  const available = await client.listTools(); toolNames = available.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, ["get_provenance", "get_task", "list_tasks", "run_benchmark", "score_answer"]);
  const calls = [
    ["list_tasks", {}], ["get_task", { taskId: "public-01-ambiguous-request" }],
    ["score_answer", { taskId: "public-01-ambiguous-request", submission: report.rows[0].submission }],
    ["get_provenance", {}], ["run_benchmark", { model: "offline" }],
  ];
  for (const [name, args] of calls) {
    const result = await client.callTool({ name, arguments: args });
    if (name === "run_benchmark") assert.equal(result.isError, true); else assert.notEqual(result.isError, true);
  }
} finally { await client.close(); }

const artifact = { cli_commands: ["run", ...cliCommands, "serve", "mcp"], good_policy_passes: goodRows.length, bad_answer_max: badAnswerMax, task_count: report.rows.length, scores: report.rows.map((row) => row.score), route_status_codes: routes, tool_names: toolNames };
await writeFile("artifacts/e2e-report.json", `${JSON.stringify(artifact, null, 2)}\n`);
assert.match(await readFile("data/PROVENANCE.md", "utf8"), /Seeded synthetic checkout scenarios/);
console.log(`e2e: ${artifact.task_count} tasks, ${Object.keys(routes).length} routes, ${toolNames.length} tools -> all surfaces passed, ok`);
