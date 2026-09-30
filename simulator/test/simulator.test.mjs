import assert from 'node:assert/strict';
import { loadExampleProgram, simulate } from '../dist/index.js';

const vector = simulate(loadExampleProgram('vectorAdd'), { blockDim: 4, coreCount: 2 });
assert.ok(vector.trace.length > 0, 'vectorAdd should generate trace events');
assert.deepEqual(
  {
    cycle: vector.trace[0].cycle,
    threadId: vector.trace[0].threadId,
    blockId: vector.trace[0].blockId,
    coreId: vector.trace[0].coreId,
    pc: vector.trace[0].pc,
    opcode: vector.trace[0].opcode,
    stage: vector.trace[0].stage,
    activeComponent: vector.trace[0].activeComponent,
    tokenType: vector.trace[0].tokenType
  },
  {
    cycle: 0,
    threadId: 0,
    blockId: 0,
    coreId: 0,
    pc: 0,
    opcode: 'CONST',
    stage: 'Fetch',
    activeComponent: 'Program Counter',
    tokenType: 'instruction'
  }
);
assert.ok(vector.trace.some((event) => event.memoryDiff.length > 0), 'trace should include memory diffs');
assert.ok(vector.metrics.instructionCount > 0, 'metrics should count instructions');

const divergence = simulate(loadExampleProgram('branchDivergence'), { blockDim: 8, laneWidth: 8 });
assert.ok(divergence.trace.some((event) => event.stallReason === 'Divergence'), 'branch demo should record divergence');
assert.ok(divergence.metrics.branchCount > 0, 'branch demo should count branches');

console.log('simulator tests ok');
