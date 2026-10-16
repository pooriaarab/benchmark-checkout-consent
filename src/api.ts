import { createHandler } from "benchmark-core";
import { benchmark, benchmarkWithTasks } from "./benchmark.js";

async function tasksParam(request: Request): Promise<string | undefined> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tasks");
  if (fromQuery) return fromQuery;
  if (request.method !== "POST") return undefined;
  const peeked = await request.clone().json().catch(() => undefined);
  if (peeked && typeof peeked === "object" && !Array.isArray(peeked) && typeof Reflect.get(peeked, "tasks") === "string") return Reflect.get(peeked, "tasks") as string;
  return undefined;
}

/** Fetch-style handler; `?tasks=<path>` or a POST body `tasks` field selects an alternate split file. */
export function createApiHandler(defaultTasksFile?: string) {
  const defaultHandler = createHandler(defaultTasksFile ? benchmarkWithTasks(defaultTasksFile) : benchmark);
  const handlers = new Map<string, ReturnType<typeof createHandler>>();
  const handlerFor = (tasksFile: string | undefined) => {
    if (!tasksFile || tasksFile === defaultTasksFile) return defaultHandler;
    let handler = handlers.get(tasksFile);
    if (!handler) {
      handler = createHandler(benchmarkWithTasks(tasksFile));
      handlers.set(tasksFile, handler);
    }
    return handler;
  };
  return async (request: Request): Promise<Response> => handlerFor(await tasksParam(request))(request);
}

export const handler = createApiHandler();
