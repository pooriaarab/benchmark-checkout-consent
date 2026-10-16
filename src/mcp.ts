import { createMcpServer as create, type Benchmark, type Task } from "benchmark-core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { benchmark, benchmarkWithTasks } from "./benchmark.js";
import { attachBreakdown } from "./report.js";

type ToolCallHandler = (request: unknown, extra: unknown) => Promise<unknown>;
type ToolCallResult = { isError?: boolean; content?: { type?: string; text?: string }[] };

/** Wraps run_benchmark so its report carries the same breakdown as the CLI and SDK. */
function withBreakdown(server: Server, bench: Benchmark<Task>): Server {
  const handlers = (server as unknown as { _requestHandlers?: Map<string, ToolCallHandler> })._requestHandlers;
  const original = handlers?.get("tools/call");
  if (!original) return server;
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const result = await original(request, extra) as ToolCallResult;
    if (request.params?.name !== "run_benchmark" || result?.isError) return result;
    try {
      const report = await attachBreakdown(bench, JSON.parse(result?.content?.[0]?.text ?? ""));
      return { ...result, content: [{ type: "text", text: JSON.stringify(report) }] };
    } catch {
      return result;
    }
  });
  return server;
}

export const createMcpServer = (tasksFile?: string) => {
  const bench: Benchmark<Task> = tasksFile ? benchmarkWithTasks(tasksFile) : benchmark;
  return withBreakdown(create(bench), bench);
};
export const startMcp = async (tasksFile?: string) => {
  await createMcpServer(tasksFile).connect(new StdioServerTransport());
};
