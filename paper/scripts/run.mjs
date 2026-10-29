import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { benchmark, goodPolicy, run } from '../../dist/index.js';
import { mockAdapter } from 'benchmark-core';
import { mean, wilson, bootstrap } from '../template/stats.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
const tasks = await benchmark.listTasks(), config = JSON.parse(await readFile('paper/config.json'));
const options = { seed: 1, concurrency: 1, retries: 0, maxTurns: 20, maxToolCalls: 30, budgetUsd: 0 };
export const semantic = r => r.rows.map(({ taskId, submission, episode, score, reason }) => ({ taskId, submission, episode, score, reason }));
export function script(name, t) {
  const call = (name, args = {}) => ({ toolCalls: [{ name, args }] });
  if (['empty', 'constant', 'echo', 'refuse'].includes(name)) return [{ content: { empty: '', constant: 'OK', echo: t.prompt, refuse: 'I cannot make this purchase.' }[name] }];
  if (name === 'first-tool') return [call('search', { query: '' }), { content: '' }];
  if (name === 'unsafe-pay') return [call('pay', { token: 'always-yes' })];
  const turns = structuredClone(goodPolicy(t));
  if (name === 'extra-ask') turns.splice(t.expected.shouldPay ? turns.length - 1 : turns.length, 0, call('ask_user', { question: 'Are you sure?' }));
  if (name === 'stale-quote' && t.expected.shouldPay) turns.splice(turns.length - 1, 0, call('get_quote'));
  return [...turns, { content: '' }];
}
const adapter = policy => mockAdapter({ seed: 1, policies: { good: policy, bad: policy } });
async function execute(policy) {
  const r = await run(adapter(policy), options);
  assert.deepEqual(r.rows.map(x => x.taskId), tasks.map(t => t.id));
  assert.ok(r.rows.every(x => !x.error && !x.episode?.aborted), 'Execution failed');
  assert.equal(r.totals.costUsd ?? 0, 0); return r;
}
export const flags = r => ({ score: r.score, full: +(r.score === 1), unauthorized: +r.episode.finalState.unauthorizedPayment, paid: +r.episode.finalState.paid });
const strata = rows => [...new Set(tasks.map(t => t.metadata.scenario))].map(s => rows.filter((_, i) => tasks[i].metadata.scenario === s));
const stats = rows => ({ mean: bootstrap(strata(rows), gs => mean(gs.flat().map(r => r.score))), full: wilson(rows.filter(r => r.score === 1).length, rows.length), unauthorized: wilson(rows.filter(r => flags(r).unauthorized).length, rows.length), paid: wilson(rows.filter(r => flags(r).paid).length, rows.length) });
await mkdir('paper/data', { recursive: true });
const save = (n, x) => writeFile(`paper/data/${n}.generated.json${n === 'simulated' ? '.gz' : ''}`, n === 'simulated' ? gzipSync(JSON.stringify(x)) : JSON.stringify(x) + '\n');
const policies = ['oracle', 'empty', 'constant', 'echo', 'refuse', 'first-tool', 'unsafe-pay', 'extra-ask', 'stale-quote'];
const runs = [], repeats = [];
for (const policy of policies) {
  const report = await execute(t => script(policy, t)), repeat = await execute(t => script(policy, t));
  const digest = hash(JSON.stringify(semantic(report)));
  assert.equal(digest, hash(JSON.stringify(semantic(repeat))));
  runs.push({ policy, report }); repeats.push({ policy, digest, repeat });
}
await save('runs', runs); await save('repeat', repeats);
const probabilities = [0, .25, .5, .75, 1], simulated = [], compact = [];
for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
  let state = seed;
  const draws = tasks.map(() => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; });
  for (const probability of probabilities) for (const arm of ['intact', 'no-ask']) {
    const policy = t => {
      const turns = script(draws[tasks.findIndex(x => x.id === t.id)] < probability ? 'oracle' : 'unsafe-pay', t);
      return arm === 'intact' ? turns : turns.filter(x => !x.toolCalls?.some(c => c.name === 'ask_user'));
    };
    const report = await execute(policy), values = report.rows.map(flags);
    simulated.push({ kind: 'simulated', seed, probability, arm, report });
    compact.push({ seed, probability, arm, ...Object.fromEntries(['score', 'full', 'unauthorized', 'paid'].map(k => [k, mean(values.map(v => v[k]))])) });
  }
}
await save('simulated', simulated);
const sweep = probabilities.flatMap(probability => ['intact', 'no-ask'].map(arm => {
  const agents = compact.filter(r => r.probability === probability && r.arm === arm);
  return { kind: 'simulated', probability, arm, agents: agents.length, ...Object.fromEntries(['score', 'full', 'unauthorized', 'paid'].map(k => [k, bootstrap([agents], gs => mean(gs[0].map(r => r[k])))])) };
}));
const contrasts = probabilities.map(probability => {
  const a = compact.filter(r => r.probability === probability && r.arm === 'intact'), b = compact.filter(r => r.probability === probability && r.arm === 'no-ask');
  return { kind: 'simulated', probability, difference: bootstrap([a.map((r, i) => r.score - b[i].score)], gs => mean(gs[0])) };
});
const baseline = runs.map(({ policy, report }) => ({ policy, ...stats(report.rows), scoreDifference: bootstrap(strata(report.rows.map((r, i) => r.score - runs[0].report.rows[i].score)), gs => mean(gs.flat())) }));
const coverage = [...new Set(tasks.map(t => t.metadata.scenario))].map(scenario => ({ scenario, count: tasks.filter(t => t.metadata.scenario === scenario).length }));
const penaltyPerAsk = Number((await readFile('src/benchmark.ts','utf8')).match(/extraAsks \* ([\d.]+)/)[1]);
const summary = { penaltyPerAsk, tasks: tasks.length, payable: tasks.filter(t => t.expected.shouldPay).length, coverage, baseline, sweep, contrasts, options, controls: policies.length, controlEpisodes: tasks.length * policies.length * 2, simulatedEpisodes: simulated.length * tasks.length, simulatedAgents: 40, probabilities, costUsd: 0, ciLevel: 95, repeatIdentical: true, freeModels: 'Not run; hosted free access is not configured for this study. Provider availability is untested.' };
await save('summary', summary);
const sources = ['src/benchmark.ts', 'src/shop.ts', 'src/index.ts', 'data/tasks.jsonl', 'package-lock.json', 'paper/PREREG.md', 'paper/scripts/run.mjs', 'paper/template/stats.mjs'];
for (const p of sources.slice(0, 5)) assert.equal(hash(await readFile(p)), hash(execFileSync('git', ['show', `${config.source_commit}:${p}`])));
await save('provenance', { source_commit: config.source_commit, prereg_commit: execFileSync('git', ['log', '--reverse', '--format=%H', '--', 'paper/PREREG.md'], { encoding: 'utf8' }).trim().split('\n')[0], node: process.version, files: Object.fromEntries(await Promise.all(sources.map(async p => [p, hash(await readFile(p))]))), runHash: hash(await readFile('paper/data/runs.generated.json')), simulatedHash: hash(await readFile('paper/data/simulated.generated.json.gz')) });
console.log(`Completed ${summary.controlEpisodes} control episodes and ${summary.simulatedEpisodes} simulated episodes; repeat agreement; USD 0`);
