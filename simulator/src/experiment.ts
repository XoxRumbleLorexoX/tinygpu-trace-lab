import {
  executionModels,
  simulate,
  type ExecutionModel,
  type ExecutionResult,
  type NumberMode,
} from "./execution.js";
import { extractGraph, scheduleGraph } from "./graph.js";
import { parseProgram } from "./parser.js";

export const experimentLimits = {
  sourceCharacters: 16384,
  sourceLines: 512,
  instructions: 128,
  memoryCells: 64,
  threads: 16,
  events: 2500,
} as const;

export interface ProgramExperiment {
  format: "tinygpu-program-1";
  modelVersion: "teaching-1";
  name: string;
  source: string;
  initialMemory: Record<number, number>;
  expectedMemory: Record<number, number>;
  blockDim: number;
  blockCount: number;
  laneWidth: number;
  numberMode: NumberMode;
}

export interface ExperimentRun {
  model: ExecutionModel;
  result: ExecutionResult | null;
  error: string;
  checks: Array<{
    address: number;
    expected: number;
    actual: number;
    matches: boolean;
  }>;
  agreesWithSequential: boolean | null;
  graphVerified: boolean;
  graphError: string;
}

export interface ExperimentReport {
  document: ProgramExperiment;
  runs: ExperimentRun[];
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be a JSON object.`);
  return value as Record<string, unknown>;
}

function integer(value: unknown, name: string, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > max
  )
    throw new Error(`${name} must be an integer from 1 to ${max}.`);
  return value;
}

function memory(value: unknown, name: string): Record<number, number> {
  const entries = Object.entries(record(value, name));
  if (entries.length > experimentLimits.memoryCells)
    throw new Error(
      `${name} is limited to ${experimentLimits.memoryCells} cells.`,
    );
  const output: Record<number, number> = {};
  for (const [address, item] of entries) {
    if (
      !/^(0|[1-9]\d{0,4})$/.test(address) ||
      Number(address) > 65535 ||
      typeof item !== "number" ||
      !Number.isSafeInteger(item)
    )
      throw new Error(
        `${name} requires addresses 0-65535 and safe integer values.`,
      );
    output[Number(address)] = item;
  }
  return output;
}

export function validateExperiment(input: unknown): ProgramExperiment {
  const data = record(input, "Experiment");
  if (data.format !== "tinygpu-program-1" || data.modelVersion !== "teaching-1")
    throw new Error("Unsupported experiment format or model version.");
  if (
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 80
  )
    throw new Error("Experiment name must contain 1-80 characters.");
  if (
    typeof data.source !== "string" ||
    data.source.length > experimentLimits.sourceCharacters ||
    data.source.split("\n").length > experimentLimits.sourceLines
  )
    throw new Error("Source is limited to 16,384 characters and 512 lines.");
  if (data.numberMode !== "integer" && data.numberMode !== "uint8")
    throw new Error("Unknown number mode.");
  const blockDim = integer(data.blockDim, "Threads per block", 16);
  const blockCount = integer(data.blockCount, "Blocks", 8);
  if (blockDim * blockCount > experimentLimits.threads)
    throw new Error(
      `Experiments are limited to ${experimentLimits.threads} total threads.`,
    );
  const expectedMemory = memory(data.expectedMemory, "Expected memory");
  if (
    data.numberMode === "uint8" &&
    Object.values(expectedMemory).some((value) => value < 0 || value > 255)
  )
    throw new Error(
      "Expected memory for uint8 must contain values from 0 to 255.",
    );
  const document: ProgramExperiment = {
    format: "tinygpu-program-1",
    modelVersion: "teaching-1",
    name: data.name.trim(),
    source: data.source,
    initialMemory: memory(data.initialMemory, "Initial memory"),
    expectedMemory,
    blockDim,
    blockCount,
    laneWidth: integer(data.laneWidth, "Lane width", 16),
    numberMode: data.numberMode,
  };
  const program = parseProgram(document.name, document.source);
  if (program.instructions.length > experimentLimits.instructions)
    throw new Error(
      `Experiments are limited to ${experimentLimits.instructions} instructions.`,
    );
  return document;
}

function sameMemory(
  left: Record<number, number>,
  right: Record<number, number>,
): boolean {
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every(
    (address) => (left[Number(address)] ?? 0) === (right[Number(address)] ?? 0),
  );
}

export function runExperiment(input: unknown): ExperimentReport {
  const document = validateExperiment(input);
  const program = parseProgram(document.name, document.source);
  const runs = (Object.keys(executionModels) as ExecutionModel[]).map(
    (model): ExperimentRun => {
      const run: ExperimentRun = {
        model,
        result: null,
        error: "",
        checks: [],
        agreesWithSequential: null,
        graphVerified: false,
        graphError: "",
      };
      try {
        const result = simulate(program, {
          model,
          initialMemory: document.initialMemory,
          blockDim: document.blockDim,
          blockCount: document.blockCount,
          laneWidth: document.laneWidth,
          numberMode: document.numberMode,
          maxCycles: experimentLimits.events,
        });
        run.result = result;
        if (result.status === "complete") {
          run.checks = Object.entries(document.expectedMemory).map(
            ([address, expected]) => ({
              address: Number(address),
              expected,
              actual: result.finalMemory[Number(address)] ?? 0,
              matches: (result.finalMemory[Number(address)] ?? 0) === expected,
            }),
          );
          try {
            const graph = extractGraph(result);
            for (const policy of ["source-order", "critical-path"] as const)
              for (const units of [1, 2, 4, 8]) {
                const replay = scheduleGraph(graph, units, policy);
                if (!sameMemory(replay.at(-1)!.memory, result.finalMemory))
                  throw new Error(
                    "Graph memory differs from source execution.",
                  );
              }
            run.graphVerified = true;
          } catch (error) {
            run.graphError =
              error instanceof Error
                ? error.message
                : "Graph verification failed.";
          }
        }
      } catch (error) {
        run.error =
          error instanceof Error ? error.message : "Execution failed.";
      }
      return run;
    },
  );
  const reference = runs[0].result;
  for (const run of runs) {
    if (reference?.status !== "complete" || run.result?.status !== "complete")
      continue;
    run.agreesWithSequential =
      sameMemory(reference.finalMemory, run.result.finalMemory) &&
      reference.finalThreads.every((thread, i) => {
        const other = run.result!.finalThreads[i];
        return (
          thread.pc === other.pc &&
          Object.entries(thread.registers).every(
            ([key, value]) =>
              other.registers[key as keyof typeof other.registers] === value,
          ) &&
          Object.entries(thread.conditionFlags).every(
            ([key, value]) =>
              other.conditionFlags[key as keyof typeof other.conditionFlags] ===
              value,
          )
        );
      });
  }
  return { document, runs };
}
