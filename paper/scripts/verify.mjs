import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { benchmark } from '../../dist/index.js';
import { mean, wilson, bootstrap } from '../template/stats.mjs';
const load = async p => JSON.parse(await readFile(p)), hash = x => createHash('sha256').update(x).digest('hex');
const d = await load('paper/data/summary.generated.json'), runs = await load('paper/data/runs.generated.json'), repeats = await load('paper/data/repeat.generated.json'), prov = await load('paper/data/provenance.generated.json');
const simulated = JSON.parse(gunzipSync(await readFile('paper/data/simulated.generated.json.gz'))), tasks = await benchmark.listTasks();
const semantic = r => r.rows.map(({ taskId, submission, episode, score, reason }) => ({ taskId, submission, episode, score, reason }));
let rows = 0;
for (const { report } of [...runs, ...simulated, ...repeats.map(x => ({ report:x.repeat }))]) for (const [i,r] of report.rows.entries()) {
  assert.equal(r.taskId, tasks[i].id); const grade = await benchmark.score(tasks[i], r.submission);
  assert.equal(grade.score, r.score); assert.equal(grade.reason, r.reason); rows++;
}
for (const [i,r] of runs.entries()) {
  assert.equal(hash(JSON.stringify(semantic(r.report))), repeats[i].digest); assert.equal(repeats[i].digest, hash(JSON.stringify(semantic(repeats[i].repeat))));
  const b = d.baseline[i]; assert.equal(mean(r.report.rows.map(x => x.score)), b.mean.value);
  for (const [k,predicate] of [['full',x=>x.score===1],['unauthorized',x=>x.episode.finalState.unauthorizedPayment],['paid',x=>x.episode.finalState.paid]]) assert.deepEqual(wilson(r.report.rows.filter(predicate).length,tasks.length),b[k]);
}
for (const s of d.sweep) {
  const agents = simulated.filter(r => r.probability===s.probability && r.arm===s.arm);
  for (const k of ['score','full','unauthorized','paid']) assert.deepEqual(bootstrap([agents], gs => mean(gs[0].map(a => mean(a.report.rows.map(r => k==='score'?r.score:k==='full'?+(r.score===1):+r.episode.finalState[k==='unauthorized'?'unauthorizedPayment':k]))))),s[k]);
}
for (const c of d.contrasts) { const a=simulated.filter(r=>r.probability===c.probability&&r.arm==='intact'), b=simulated.filter(r=>r.probability===c.probability&&r.arm==='no-ask'); assert.deepEqual(bootstrap([a.map((r,i)=>mean(r.report.rows.map(x=>x.score))-mean(b[i].report.rows.map(x=>x.score)))],gs=>mean(gs[0])),c.difference); }
for (const [p,h] of Object.entries(prov.files)) assert.equal(hash(await readFile(p)),h);
assert.equal(hash(await readFile('paper/data/runs.generated.json')),prov.runHash); assert.equal(hash(await readFile('paper/data/simulated.generated.json.gz')),prov.simulatedHash);
const meta=await load('paper/meta.json'), config=await load('paper/config.json'), source=await readFile('paper/paper.tex','utf8');
assert.ok(meta.abstract.length<=1920&&/^[\x00-\x7f]*$/.test(meta.abstract)); assert.equal(meta.title,config.title); assert.equal(meta.license,'CC-BY-4.0'); assert.ok(!source.includes('—'));
const pdf=`paper/${meta.artifact_name}`, info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'}), pages=Number(info.match(/Pages:\s+(\d+)/)[1]), text=execFileSync('pdftotext',[pdf,'-'],{encoding:'utf8'});
assert.ok(pages>=8); for (const term of ['Checkout Consent','simulated','Caveats','References']) assert.ok(text.includes(term)); assert.ok(!text.includes('??')); assert.equal((source.match(/\\input\{figures\//g)||[]).length,4);
await writeFile('paper/data/verification.generated.json',JSON.stringify({replayedRows:rows,pages,figures:4,repeatAgreement:true,sourceHashes:true,pdfSha256:hash(await readFile(pdf)),status:'pass'},null,2)+'\n');
console.log(`PASS: ${rows} replayed rows; ${pages} pages; 4 figures; raw/summary agreement; repeat and source hashes`);
