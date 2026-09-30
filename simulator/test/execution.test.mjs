import test from "node:test";
import assert from "node:assert/strict";
import {
  simulate,
  parseProgram,
  stateAt,
  lessons,
  runLesson,
  checkLesson,
  defaultA,
  defaultB,
} from "../dist/index.js";

for (const lesson of lessons) {
  for (const model of ["scalar", "simd", "simt"]) {
    if (model === "simd" && lesson.id === "branches") continue;
    test(`${lesson.id}: ${model} agrees with independent reference`, () => {
      for (const [a, b] of [
        [defaultA, defaultB],
        [
          [0, -2, 9, 8],
          [3, 0, -4, 2],
        ],
        [
          [10, 7, -3, 2],
          [-1, 5, 4, 8],
        ],
      ]) {
        const result = runLesson(lesson.id, a, b, model);
        assert.ok(checkLesson(result, lesson.id, a, b));
        assert.deepEqual(stateAt(result, result.trace.length - 1), {
          threads: result.finalThreads,
          memory: result.finalMemory,
        });
      }
    });
  }
}

test("registers and memory commit only at their recorded stages; rewind has no future state", () => {
  const result = runLesson("vector-add");
  const execute = result.trace.findIndex(
    (event) =>
      event.threadId === 0 &&
      event.opcode === "ADD" &&
      event.pc === 4 &&
      event.stage === "Execute",
  );
  const writeback = result.trace.findIndex(
    (event) =>
      event.threadId === 0 && event.pc === 4 && event.stage === "Writeback",
  );
  assert.equal(stateAt(result, execute).threads[0].registers.R4, 0);
  assert.equal(stateAt(result, writeback).threads[0].registers.R4, 6);
  const store = result.trace.findIndex(
    (event) =>
      event.threadId === 0 &&
      event.opcode === "STR" &&
      event.stage === "Memory",
  );
  assert.equal(stateAt(result, store - 1).memory[128], undefined);
  assert.equal(stateAt(result, store).memory[128], 6);
  assert.equal(stateAt(result, 0).threads[0].registers.R4, 0);
  assert.equal(stateAt(result, -1).memory[128], undefined);
});

test("models execute different schedules, never fabricated speedup factors", () => {
  const scalar = runLesson("vector-add", defaultA, defaultB, "scalar");
  const vector = runLesson("vector-add", defaultA, defaultB, "simd");
  const simt = runLesson("vector-add", defaultA, defaultB, "simt");
  assert.equal(scalar.statistics.issues, vector.statistics.issues * 4);
  assert.equal(vector.statistics.issues, simt.statistics.issues);
  assert.equal(scalar.trace[1].threadId, 0);
  assert.equal(vector.trace[1].threadId, 1);
  assert.deepEqual(scalar.finalMemory, simt.finalMemory);
  assert.deepEqual(
    runLesson("vector-add").trace,
    runLesson("vector-add").trace,
  );
  assert.equal(
    runLesson("vector-add", defaultA, defaultB, "simt", 2).statistics.issues,
    simt.statistics.issues * 2,
  );
});

test("divergence is driven by different program counters, not thread numbers", () => {
  assert.ok(runLesson("branches").statistics.divergentIssues > 0);
  assert.equal(runLesson("vector-add").statistics.divergentIssues, 0);
  assert.equal(
    runLesson("branches", defaultA, defaultB, "simt", 2).statistics
      .divergentIssues,
    0,
  );
  assert.throws(
    () => runLesson("branches", defaultA, defaultB, "simd"),
    /straight-line/,
  );
});

test("signed division, compare flags, uint8 arithmetic and zero division have explicit semantics", () => {
  const result = simulate(
    parseProgram("signed", "CONST R1, -9\nDIV R2, R1, -2\nCMP R1, R2\nRET"),
    { blockDim: 1 },
  );
  assert.equal(result.finalThreads[0].registers.R2, 4);
  assert.equal(result.finalThreads[0].conditionFlags.n, true);
  assert.throws(
    () => simulate(parseProgram("zero", "DIV R1, 3, 0\nRET")),
    /Division by zero/,
  );
  assert.equal(
    simulate(parseProgram("byte", "ADD R1, 250, 10\nRET"), {
      numberMode: "uint8",
      blockDim: 1,
    }).finalThreads[0].registers.R1,
    4,
  );
});

test("input validation and budgets fail explicitly without partial instruction packets", () => {
  const program = parseProgram("loop", "LOOP: BRnzp nzp LOOP");
  const result = simulate(program, { maxCycles: 25, blockDim: 4 });
  assert.equal(result.status, "limit");
  assert.equal(result.trace.length, 20);
  for (const source of [
    "ADD R1, R2",
    "CONST R20, 4",
    "BRnzp n MISSING",
    "X: RET\nX: RET",
    "CONST R1, NaN",
    "LDR R1, [R2",
  ])
    assert.throws(() => parseProgram("invalid", source));
  assert.throws(() => simulate(program, { blockDim: NaN }));
  assert.throws(
    () => simulate(parseProgram("race", "STR %threadIdx, [0]\nRET")),
    /data races/,
  );
  assert.throws(
    () => simulate(parseProgram("valid", "RET"), { model: "toString" }),
    /Unknown execution model/,
  );
  assert.ok(
    Object.hasOwn(parseProgram("labels", "__proto__: RET").labels, "__proto__"),
  );
});
test("uint8 operands normalize before division and comparison, not just on writeback", () => {
  const result = simulate(
    parseProgram("byte operands", "DIV R0, -1, 2\nCMP -1, 1\nRET"),
    { blockDim: 1, numberMode: "uint8" },
  );
  assert.equal(result.finalThreads[0].registers.R0, 127);
  assert.equal(result.finalThreads[0].conditionFlags.p, true);
  assert.deepEqual(
    result.trace
      .find((event) => event.opcode === "DIV")
      .operands.map((operand) => operand.value),
    [255, 2],
  );
  assert.throws(
    () =>
      simulate(parseProgram("zero byte divisor", "DIV R0, 1, 256\nRET"), {
        blockDim: 1,
        numberMode: "uint8",
      }),
    /Division by zero/,
  );
});
