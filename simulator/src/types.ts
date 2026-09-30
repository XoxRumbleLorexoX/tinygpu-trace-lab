export type RegisterName =
  | 'R0'
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'R6'
  | 'R7'
  | 'R8'
  | 'R9'
  | 'R10'
  | 'R11'
  | 'R12';

export type SpecialRegisterName = '%blockIdx' | '%blockDim' | '%threadIdx';
export type AnyRegisterName = RegisterName | SpecialRegisterName;

export type Opcode =
  | 'ADD'
  | 'SUB'
  | 'MUL'
  | 'DIV'
  | 'CMP'
  | 'BRnzp'
  | 'LDR'
  | 'STR'
  | 'CONST'
  | 'RET';

export type PipelineStage = 'Fetch' | 'Decode' | 'Execute' | 'Memory' | 'Writeback';
export type TokenType = 'instruction' | 'data' | 'combined';
export type ConditionFlag = 'n' | 'z' | 'p';

export interface Instruction {
  opcode: Opcode;
  args: string[];
  source: string;
  label?: string;
  lineNumber?: number;
}

export interface Program {
  name: string;
  source: string;
  instructions: Instruction[];
  labels: Record<string, number>;
}

export interface RegisterDiff {
  register: AnyRegisterName;
  before: number;
  after: number;
}

export interface MemoryDiff {
  address: number;
  before: number;
  after: number;
}

export interface TraceEvent {
  cycle: number;
  timestamp: number;
  threadId: number;
  blockId: number;
  coreId: number;
  pc: number;
  instruction: string;
  opcode: Opcode;
  stage: PipelineStage;
  activeComponent: HardwareComponent;
  tokenType: TokenType;
  tokenPosition: string;
  registerDiff: RegisterDiff[];
  memoryDiff: MemoryDiff[];
  conditionFlags: Record<ConditionFlag, boolean>;
  explanatoryText: string;
  warpId: number;
  stallReason?: 'RAW' | 'WAR' | 'WAW' | 'Memory latency' | 'Divergence';
}

export type HardwareComponent =
  | 'Device Control Register'
  | 'Dispatcher'
  | 'Core'
  | 'Program Counter'
  | 'Register File'
  | 'ALU'
  | 'LSU'
  | 'Condition Flags'
  | 'Program Memory'
  | 'Data Memory'
  | 'Memory Controller';

export interface ThreadState {
  threadId: number;
  blockId: number;
  coreId: number;
  warpId: number;
  pc: number;
  registers: Record<RegisterName, number>;
  specialRegisters: Record<SpecialRegisterName, number>;
  conditionFlags: Record<ConditionFlag, boolean>;
  complete: boolean;
  lastWrite?: RegisterName;
  previousReads?: RegisterName[];
}

export interface SimulatorOptions {
  blockDim?: number;
  blockCount?: number;
  coreCount?: number;
  maxCycles?: number;
  initialMemory?: Record<number, number>;
}

export interface SimulationResult {
  program: Program;
  trace: TraceEvent[];
  finalThreads: ThreadState[];
  finalMemory: Record<number, number>;
  metrics: PerformanceMetrics;
}

export interface PerformanceMetrics {
  ipc: number;
  instructionCount: number;
  memoryAccessCount: number;
  branchCount: number;
  cacheMisses: number;
  stallCycles: number;
  occupancy: number;
  executionTime: number;
}
