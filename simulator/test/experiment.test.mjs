import test from "node:test";
import assert from "node:assert/strict";
import {
  lessons,
  lessonProgram,
  lessonMemory,
  defaultA,
  defaultB,
  expectedOutput,
  runExperiment,
  validateExperiment,
  parseProgram,
  stateAt,
  extractGraph,
  experimentLimits,
} from "../dist/index.js";

const document = (changes = {}) => ({
  format: "tinygpu-program-1",
  modelVersion: "teaching-1",
  name: "Custom experiment",
  source: lessonProgram("vector-add"),
  initialMemory: lessonMemory(defaultA, defaultB),
  expectedMemory: { 128: 6, 129: 6, 130: 9, 131: 9 },
  blockDim: 4,
  blockCount: 1,
  laneWidth: 4,
  numberMode: "integer",
  ...changes,
});

for (const lesson of lessons)
  test(`program studio: ${lesson.id} checks independent expectations and graph schedules`, () => {
    const report = runExperiment(
      document({
        source: lessonProgram(lesson.id),
        blockDim: ["reduction", "prefix-sum"].includes(lesson.id) ? 1 : 4,
        expectedMemory: Object.fromEntries(
          expectedOutput(lesson.id, defaultA, defaultB).map((value, i) => [
            128 + i,
            value,
          ]),
        ),
      }),
    );
    for (const run of report.runs) {
      if (run.model === "simd" && lesson.id === "branches") {
        assert.match(run.error, /straight-line/);
        assert.equal(run.agreesWithSequential, null);
        continue;
      }
      assert.equal(run.result.status, "complete");
      assert.equal(run.error, "");
      assert.ok(run.checks.every((check) => check.matches));
      assert.equal(run.agreesWithSequential, true);
      assert.equal(run.graphVerified, true, run.graphError);
    }
  });

test("custom source keeps source lines, repeated operations and committed replay state", () => {
  const source =
    "; a counted loop\nCONST R0, 3\nCONST R1, 0\n\nLOOP:\nADD R1, R1, 2\nSUB R0, R0, 1\nCMP R0, 0\nBRnzp p LOOP\nSTR R1, [200]\nRET";
  const report = runExperiment(
    document({ source, blockDim: 1, expectedMemory: { 200: 6 } }),
  );
  const run = report.runs[2];
  assert.equal(run.result.program.instructions[2].lineNumber, 6);
  assert.equal(run.result.finalMemory[200], 6);
  assert.equal(run.graphVerified, true, run.graphError);
  const graph = extractGraph(run.result);
  assert.equal(graph.nodes.filter((node) => node.pc === 2).length, 3);
  const store = run.result.trace.find(
    (event) => event.opcode === "STR" && event.stage === "Memory",
  );
  assert.equal(stateAt(run.result, store.cycle - 1).memory[200], undefined);
  assert.equal(stateAt(run.result, store.cycle).memory[200], 6);
  assert.throws(() => parseProgram("bad", "; comment\n\nADD R1, 2"), /line 3/);
});

test("expectations are never inferred from results; imported results are never trusted", () => {
  const input = document({ source: lessonProgram("dependencies") });
  const report = runExperiment(input);
  assert.ok(
    report.runs.every((run) => run.checks.every((check) => !check.matches)),
  );
  const roundtrip = JSON.parse(
    JSON.stringify({
      ...report.document,
      runs: [{ result: { finalMemory: { 128: 999 } } }],
    }),
  );
  assert.deepEqual(runExperiment(roundtrip), report);
  assert.ok(
    runExperiment(document({ expectedMemory: {} })).runs.every(
      (run) => run.checks.length === 0,
    ),
  );
});

test("shared memory makes model-order disagreement observable without claiming universal equivalence", () => {
  const report = runExperiment(
    document({
      source:
        "LDR R0, [0]\nADD R0, R0, 1\nADD R1, %threadIdx, 128\nSTR R0, [R1]\nSTR R0, [0]\nRET",
      blockDim: 2,
      laneWidth: 1,
      initialMemory: { 0: 0 },
      expectedMemory: { 128: 1, 129: 2 },
    }),
  );
  assert.equal(report.runs[0].result.finalMemory[129], 2);
  assert.equal(report.runs[2].result.finalMemory[129], 1);
  assert.equal(report.runs[2].agreesWithSequential, false);
  assert.equal(report.runs[2].checks[1].matches, false);
  assert.ok(
    report.runs.every((run) => run.graphVerified),
    JSON.stringify(report.runs.map((run) => run.graphError)),
  );
});

test("infinite loops, arithmetic errors and simultaneous stores cannot produce verified results", () => {
  const limit = runExperiment(
    document({ source: "LOOP: BRnzp nzp LOOP", blockDim: 1 }),
  ).runs[2];
  assert.equal(limit.result.status, "limit");
  assert.equal(limit.result.trace.length, experimentLimits.events);
  assert.equal(limit.graphVerified, false);
  assert.equal(limit.agreesWithSequential, null);
  assert.deepEqual(limit.checks, []);
  for (const source of ["DIV R1, 1, 0\nRET", "STR %threadIdx, [0]\nRET"]) {
    const run = runExperiment(document({ source })).runs[2];
    assert.equal(run.result, null);
    assert.notEqual(run.error, "");
    assert.equal(run.graphVerified, false);
  }
});

test("portable experiment validation bounds work and rejects invalid memory and versions", () => {
  for (const changes of [
    { format: "other" },
    { modelVersion: "future" },
    { name: "" },
    { source: "" },
    { source: "RET\n".repeat(129) },
    { source: ";".repeat(16385) },
    { source: ";\n".repeat(513) },
    { blockDim: 17 },
    { blockDim: 8, blockCount: 3 },
    { laneWidth: 0 },
    { numberMode: "float" },
    { initialMemory: [] },
    { initialMemory: { "-1": 1 } },
    { initialMemory: { "01": 1 } },
    { initialMemory: { 0: "1" } },
    { initialMemory: { 65536: 1 } },
    { initialMemory: { 0: Infinity } },
    {
      initialMemory: Object.fromEntries(
        Array.from({ length: 65 }, (_, i) => [i, 0]),
      ),
    },
    { expectedMemory: JSON.parse('{"__proto__":1}') },
    { numberMode: "uint8", expectedMemory: { 128: 256 } },
  ])
    assert.throws(
      () => validateExperiment(document(changes)),
      JSON.stringify(changes),
    );
  const byte = runExperiment(
    document({
      source: "ADD R1, 250, 10\nSTR R1, [128]\nRET",
      blockDim: 1,
      numberMode: "uint8",
      expectedMemory: { 128: 4 },
    }),
  );
  assert.ok(
    byte.runs.every((run) => run.graphVerified && run.checks[0].matches),
  );
});
