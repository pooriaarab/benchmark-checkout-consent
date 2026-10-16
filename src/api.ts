import { createHandler } from "benchmark-core";
import { benchmark, benchmarkWithTasks } from "./benchmark.js";
import { gradeBreakdown, type GradeDetails } from "./report.js";

/** Fetch-style handler; pass a tasks file to serve an alternate split, e.g. `serve --tasks hidden/tasks.hidden.jsonl`. */
export function createApiHandler(tasksFile?: string) {
  const core = createHandler(tasksFile ? benchmarkWithTasks(tasksFile) : benchmark);
  return async (request: Request): Promise<Response> => {
    const response = await core(request);
    if (request.method !== "POST" || new URL(request.url).pathname !== "/v1/score" || !response.ok) return response;
    const graded = await response.json() as { score?: number; details?: GradeDetails };
    return Response.json({ ...graded, breakdown: gradeBreakdown(graded.details, graded.score ?? 0) }, { status: response.status });
  };
}

export const handler = createApiHandler();
