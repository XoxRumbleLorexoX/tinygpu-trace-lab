import {
  normalizeNumber,
  type ExecutionResult,
  type Operand,
} from "./execution.js";
import type { Opcode } from "./types.js";

export interface GraphInput extends Operand {
  producer?: string;
}
export interface ComputationNode {
  id: string;
  threadId: number;
  pc: number;
  opcode: Opcode;
  instruction: string;
  eventIndex: number;
  inputs: GraphInput[];
  dependencies: string[];
  expected?: number;
  outputAddress?: number;
}
export interface ComputationGraph {
  nodes: ComputationNode[];
  initialMemory: Record<number, number>;
  numberMode: ExecutionResult["options"]["numberMode"];
  scope: "observed-path";
}
export interface GraphStep {
  tick: number;
  ready: string[];
  active: string[];
  completed: string[];
  values: Record<string, number>;
  memory: Record<number, number>;
}

export function extractGraph(result: ExecutionResult): ComputationGraph {
  if (result.status !== "complete")
    throw new Error("Graph extraction requires a completed run.");
  const nodes: ComputationNode[] = [];
  const registers = new Map<string, string>();
  const memory = new Map<number, string>();
  const readers = new Map<number, string[]>();
  const branches = new Map<number, string>();
  const flags = new Map<number, string>();
  const accesses = new Map(
    result.trace
      .filter((event) => event.memoryAccess)
      .map((event) => [event.operationId, event]),
  );
  for (const event of result.trace.filter(
    (item) => item.stage === "Writeback",
  )) {
    const access = accesses.get(event.operationId);
    const address = access?.memoryDiff[0]?.address;
    const inputs = event.operands.map(
      (operand): GraphInput => ({
        ...operand,
        producer:
          operand.kind === "memory"
            ? memory.get(address!)
            : registers.get(`${event.threadId}:${operand.name}`),
      }),
    );
    const dependencies = inputs.flatMap((input) =>
      input.producer ? [input.producer] : [],
    );
    const branch = branches.get(event.threadId);
    if (branch) dependencies.push(branch);
    if (event.opcode === "BRnzp" && flags.has(event.threadId))
      dependencies.push(flags.get(event.threadId)!);
    // Preserve memory anti-dependencies and output dependencies as well as value flow.
    if (access?.memoryAccess === "write" && address !== undefined) {
      if (memory.has(address)) dependencies.push(memory.get(address)!);
      dependencies.push(...(readers.get(address) ?? []));
      readers.set(address, []);
      memory.set(address, event.operationId);
    } else if (address !== undefined)
      readers.set(address, [
        ...(readers.get(address) ?? []),
        event.operationId,
      ]);
    const node: ComputationNode = {
      id: event.operationId,
      threadId: event.threadId,
      pc: event.pc,
      opcode: event.opcode,
      instruction: event.instruction,
      eventIndex: event.cycle,
      inputs,
      dependencies: [...new Set(dependencies)],
      expected: event.resultValue,
      outputAddress: access?.memoryAccess === "write" ? address : undefined,
    };
    nodes.push(node);
    for (const diff of event.registerDiff)
      registers.set(`${event.threadId}:${diff.register}`, node.id);
    if (event.opcode === "CMP") flags.set(event.threadId, node.id);
    if (event.opcode === "BRnzp") branches.set(event.threadId, node.id);
  }
  return {
    nodes,
    initialMemory: { ...result.initialMemory },
    numberMode: result.options.numberMode,
    scope: "observed-path",
  };
}

export function scheduleGraph(
  graph: ComputationGraph,
  units = 4,
  policy: "source-order" | "critical-path" = "source-order",
): GraphStep[] {
  if (!Number.isInteger(units) || units < 1 || units > 32)
    throw new Error("Graph units must be from 1 to 32.");
  if (!["source-order", "critical-path"].includes(policy))
    throw new Error("Unknown graph scheduling policy.");
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (
    ids.size !== graph.nodes.length ||
    graph.nodes.some((node) => node.dependencies.some((id) => !ids.has(id)))
  )
    throw new Error("Graph has duplicate nodes or missing dependencies.");
  const priority = new Map<string, number>();
  const visiting = new Set<string>();
  const consumers = new Map(
    graph.nodes.map((node) => [
      node.id,
      graph.nodes
        .filter((item) => item.dependencies.includes(node.id))
        .map((item) => item.id),
    ]),
  );
  const depth = (id: string): number => {
    if (visiting.has(id)) throw new Error("Graph contains a dependency cycle.");
    if (priority.has(id)) return priority.get(id)!;
    visiting.add(id);
    const value = 1 + Math.max(0, ...(consumers.get(id) ?? []).map(depth));
    visiting.delete(id);
    priority.set(id, value);
    return value;
  };
  for (const id of ids) depth(id);
  const completed = new Set<string>();
  const values: Record<string, number> = {};
  const memory = { ...graph.initialMemory };
  const steps: GraphStep[] = [];
  while (completed.size < graph.nodes.length) {
    const ready = graph.nodes.filter(
      (node) =>
        !completed.has(node.id) &&
        node.dependencies.every((id) => completed.has(id)),
    );
    if (!ready.length) throw new Error("Graph cannot make progress.");
    if (policy === "critical-path")
      ready.sort((a, b) => priority.get(b.id)! - priority.get(a.id)!);
    const selected = ready.slice(0, units);
    for (const node of selected) {
      const operands = node.inputs.map((input) =>
        input.producer ? values[input.producer] : input.value,
      );
      let value = 0;
      switch (node.opcode) {
        case "CONST":
          value = operands[0];
          break;
        case "ADD":
          value = operands[0] + operands[1];
          break;
        case "SUB":
          value = operands[0] - operands[1];
          break;
        case "MUL":
          value = operands[0] * operands[1];
          break;
        case "DIV":
          if (operands[1] === 0) throw new Error("Division by zero in graph.");
          value = Math.trunc(operands[0] / operands[1]);
          break;
        case "LDR":
          value = memory[operands[0]] ?? 0;
          break;
        case "STR":
          value = operands[0];
          memory[operands[1]] = normalizeNumber(value, graph.numberMode);
          break;
        case "CMP":
          value = Math.sign(operands[0] - operands[1]);
          break;
        // Control nodes preserve the captured path. Changing inputs requires a fresh extraction.
        case "BRnzp":
        case "RET":
          break;
      }
      value = normalizeNumber(value, graph.numberMode);
      if (node.expected !== undefined && node.expected !== value)
        throw new Error(
          `Graph execution disagrees with the source at ${node.id}.`,
        );
      values[node.id] = value;
    }
    for (const node of selected) completed.add(node.id);
    steps.push({
      tick: steps.length,
      ready: ready.map((node) => node.id),
      active: selected.map((node) => node.id),
      completed: [...completed],
      values: { ...values },
      memory: { ...memory },
    });
  }
  return steps;
}

export function ancestorsOf(graph: ComputationGraph, id: string): Set<string> {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const found = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const current = pending.pop()!;
    if (found.has(current)) continue;
    found.add(current);
    pending.push(...(nodes.get(current)?.dependencies ?? []));
  }
  return found;
}

export function consumersOf(
  graph: ComputationGraph,
  ids: string[],
): Set<string> {
  const found = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of graph.nodes) {
      if (
        !found.has(node.id) &&
        node.dependencies.some((id) => found.has(id))
      ) {
        found.add(node.id);
        changed = true;
      }
    }
  }
  return found;
}

export interface SystolicCell {
  row: number;
  column: number;
  k?: number;
  a?: number;
  b?: number;
  before: number;
  after: number;
}
export interface SystolicStep {
  tick: number;
  cells: SystolicCell[];
  outputs: Array<number | null>;
}
export function simulateSystolic(a: number[], b: number[]): SystolicStep[] {
  if (
    a.length !== 4 ||
    b.length !== 4 ||
    [...a, ...b].some((value) => !Number.isSafeInteger(value))
  )
    throw new Error("The systolic array requires two 2 x 2 integer matrices.");
  const accumulators = [0, 0, 0, 0];
  const outputs: Array<number | null> = [null, null, null, null];
  const steps: SystolicStep[] = [];
  // Skewed injection: A moves right and B moves down one processing element per tick.
  for (let tick = 0; tick < 4; tick++) {
    const cells: SystolicCell[] = [];
    for (let row = 0; row < 2; row++)
      for (let column = 0; column < 2; column++) {
        const i = row * 2 + column,
          k = tick - row - column,
          before = accumulators[i];
        if (k >= 0 && k < 2) {
          const left = a[row * 2 + k],
            right = b[k * 2 + column];
          accumulators[i] = normalizeNumber(before + left * right, "integer");
          if (k === 1) outputs[i] = accumulators[i];
          cells.push({
            row,
            column,
            k,
            a: left,
            b: right,
            before,
            after: accumulators[i],
          });
        } else cells.push({ row, column, before, after: before });
      }
    steps.push({ tick, cells, outputs: [...outputs] });
  }
  return steps;
}
