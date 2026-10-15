#!/usr/bin/env node
import { createCli } from "benchmark-core";
import { benchmark } from "./benchmark.js";
const args = process.argv.slice(2);
const mock = args.includes("--provider=mock") || (args.includes("--provider") && args[args.indexOf("--provider") + 1] === "mock");
const model = args.some((arg) => arg === "--model" || arg.startsWith("--model="));
if (args[0] === "run" && mock && !model) args.push("--model", "offline");
process.exitCode = await createCli(benchmark, { bin: "benchmark-checkout-consent" }).main(args);
