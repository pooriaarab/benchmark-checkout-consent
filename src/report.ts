import type { Benchmark, JsonValue, RunReport, Task } from "benchmark-core";

export interface RuleBreakdown { passed: number; total: number }
export interface ScenarioBreakdown { tasks: number; mean: number }
export interface ReportBreakdown {
  rules: Record<string, RuleBreakdown>;
  scenarios: Record<string, ScenarioBreakdown>;
  asks: { used: number; extra: number };
  scored: number;
  unscored: number;
}
export type ReportWithBreakdown = RunReport & { breakdown?: ReportBreakdown };

export type GradeDetails = { scenario?: string; rules?: Record<string, boolean>; asks?: { used?: number; needed?: number; extra?: number } };

/** Builds the same breakdown shape as a run report for one already-graded submission. */
export function gradeBreakdown(details: GradeDetails | undefined, score: number): ReportBreakdown {
  const rules: Record<string, RuleBreakdown> = Object.create(null);
  for (const [name, pass] of Object.entries(details?.rules ?? {})) rules[name] = { passed: pass ? 1 : 0, total: 1 };
  const scenario = details?.scenario ?? "unknown";
  return {
    rules,
    scenarios: { [scenario]: { tasks: 1, mean: score } },
    asks: { used: details?.asks?.used ?? 0, extra: details?.asks?.extra ?? 0 },
    scored: 1,
    unscored: 0,
  };
}

/** Re-scores every row submission and attaches per-rule and per-scenario aggregates. */
export async function attachBreakdown(bench: Benchmark<Task>, report: RunReport): Promise<ReportWithBreakdown> {
  const rules: Record<string, RuleBreakdown> = Object.create(null);
  const scenarios: Record<string, { tasks: number; score: number }> = Object.create(null);
  const asks = { used: 0, extra: 0 };
  let scored = 0;
  for (const row of report.rows) {
    const task = await bench.getTask(row.taskId);
    if (!task || row.submission === undefined) continue;
    const grade = await bench.score(task, row.submission, { seed: report.seed });
    const details = grade.details as GradeDetails | undefined;
    const meta = task.metadata as Record<string, JsonValue> | undefined;
    const scenario = details?.scenario ?? (typeof meta?.scenario === "string" ? meta.scenario : "unknown");
    const bucket = scenarios[scenario] ?? { tasks: 0, score: 0 };
    bucket.tasks += 1; bucket.score += grade.score; scenarios[scenario] = bucket;
    for (const [name, pass] of Object.entries(details?.rules ?? {})) {
      const rule = rules[name] ?? { passed: 0, total: 0 };
      rule.total += 1; if (pass) rule.passed += 1; rules[name] = rule;
    }
    asks.used += details?.asks?.used ?? 0;
    asks.extra += details?.asks?.extra ?? 0;
    scored += 1;
  }
  const withBreakdown = report as ReportWithBreakdown;
  withBreakdown.breakdown = {
    rules,
    scenarios: Object.fromEntries(Object.entries(scenarios).map(([name, value]) => [name, { tasks: value.tasks, mean: value.score / value.tasks }])),
    asks,
    scored,
    unscored: report.rows.length - scored,
  };
  return withBreakdown;
}

export function breakdownMarkdown(breakdown: ReportBreakdown | undefined): string {
  if (!breakdown) return "";
  const lines = ["", "## Breakdown", "", "| Rule | Passed | Total |", "| --- | ---: | ---: |"];
  for (const [name, rule] of Object.entries(breakdown.rules)) lines.push(`| ${name} | ${rule.passed} | ${rule.total} |`);
  lines.push("", "| Scenario | Tasks | Mean |", "| --- | ---: | ---: |");
  for (const [name, bucket] of Object.entries(breakdown.scenarios)) lines.push(`| ${name} | ${bucket.tasks} | ${(bucket.mean * 100).toFixed(1)}% |`);
  lines.push("", `ask_user calls: ${breakdown.asks.used} (${breakdown.asks.extra} beyond needed), rows scored: ${breakdown.scored}, unscored: ${breakdown.unscored}`);
  return `${lines.join("\n")}\n`;
}
