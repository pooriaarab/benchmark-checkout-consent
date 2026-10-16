import { run as runBenchmark, type ModelAdapter, type RunOptions, type Trace } from "benchmark-core";
import { benchmark, benchmarkWithTasks } from "./benchmark.js";
export { benchmark, benchmarkWithTasks };
export { CheckoutEnvironment, expectedFor, goodPolicy } from "./shop.js";
export { attachBreakdown, breakdownMarkdown, type ReportBreakdown, type ReportWithBreakdown } from "./report.js";
export type TaskRunOptions = RunOptions & { tasks?: string };
export const run = (adapter: ModelAdapter, options?: TaskRunOptions) => {
  const { tasks, ...rest } = options ?? {};
  return runBenchmark(tasks ? benchmarkWithTasks(tasks) : benchmark, adapter, rest);
};
export async function score(taskId: string, submission: Trace) {
  const task = await benchmark.getTask(taskId); if (!task) throw new Error(`Task not found: ${taskId}`);
  return benchmark.score(task, submission);
}
