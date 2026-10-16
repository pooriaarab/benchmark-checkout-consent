import { run as runBenchmark, type ModelAdapter, type RunOptions, type Task, type Benchmark, type Trace } from "benchmark-core";
import { benchmark, benchmarkWithTasks } from "./benchmark.js";
import { attachBreakdown, type ReportWithBreakdown } from "./report.js";
export { benchmark, benchmarkWithTasks };
export { CheckoutEnvironment, expectedFor, goodPolicy, normalizeAddress } from "./shop.js";
export { attachBreakdown, breakdownMarkdown, gradeBreakdown, type GradeDetails, type ReportBreakdown, type ReportWithBreakdown } from "./report.js";
export type TaskRunOptions = RunOptions & { tasks?: string };
export const run = async (adapter: ModelAdapter, options?: TaskRunOptions): Promise<ReportWithBreakdown> => {
  const { tasks, ...rest } = options ?? {};
  const bench: Benchmark<Task> = tasks ? benchmarkWithTasks(tasks) : benchmark;
  return attachBreakdown(bench, await runBenchmark(bench, adapter, rest));
};
export async function score(taskId: string, submission: Trace) {
  const task = await benchmark.getTask(taskId); if (!task) throw new Error(`Task not found: ${taskId}`);
  return benchmark.score(task, submission);
}
