import type { PipelineStage } from '@tinygpu-trace-lab/simulator';

export const cameraPresets = ['Overview', 'Pipeline View', 'Memory View', 'Core View', 'Token Follow Mode', 'Free Camera', 'Cinematic Replay Camera'] as const;
export const abstractionLevels = ['GPU Overview', 'Core View', 'Pipeline View', 'Register View', 'Logic/Gate View'] as const;
export const pipelineStages: PipelineStage[] = ['Fetch', 'Decode', 'Execute', 'Memory', 'Writeback'];

export const comparisonModes = ['CPU vs GPU', 'Optimized vs Unoptimized Kernel', 'Different Block Sizes', 'Different Scheduling Policies'] as const;

export const exampleLabels = {
  vectorAdd: 'Vector Addition',
  matrixAdd: 'Matrix Addition',
  matrixMultiply: 'Element-wise Multiplication',
  reduction: 'Element-wise Increment',
  prefixSum: 'Add Thread Index',
  branchDivergence: 'Branch Divergence Demo',
  memoryCoalescing: 'Strided Memory Access'
} as const;

export const exampleDescriptions: Record<keyof typeof exampleLabels, string> = {
  vectorAdd: 'Baseline data-parallel load, add, store flow.',
  matrixAdd: 'Two-source memory access with per-thread indexing.',
  matrixMultiply: 'Per-element products; not matrix multiplication.',
  reduction: 'Each thread increments one input; not a reduction.',
  prefixSum: 'Each thread adds its index; not a prefix sum.',
  branchDivergence: 'Control-flow split and masked lanes.',
  memoryCoalescing: 'Strided addresses; bandwidth is not modeled.'
};

export function comparisonCopy(mode: (typeof comparisonModes)[number]) {
  return {
    baselineLabel: mode.includes('CPU') ? 'CPU' : 'Baseline',
    baselineValue: mode.includes('Block') ? '4 threads/block' : mode.includes('Scheduling') ? 'Round-robin' : 'Serial issue',
    experimentLabel: mode.includes('CPU') ? 'GPU' : 'Experiment',
    experimentValue: mode.includes('Block') ? '8 threads/block' : mode.includes('Scheduling') ? 'Latency-aware' : 'SIMT lanes'
  };
}

export const tokenLegend = [
  ['Instruction', 'instruction'],
  ['Data', 'data'],
  ['Completed', 'completed'],
  ['Stall', 'stall']
] as const;

export const memoryHierarchy = [
  ['Registers', '1 cycle', 'active'],
  ['Shared Memory', 'planned', 'idle'],
  ['L1 Cache', 'cacheMisses', 'stallWhenPresent'],
  ['Global Memory', 'memoryAccessCount', 'activeAccesses']
] as const;
