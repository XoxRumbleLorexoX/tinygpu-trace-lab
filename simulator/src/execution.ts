import type {
  AnyRegisterName,
  ConditionFlag,
  Instruction,
  MemoryDiff,
  PipelineStage,
  Program,
  RegisterDiff,
  RegisterName,
  SimulationResult,
  SimulatorOptions,
  ThreadState,
  TraceEvent,
} from "./types.js";

export type ExecutionModel = "scalar" | "simd" | "simt";
export type NumberMode = "integer" | "uint8";
export interface ExecutionOptions extends SimulatorOptions {
  model?: ExecutionModel;
  laneWidth?: number;
  numberMode?: NumberMode;
}
export interface Operand {
  name: string;
  value: number;
  kind: "register" | "immediate" | "address" | "memory";
}
export interface ExecutionEvent extends TraceEvent {
  eventId: string;
  operationId: string;
  tick: number;
  issue: number;
  activeThreads: number[];
  maskedThreads: number[];
  operands: Operand[];
  nextPc: number;
  complete: boolean;
  memoryAccess?: "read" | "write";
  resultValue?: number;
}
export interface ExecutionResult extends SimulationResult {
  schemaVersion: 2;
  modelVersion: "teaching-1";
  trace: ExecutionEvent[];
  initialThreads: ThreadState[];
  initialMemory: Record<number, number>;
  options: Required<ExecutionOptions>;
  status: "complete" | "limit";
  statistics: {
    issues: number;
    logicalTicks: number;
    laneOperations: number;
    activeLaneSlots: number;
    availableLaneSlots: number;
    laneUtilization: number;
    reads: number;
    writes: number;
    divergentIssues: number;
  };
}

export const executionModels: Record<
  ExecutionModel,
  { name: string; description: string }
> = {
  scalar: {
    name: "Sequential",
    description:
      "One lane executes one element to completion before the next element starts.",
  },
  simd: {
    name: "SIMD",
    description:
      "One shared program counter broadcasts each straight-line instruction across a vector of lanes. Per-lane branches are unsupported.",
  },
  simt: {
    name: "SIMT",
    description:
      "Thread groups take turns issuing. Lanes at the lowest ready program counter run together; other lanes are masked. This is a teaching scheduler, not a vendor GPU.",
  },
};

const registers = Array.from({ length: 13 }, (_, i) => `R${i}` as RegisterName);
const stages: PipelineStage[] = [
  "Fetch",
  "Decode",
  "Execute",
  "Memory",
  "Writeback",
];
const flagRecord = (
  n = false,
  z = true,
  p = false,
): Record<ConditionFlag, boolean> => ({ n, z, p });

function bounded(
  value: number,
  name: string,
  min: number,
  max: number,
): number {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  return value;
}

export function normalizeNumber(value: number, mode: NumberMode): number {
  if (!Number.isSafeInteger(value))
    throw new Error("Arithmetic requires finite safe integers.");
  return mode === "uint8" ? ((value % 256) + 256) % 256 : value;
}

export function simulate(
  program: Program,
  input: ExecutionOptions = {},
): ExecutionResult {
  const options: Required<ExecutionOptions> = {
    blockDim: bounded(input.blockDim ?? 4, "Block size", 1, 32),
    blockCount: bounded(input.blockCount ?? 1, "Block count", 1, 8),
    coreCount: bounded(input.coreCount ?? 2, "Core count", 1, 8),
    maxCycles: bounded(input.maxCycles ?? 20000, "Event budget", 5, 100000),
    laneWidth: bounded(input.laneWidth ?? 4, "Lane width", 1, 32),
    model: input.model ?? "simt",
    numberMode: input.numberMode ?? "integer",
    initialMemory: { ...input.initialMemory },
  };
  if (!Object.hasOwn(executionModels, options.model))
    throw new Error("Unknown execution model.");
  if (!["integer", "uint8"].includes(options.numberMode))
    throw new Error("Unknown number mode.");
  if (!program.instructions.length)
    throw new Error("Program must contain at least one instruction.");
  if (
    options.model === "simd" &&
    program.instructions.some((instruction) => instruction.opcode === "BRnzp")
  ) {
    throw new Error(
      "The SIMD model supports straight-line vector programs only. Choose Sequential or SIMT for per-thread branches.",
    );
  }
  const memory: Record<number, number> = {};
  if (!input.initialMemory) {
    for (let i = 0; i < options.blockDim * options.blockCount; i++) {
      memory[i] = i * 2;
      memory[64 + i] = i + 10;
    }
  } else {
    for (const [address, value] of Object.entries(input.initialMemory)) {
      bounded(Number(address), "Memory address", 0, 65535);
      memory[Number(address)] = normalizeNumber(value, options.numberMode);
    }
  }
  options.initialMemory = { ...memory };
  const threads: ThreadState[] = [];
  const groupsPerBlock = Math.ceil(options.blockDim / options.laneWidth);
  for (let block = 0; block < options.blockCount; block++) {
    for (let lane = 0; lane < options.blockDim; lane++) {
      const warpId =
        block * groupsPerBlock + Math.floor(lane / options.laneWidth);
      threads.push({
        threadId: block * options.blockDim + lane,
        blockId: block,
        coreId: warpId % options.coreCount,
        warpId,
        pc: 0,
        registers: Object.fromEntries(
          registers.map((name) => [name, 0]),
        ) as Record<RegisterName, number>,
        specialRegisters: {
          "%blockIdx": block,
          "%blockDim": options.blockDim,
          "%threadIdx": lane,
        },
        conditionFlags: flagRecord(),
        complete: false,
      });
    }
  }
  const initialThreads = structuredClone(threads);
  const initialMemory = { ...memory };
  const trace: ExecutionEvent[] = [];
  const operationCounts = threads.map(() => 0);
  const statistics = {
    issues: 0,
    logicalTicks: 0,
    laneOperations: 0,
    activeLaneSlots: 0,
    availableLaneSlots: 0,
    laneUtilization: 0,
    reads: 0,
    writes: 0,
    divergentIssues: 0,
  };
  let cursor = 0;
  let branchCount = 0;
  const groups = Array.from(
    { length: groupsPerBlock * options.blockCount },
    (_, id) => threads.filter((t) => t.warpId === id),
  );

  while (threads.some((thread) => !thread.complete)) {
    let group: ThreadState[];
    let active: ThreadState[];
    if (options.model === "scalar") {
      group = [threads.find((thread) => !thread.complete)!];
      active = group;
    } else if (options.model === "simd") {
      group = groups.find((items) => items.some((thread) => !thread.complete))!;
      active = group.filter((thread) => !thread.complete);
    } else {
      // Rotate groups, then issue the lowest ready PC within the selected group.
      while (groups[cursor].every((thread) => thread.complete))
        cursor = (cursor + 1) % groups.length;
      group = groups[cursor];
      cursor = (cursor + 1) % groups.length;
      const pc = Math.min(
        ...group
          .filter((thread) => !thread.complete)
          .map((thread) => thread.pc),
      );
      active = group.filter((thread) => !thread.complete && thread.pc === pc);
    }
    if (trace.length + active.length * stages.length > options.maxCycles) break;
    const masked = group
      .filter((thread) => !active.includes(thread))
      .map((thread) => thread.threadId);
    const divergent = group.some(
      (thread) => !thread.complete && !active.includes(thread),
    );
    if (divergent) statistics.divergentIssues++;
    const activeThreads = active.map((thread) => thread.threadId);
    const plans = active.map((thread) => {
      const instruction = program.instructions[thread.pc];
      if (!instruction)
        throw new Error(
          `Thread ${thread.threadId} reached PC ${thread.pc} without RET.`,
        );
      return {
        thread,
        instruction,
        pc: thread.pc,
        operationId: `t${thread.threadId}-op${operationCounts[thread.threadId]++}`,
        plan: evaluate(
          thread,
          instruction,
          program,
          memory,
          options.numberMode,
        ),
      };
    });
    const writeAddresses = plans.flatMap(({ plan }) =>
      plan.access === "write"
        ? plan.memoryDiff.map((diff) => diff.address)
        : [],
    );
    if (new Set(writeAddresses).size !== writeAddresses.length)
      throw new Error(
        "Concurrent lanes write the same address. This teaching model rejects data races.",
      );
    for (const stage of stages) {
      for (const { thread, instruction, pc, operationId, plan } of plans) {
        const registerDiff = stage === "Writeback" ? plan.registerDiff : [];
        const memoryDiff = stage === "Memory" ? plan.memoryDiff : [];
        if (stage === "Memory" && plan.access === "write")
          for (const diff of memoryDiff) memory[diff.address] = diff.after;
        if (stage === "Writeback") {
          for (const diff of registerDiff)
            thread.registers[diff.register as RegisterName] = diff.after;
          thread.pc = plan.nextPc;
          thread.complete = instruction.opcode === "RET";
          thread.conditionFlags = { ...plan.flags };
        }
        const cycle = trace.length;
        trace.push({
          cycle,
          timestamp: statistics.issues * 5 + stages.indexOf(stage),
          tick: statistics.issues * 5 + stages.indexOf(stage),
          issue: statistics.issues,
          eventId: `event-${cycle}`,
          operationId,
          threadId: thread.threadId,
          blockId: thread.blockId,
          coreId: thread.coreId,
          warpId: thread.warpId,
          pc,
          instruction: instruction.source,
          opcode: instruction.opcode,
          stage,
          activeComponent: component(instruction, stage),
          tokenType:
            stage === "Memory" && plan.access
              ? "data"
              : stage === "Writeback" && registerDiff.length
                ? "combined"
                : "instruction",
          tokenPosition: `${stage}:${component(instruction, stage)}`,
          registerDiff,
          memoryDiff,
          conditionFlags: { ...thread.conditionFlags },
          nextPc: thread.pc,
          complete: thread.complete,
          activeThreads,
          maskedThreads: masked,
          operands: plan.operands,
          memoryAccess: stage === "Memory" ? plan.access : undefined,
          resultValue: ["Execute", "Memory", "Writeback"].includes(stage)
            ? plan.resultValue
            : undefined,
          explanatoryText: explain(thread.threadId, instruction, stage, plan),
          stallReason:
            divergent && stage === "Decode" ? "Divergence" : undefined,
        });
      }
    }
    statistics.issues++;
    statistics.laneOperations += active.length;
    statistics.activeLaneSlots += active.length;
    statistics.availableLaneSlots +=
      options.model === "scalar" ? 1 : options.laneWidth;
    for (const { instruction, plan } of plans) {
      if (plan.access === "read") statistics.reads++;
      if (plan.access === "write") statistics.writes++;
      if (instruction.opcode === "BRnzp") branchCount++;
    }
  }
  statistics.logicalTicks = statistics.issues * 5;
  statistics.laneUtilization =
    statistics.activeLaneSlots / Math.max(1, statistics.availableLaneSlots);
  return {
    schemaVersion: 2,
    modelVersion: "teaching-1",
    program,
    trace,
    initialThreads,
    initialMemory,
    finalThreads: structuredClone(threads),
    finalMemory: { ...memory },
    options,
    status: threads.every((thread) => thread.complete) ? "complete" : "limit",
    statistics,
    // Compatibility counters only. Cache, occupancy and elapsed-time models are not implemented.
    metrics: {
      ipc: statistics.laneOperations / Math.max(1, statistics.logicalTicks),
      instructionCount: statistics.laneOperations,
      memoryAccessCount: statistics.reads + statistics.writes,
      branchCount,
      cacheMisses: 0,
      stallCycles: 0,
      occupancy: 0,
      executionTime: 0,
    },
  };
}

interface Plan {
  operands: Operand[];
  registerDiff: RegisterDiff[];
  memoryDiff: MemoryDiff[];
  nextPc: number;
  flags: Record<ConditionFlag, boolean>;
  access?: "read" | "write";
  resultValue?: number;
}

function evaluate(
  thread: ThreadState,
  instruction: Instruction,
  program: Program,
  memory: Record<number, number>,
  mode: NumberMode,
): Plan {
  const plan: Plan = {
    operands: [],
    registerDiff: [],
    memoryDiff: [],
    nextPc: thread.pc + 1,
    flags: { ...thread.conditionFlags },
  };
  const read = (name: string, address = false): number => {
    const token = name.replace(/^\[|\]$/g, "");
    const raw =
      token in thread.registers
        ? thread.registers[token as RegisterName]
        : token in thread.specialRegisters
          ? thread.specialRegisters[
              token as keyof ThreadState["specialRegisters"]
            ]
          : Number(token);
    if (!Number.isSafeInteger(raw))
      throw new Error(`Invalid operand '${name}'.`);
    const value = address ? raw : normalizeNumber(raw, mode);
    plan.operands.push({
      name: token,
      value,
      kind: address
        ? "address"
        : token.startsWith("R") || token.startsWith("%")
          ? "register"
          : "immediate",
    });
    return address ? bounded(value, "Memory address", 0, 65535) : value;
  };
  const write = (name: string, value: number) => {
    if (!registers.includes(name as RegisterName))
      throw new Error(`Invalid destination '${name}'.`);
    const after = normalizeNumber(value, mode);
    plan.registerDiff.push({
      register: name as AnyRegisterName,
      before: thread.registers[name as RegisterName],
      after,
    });
    plan.resultValue = after;
  };
  const [a, b, c] = instruction.args;
  switch (instruction.opcode) {
    case "CONST":
      write(a, read(b));
      break;
    case "ADD":
      write(a, read(b) + read(c));
      break;
    case "SUB":
      write(a, read(b) - read(c));
      break;
    case "MUL":
      write(a, read(b) * read(c));
      break;
    case "DIV": {
      const left = read(b),
        right = read(c);
      if (right === 0)
        throw new Error(
          `Division by zero in thread ${thread.threadId} at PC ${thread.pc}.`,
        );
      write(a, Math.trunc(left / right));
      break;
    }
    case "CMP": {
      const left = read(a),
        right = read(b);
      plan.flags = flagRecord(left < right, left === right, left > right);
      break;
    }
    case "BRnzp": {
      if ([...a].some((flag) => thread.conditionFlags[flag as ConditionFlag]))
        plan.nextPc = program.labels[b];
      if (plan.nextPc === undefined)
        throw new Error(`Unknown branch label '${b}'.`);
      break;
    }
    case "LDR": {
      const address = read(b, true),
        value = memory[address] ?? 0;
      plan.access = "read";
      plan.operands.push({ name: `memory[${address}]`, value, kind: "memory" });
      plan.memoryDiff.push({ address, before: value, after: value });
      write(a, value);
      break;
    }
    case "STR": {
      const value = normalizeNumber(read(a), mode),
        address = read(b, true);
      plan.access = "write";
      plan.resultValue = value;
      plan.memoryDiff.push({
        address,
        before: memory[address] ?? 0,
        after: value,
      });
      break;
    }
    case "RET":
      plan.nextPc = thread.pc;
      break;
  }
  return plan;
}

function component(
  instruction: Instruction,
  stage: PipelineStage,
): TraceEvent["activeComponent"] {
  if (stage === "Fetch") return "Program Counter";
  if (stage === "Decode") return "Dispatcher";
  if (stage === "Writeback")
    return instruction.opcode === "CMP" ? "Condition Flags" : "Register File";
  if (stage === "Memory")
    return ["LDR", "STR"].includes(instruction.opcode) ? "Data Memory" : "Core";
  if (["LDR", "STR"].includes(instruction.opcode)) return "LSU";
  if (["CMP", "BRnzp"].includes(instruction.opcode)) return "Condition Flags";
  return "ALU";
}

function explain(
  id: number,
  instruction: Instruction,
  stage: PipelineStage,
  plan: Plan,
): string {
  const values = plan.operands
    .filter((operand) => operand.kind !== "memory")
    .map((operand) => `${operand.name} = ${operand.value}`)
    .join(", ");
  if (stage === "Fetch")
    return `Thread ${id} fetches ${instruction.source}. No register or memory value changes yet.`;
  if (stage === "Decode")
    return values
      ? `Thread ${id} selects operands: ${values}.`
      : `Thread ${id} decodes ${instruction.opcode}.`;
  if (stage === "Execute") {
    if (instruction.opcode === "CMP")
      return `Compare ${values}. The result selects ${plan.flags.n ? "less than" : plan.flags.z ? "equal" : "greater than"} at writeback.`;
    if (instruction.opcode === "BRnzp")
      return `Thread ${id} checks flags; its next instruction is PC ${plan.nextPc}.`;
    if (plan.access)
      return `Thread ${id} calculates memory address ${plan.memoryDiff[0].address}.`;
    if (plan.resultValue !== undefined)
      return `${instruction.opcode} uses ${values} to produce ${plan.resultValue}. The destination is not committed until writeback.`;
  }
  if (stage === "Memory")
    return plan.access
      ? `Thread ${id} ${plan.access === "read" ? "reads" : "stores"} ${plan.memoryDiff[0].after} ${plan.access === "read" ? "from" : "at"} address ${plan.memoryDiff[0].address}.`
      : "This instruction does not access data memory.";
  if (stage === "Writeback") {
    const diff = plan.registerDiff[0];
    if (diff)
      return `Thread ${id}: ${diff.register} changes from ${diff.before} to ${diff.after}. Next PC: ${plan.nextPc}.`;
    if (instruction.opcode === "RET")
      return `Thread ${id} has completed its work.`;
    if (instruction.opcode === "CMP")
      return `Comparison flags committed: N=${Number(plan.flags.n)}, Z=${Number(plan.flags.z)}, P=${Number(plan.flags.p)}.`;
    return `Thread ${id} advances to PC ${plan.nextPc}.`;
  }
  return `Thread ${id} executes ${instruction.opcode}.`;
}

export function stateAt(
  result: ExecutionResult,
  eventIndex: number,
): { threads: ThreadState[]; memory: Record<number, number> } {
  if (
    !Number.isInteger(eventIndex) ||
    eventIndex < -1 ||
    eventIndex >= result.trace.length
  )
    throw new Error("Replay index is outside this trace.");
  const threads = structuredClone(result.initialThreads),
    memory = { ...result.initialMemory };
  for (let i = 0; i <= eventIndex; i++) {
    const event = result.trace[i],
      thread = threads[event.threadId];
    for (const diff of event.registerDiff)
      thread.registers[diff.register as RegisterName] = diff.after;
    if (event.memoryAccess === "write")
      for (const diff of event.memoryDiff) memory[diff.address] = diff.after;
    thread.pc = event.nextPc;
    thread.complete = event.complete;
    thread.conditionFlags = { ...event.conditionFlags };
  }
  return { threads, memory };
}
