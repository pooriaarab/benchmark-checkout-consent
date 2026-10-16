import { createHandler } from "benchmark-core";
import { benchmark, benchmarkWithTasks } from "./benchmark.js";

/** Fetch-style handler; pass a tasks file to serve an alternate split, e.g. `serve --tasks hidden/tasks.hidden.jsonl`. */
export function createApiHandler(tasksFile?: string) {
  return createHandler(tasksFile ? benchmarkWithTasks(tasksFile) : benchmark);
}

export const handler = createApiHandler();
