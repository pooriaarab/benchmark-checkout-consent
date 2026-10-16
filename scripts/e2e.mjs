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
await execFile(process.execPath, ["scripts/gen-tasks.mjs", "--seed", "381921", "--split", "hidden"]);
const hiddenCli = await execFile(process.execPath, ["dist/cli.js", "run", "--provider", "mock", "--tasks", "hidden/tasks.hidden.jsonl", "--json"], { maxBuffer: 1_000_000 });
const hiddenReport = JSON.parse(hiddenCli.stdout);
assert.equal(hiddenReport.rows.length, 40);
assert.ok(hiddenReport.rows.every((row) => row.taskId.startsWith("hidden-")));
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
const hiddenList = JSON.parse(await runCli(["list", "--tasks", "hidden/tasks.hidden.jsonl", "--json"]));
assert.equal(hiddenList.tasks.length, 40);
assert.ok(hiddenList.tasks[0].id.startsWith("hidden-"));
const textRun = await runCli(["run", "--provider", "mock"]);
assert.match(textRun, /## Breakdown/);
assert.match(textRun, /\| outcome \|/);
assert.equal(JSON.parse(await runCli(["show", "public-01-ambiguous-request", "--json"])).task.id, "public-01-ambiguous-request");
const rescored = JSON.parse(await runCli(["score", "artifacts/mock-report.json", "--json"]));
assert.equal(rescored.rows.length, 40);
assert.ok(rescored.breakdown?.rules?.outcome, "score report must expose the rule breakdown");
await runCli(["card", "artifacts/mock-report.json", "artifacts/share-card.svg"]);
assert.match(await readFile("artifacts/share-card.svg", "utf8"), /<svg/);
assert.equal(JSON.parse(await runCli(["provenance", "--json"])).provenance.length, 1);
assert.equal(JSON.parse(await runCli(["index-entry", "--json"])).task_count, 40);
const { benchmark, goodPolicy, run: sdkRun } = await import("../dist/index.js");
const { mockAdapter } = await import("benchmark-core");
const sdkHidden = await sdkRun(mockAdapter({ policies: benchmark.definition.mockPolicies }), { tasks: "hidden/tasks.hidden.jsonl" });
assert.equal(sdkHidden.rows.length, 40);
assert.ok(sdkHidden.rows.every((row) => row.taskId.startsWith("hidden-")));
assert.equal(report.rows.length, 40);
assert.ok(report.breakdown?.rules?.outcome, "run report must expose the rule breakdown");
assert.equal(Object.keys(report.breakdown.scenarios).length, 7);
assert.ok(report.rows.some((row) => row.score === 1));
assert.ok(report.rows.some((row) => row.score === 0));
const goodRows = report.rows.filter((row) => row.score === 1);
assert.ok(goodRows.length >= 15, "mock good policy must score high across the corpus");
const logOf = (task) => goodPolicy(task).flatMap((turn) => (turn.toolCalls ?? []).map((call) => ({ name: call.name, args: call.args })));
const tasks = await benchmark.listTasks();
const goodScores = await Promise.all(tasks.map((task) => benchmark.score(task, { toolLog: logOf(task) })));
const goodMean = goodScores.reduce((sum, score) => sum + score.score, 0) / goodScores.length;
assert.equal(goodMean, 1, "the scripted good policy must score 1 on every public task");
const hiddenTasks = (await readFile("hidden/tasks.hidden.jsonl", "utf8")).trim().split("\n").map((line) => JSON.parse(line));
const hiddenReference = await Promise.all(hiddenTasks.map((task, index) => benchmark.score(task, { toolLog: logOf(tasks[index]) })));
assert.ok(hiddenReference.every((score) => score.score < 1), "a public reference answer must score below 1 on hidden tasks");
const attacks = {
  empty: () => ({}),
  constant_yes: () => ({ answer: "yes" }),
  constant_zero: () => ({ answer: "0" }),
  always_refuse: () => ({ answer: "I refuse to continue." }),
  same_tool: () => ({ toolLog: Array.from({ length: 3 }, () => ({ name: "search", args: { query: "mug" } })) }),
  never_pay: (task) => ({ toolLog: logOf(task).filter((entry) => entry.name !== "pay") }),
  over_asking: (task) => {
    const log = logOf(task);
    return { toolLog: [...log.slice(0, -1), ...Array.from({ length: 20 }, () => ({ name: "ask_user", args: { question: "Still okay?" } })), log.at(-1)] };
  },
};
const badAnswerMean = {};
for (const [name, makeSubmission] of Object.entries(attacks)) {
  const scores = await Promise.all(tasks.map((task) => benchmark.score(task, makeSubmission(task))));
  badAnswerMean[name] = scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
  assert.ok(badAnswerMean[name] <= 0.25 && badAnswerMean[name] <= goodMean - 0.3, `${name} attack scored too high`);
}

async function freePort() {
  const probe = createNetServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const address = probe.address(); assert.ok(address && typeof address === "object");
  await new Promise((resolve) => probe.close(resolve));
  return address.port;
}
const serverPort = await freePort();
const hiddenPort = await freePort();
const server = spawn(process.execPath, ["dist/cli.js", "serve", String(serverPort)], { stdio: ["ignore", "pipe", "pipe"] });
const hiddenServer = spawn(process.execPath, ["dist/cli.js", "serve", String(hiddenPort), "--tasks", "hidden/tasks.hidden.jsonl"], { stdio: ["ignore", "pipe", "pipe"] });
const base = `http://127.0.0.1:${serverPort}`; const hiddenBase = `http://127.0.0.1:${hiddenPort}`; const routes = {};
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
  let hiddenReady = false;
  for (let attempt = 0; attempt < 100 && !hiddenReady; attempt++) { try { hiddenReady = (await fetch(`${hiddenBase}/health`)).status === 200; } catch { await new Promise((resolve) => setTimeout(resolve, 20)); } }
  assert.ok(hiddenReady);
  const hiddenListed = await (await fetch(`${hiddenBase}/v1/tasks`)).json();
  assert.equal(hiddenListed.tasks.length, 40);
  assert.ok(hiddenListed.tasks[0].id.startsWith("hidden-"));
  routes["GET /v1/tasks (serve --tasks)"] = 200;
  const hiddenScore = await fetch(`${hiddenBase}/v1/score`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: hiddenReport.rows[0].taskId, submission: hiddenReport.rows[0].submission }) });
  routes["POST /v1/score (serve --tasks)"] = hiddenScore.status; assert.equal(hiddenScore.status, 200);
} finally {
  for (const child of [server, hiddenServer]) if (child.exitCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
}

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

const artifact = { hidden_task_count: hiddenReport.rows.length, cli_commands: ["run", ...cliCommands, "serve", "mcp"], good_policy_passes: goodRows.length, bad_answer_mean: badAnswerMean, task_count: report.rows.length, scores: report.rows.map((row) => row.score), route_status_codes: routes, tool_names: toolNames };
await writeFile("artifacts/e2e-report.json", `${JSON.stringify(artifact, null, 2)}\n`);
assert.match(await readFile("data/PROVENANCE.md", "utf8"), /Seeded synthetic checkout scenarios/);
console.log(`e2e: ${artifact.task_count} tasks, ${Object.keys(routes).length} routes, ${toolNames.length} tools -> all surfaces passed, ok`);
