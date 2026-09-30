import type {
  AnyRegisterName,
  ConditionFlag,
  HardwareComponent,
  Instruction,
  MemoryDiff,
  PerformanceMetrics,
  PipelineStage,
  Program,
  RegisterDiff,
  RegisterName,
  SimulationResult,
  SimulatorOptions,
  ThreadState,
  TokenType,
  TraceEvent
} from './types.js';

const generalRegisters: RegisterName[] = [
  'R0',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
  'R9',
  'R10',
  'R11',
  'R12'
];

const stageComponent: Record<PipelineStage, HardwareComponent> = {
  Fetch: 'Program Memory',
  Decode: 'Dispatcher',
  Execute: 'ALU',
  Memory: 'Memory Controller',
  Writeback: 'Register File'
};

const pipeline: PipelineStage[] = ['Fetch', 'Decode', 'Execute', 'Memory', 'Writeback'];

export function simulate(program: Program, options: SimulatorOptions = {}): SimulationResult {
  const blockDim = options.blockDim ?? 8;
  const blockCount = options.blockCount ?? 1;
  const coreCount = options.coreCount ?? 2;
  const maxCycles = options.maxCycles ?? 500;
  const memory: Record<number, number> = { ...(options.initialMemory ?? seedMemory(blockDim * blockCount)) };
  const threads = createThreads(blockDim, blockCount, coreCount);
  const trace: TraceEvent[] = [];
  let cycle = 0;
  let instructionCount = 0;
  let memoryAccessCount = 0;
  let branchCount = 0;
  let cacheMisses = 0;
  let stallCycles = 0;

  while (cycle < maxCycles && threads.some((thread) => !thread.complete)) {
    for (const thread of threads.filter((item) => !item.complete)) {
      const instruction = program.instructions[thread.pc];
      if (!instruction) {
        thread.complete = true;
        continue;
      }

      const beforePc = thread.pc;
      const detectedHazard = hazardFor(thread, instruction);
      const exec = executeInstruction(thread, instruction, program, memory);
      instructionCount += instruction.opcode === 'RET' ? 0 : 1;
      memoryAccessCount += instruction.opcode === 'LDR' || instruction.opcode === 'STR' ? 1 : 0;
      branchCount += instruction.opcode === 'BRnzp' ? 1 : 0;
      if (instruction.opcode === 'LDR' && (thread.threadId + beforePc) % 3 === 0) cacheMisses += 1;
      const stallReason = exec.stallReason ?? detectedHazard;
      if (stallReason) stallCycles += 1;

      for (const stage of pipeline) {
        const tokenType = tokenTypeFor(instruction, stage);
        trace.push({
          cycle: cycle++,
          timestamp: cycle * 16,
          threadId: thread.threadId,
          blockId: thread.blockId,
          coreId: thread.coreId,
          pc: beforePc,
          instruction: instruction.source,
          opcode: instruction.opcode,
          stage,
          activeComponent: activeComponentFor(instruction, stage),
          tokenType,
          tokenPosition: `${stage}:${activeComponentFor(instruction, stage)}`,
          registerDiff: stage === 'Writeback' || instruction.opcode === 'CMP' ? exec.registerDiff : [],
          memoryDiff: stage === 'Memory' ? exec.memoryDiff : [],
          conditionFlags: { ...thread.conditionFlags },
          explanatoryText: explain(thread, instruction, stage, exec.registerDiff, exec.memoryDiff),
          warpId: thread.warpId,
          stallReason: stage === 'Execute' ? stallReason : undefined
        });
      }
    }
  }

  const executionTime = trace.length * 16;
  const metrics: PerformanceMetrics = {
    ipc: Number((instructionCount / Math.max(1, trace.length / pipeline.length)).toFixed(2)),
    instructionCount,
    memoryAccessCount,
    branchCount,
    cacheMisses,
    stallCycles,
    occupancy: Number((threads.filter((thread) => thread.complete).length / threads.length).toFixed(2)),
    executionTime
  };

  return { program, trace, finalThreads: threads, finalMemory: memory, metrics };
}

function createThreads(blockDim: number, blockCount: number, coreCount: number): ThreadState[] {
  const threads: ThreadState[] = [];
  for (let blockId = 0; blockId < blockCount; blockId += 1) {
    for (let threadIdx = 0; threadIdx < blockDim; threadIdx += 1) {
      const registers = Object.fromEntries(generalRegisters.map((register) => [register, 0])) as Record<RegisterName, number>;
      threads.push({
        threadId: blockId * blockDim + threadIdx,
        blockId,
        coreId: threadIdx % coreCount,
        warpId: Math.floor(threadIdx / 4),
        pc: 0,
        registers,
        specialRegisters: { '%blockIdx': blockId, '%blockDim': blockDim, '%threadIdx': threadIdx },
        conditionFlags: { n: false, z: true, p: false },
        complete: false,
        previousReads: []
      });
    }
  }
  return threads;
}

function executeInstruction(
  thread: ThreadState,
  instruction: Instruction,
  program: Program,
  memory: Record<number, number>
): { registerDiff: RegisterDiff[]; memoryDiff: MemoryDiff[]; stallReason?: TraceEvent['stallReason'] } {
  const registerDiff: RegisterDiff[] = [];
  const memoryDiff: MemoryDiff[] = [];
  const readRegs = readRegisters(instruction);
  const writeRegister = (register: AnyRegisterName, after: number) => {
    if (!isGeneral(register)) return;
    const before = thread.registers[register];
    thread.registers[register] = after;
    thread.lastWrite = register;
    setFlags(thread, after);
    registerDiff.push({ register, before, after });
  };
  const next = () => {
    thread.pc += 1;
  };

  switch (instruction.opcode) {
    case 'CONST':
      writeRegister(instruction.args[0] as AnyRegisterName, Number(instruction.args[1]));
      next();
      thread.previousReads = readRegs;
      break;
    case 'ADD':
      writeRegister(instruction.args[0] as AnyRegisterName, value(thread, instruction.args[1]) + value(thread, instruction.args[2]));
      next();
      thread.previousReads = readRegs;
      break;
    case 'SUB':
      writeRegister(instruction.args[0] as AnyRegisterName, value(thread, instruction.args[1]) - value(thread, instruction.args[2]));
      next();
      thread.previousReads = readRegs;
      break;
    case 'MUL':
      writeRegister(instruction.args[0] as AnyRegisterName, value(thread, instruction.args[1]) * value(thread, instruction.args[2]));
      next();
      thread.previousReads = readRegs;
      break;
    case 'DIV':
      writeRegister(instruction.args[0] as AnyRegisterName, Math.trunc(value(thread, instruction.args[1]) / Math.max(1, value(thread, instruction.args[2]))));
      next();
      thread.previousReads = readRegs;
      break;
    case 'CMP':
      setFlags(thread, value(thread, instruction.args[0]) - value(thread, instruction.args[1]));
      next();
      thread.previousReads = readRegs;
      break;
    case 'BRnzp': {
      const flags = instruction.args[0] ?? 'nzp';
      const label = instruction.args[1];
      const shouldBranch = flags.split('').some((flag) => thread.conditionFlags[flag as ConditionFlag]);
      thread.pc = shouldBranch ? program.labels[label] ?? thread.pc + 1 : thread.pc + 1;
      thread.previousReads = readRegs;
      break;
    }
    case 'LDR': {
      const address = addressValue(thread, instruction.args[1]);
      const loaded = memory[address] ?? 0;
      memoryDiff.push({ address, before: loaded, after: loaded });
      writeRegister(instruction.args[0] as AnyRegisterName, loaded);
      next();
      thread.previousReads = readRegs;
      break;
    }
    case 'STR': {
      const address = addressValue(thread, instruction.args[1]);
      const before = memory[address] ?? 0;
      const after = value(thread, instruction.args[0]);
      memory[address] = after;
      memoryDiff.push({ address, before, after });
      thread.previousReads = readRegs;
      next();
      break;
    }
    case 'RET':
      thread.complete = true;
      break;
  }

  const stallReason = instruction.opcode === 'BRnzp' && thread.threadId >= 4 ? 'Divergence' : undefined;
  return { registerDiff, memoryDiff, stallReason };
}

function hazardFor(thread: ThreadState, instruction: Instruction): TraceEvent['stallReason'] {
  const reads = readRegisters(instruction);
  const write = writeRegisterFor(instruction);
  if (thread.lastWrite && reads.includes(thread.lastWrite)) return 'RAW';
  if (instruction.opcode === 'LDR' && thread.threadId % 3 === 0) return 'Memory latency';
  if (write && thread.lastWrite === write) return 'WAW';
  if (write && thread.previousReads?.includes(write)) return 'WAR';
  return undefined;
}

function readRegisters(instruction: Instruction): RegisterName[] {
  const args = instruction.args.slice(instruction.opcode === 'STR' ? 0 : 1);
  return args.flatMap((arg) => {
    const token = arg.startsWith('[') && arg.endsWith(']') ? arg.slice(1, -1) : arg;
    return isGeneral(token) ? [token] : [];
  });
}

function writeRegisterFor(instruction: Instruction): RegisterName | undefined {
  if (['ADD', 'SUB', 'MUL', 'DIV', 'LDR', 'CONST'].includes(instruction.opcode) && isGeneral(instruction.args[0])) {
    return instruction.args[0];
  }
  return undefined;
}

function value(thread: ThreadState, token: string): number {
  if (isGeneral(token)) return thread.registers[token];
  if (token in thread.specialRegisters) return thread.specialRegisters[token as keyof ThreadState['specialRegisters']];
  return Number(token);
}

function addressValue(thread: ThreadState, token: string): number {
  if (token.startsWith('[') && token.endsWith(']')) return value(thread, token.slice(1, -1));
  return value(thread, token);
}

function isGeneral(token: string): token is RegisterName {
  return generalRegisters.includes(token as RegisterName);
}

function setFlags(thread: ThreadState, result: number) {
  thread.conditionFlags = { n: result < 0, z: result === 0, p: result > 0 };
}

function tokenTypeFor(instruction: Instruction, stage: PipelineStage): TokenType {
  if (stage === 'Memory' && ['LDR', 'STR'].includes(instruction.opcode)) return 'data';
  if (stage === 'Writeback' && ['LDR', 'STR'].includes(instruction.opcode)) return 'combined';
  return 'instruction';
}

function activeComponentFor(instruction: Instruction, stage: PipelineStage): HardwareComponent {
  if (instruction.opcode === 'LDR' || instruction.opcode === 'STR') {
    if (stage === 'Execute') return 'LSU';
    if (stage === 'Memory') return 'Data Memory';
  }
  if (instruction.opcode === 'BRnzp' && stage === 'Execute') return 'Condition Flags';
  if (stage === 'Fetch') return 'Program Counter';
  return stageComponent[stage];
}

function explain(
  thread: ThreadState,
  instruction: Instruction,
  stage: PipelineStage,
  registerDiff: RegisterDiff[],
  memoryDiff: MemoryDiff[]
): string {
  if (stage === 'Fetch') return `Thread ${thread.threadId} fetched ${instruction.source} from program memory.`;
  if (stage === 'Decode') return `The dispatcher decoded ${instruction.opcode} and selected source operands.`;
  if (stage === 'Execute' && instruction.opcode === 'BRnzp') return `Thread ${thread.threadId} evaluated condition flags for a possible branch.`;
  if (stage === 'Memory' && memoryDiff[0]) {
    return instruction.opcode === 'LDR'
      ? `Thread ${thread.threadId} read value ${memoryDiff[0].after} from memory address ${memoryDiff[0].address}.`
      : `Thread ${thread.threadId} stored value ${memoryDiff[0].after} at memory address ${memoryDiff[0].address}.`;
  }
  if (stage === 'Writeback' && registerDiff[0]) {
    const diff = registerDiff[0];
    if (instruction.opcode === 'LDR') {
      const address = memoryDiff[0]?.address;
      return address === undefined
        ? `Thread ${thread.threadId} loaded value ${diff.after} from memory into ${diff.register}.`
        : `Thread ${thread.threadId} loaded value ${diff.after} from memory address ${address} into ${diff.register}.`;
    }
    return `Thread ${thread.threadId} wrote ${diff.after} into ${diff.register}.`;
  }
  return `Thread ${thread.threadId} advanced through ${stage.toLowerCase()} for ${instruction.opcode}.`;
}

function seedMemory(length: number): Record<number, number> {
  const memory: Record<number, number> = {};
  for (let index = 0; index < length; index += 1) {
    memory[index] = index * 2;
    memory[index + 64] = index + 10;
  }
  return memory;
}
