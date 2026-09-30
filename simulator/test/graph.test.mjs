import test from "node:test";
import assert from "node:assert/strict";
import {
  lessons,
  runLesson,
  extractGraph,
  scheduleGraph,
  ancestorsOf,
  consumersOf,
  simulateSystolic,
  expectedOutput,
  simulate,
  parseProgram,
} from "../dist/index.js";

for (const lesson of lessons)
  test(`${lesson.id}: extracted graph re-executes correctly under both scheduling policies`, () => {
    const result = runLesson(lesson.id);
    const graph = extractGraph(result);
    for (const units of [1, 2, 4])
      for (const policy of ["source-order", "critical-path"]) {
        const steps = scheduleGraph(graph, units, policy);
        assert.deepEqual(steps.at(-1).memory, result.finalMemory);
        const done = new Set();
        for (const step of steps) {
          assert.ok(step.active.length <= units);
          for (const id of step.active)
            assert.ok(
              graph.nodes
                .find((node) => node.id === id)
                .dependencies.every((id) => done.has(id)),
            );
          step.active.forEach((id) => done.add(id));
        }
      }
  });

test("provenance follows the correct input threads; independent work really overlaps", () => {
  const graph = extractGraph(runLesson("vector-add"));
  const output = graph.nodes.find((node) => node.outputAddress === 128);
  const path = ancestorsOf(graph, output.id);
  assert.ok(
    graph.nodes
      .filter((node) => path.has(node.id))
      .every((node) => node.threadId === 0),
  );
  assert.ok(scheduleGraph(graph, 4).length < scheduleGraph(graph, 1).length);
});

test("graph scheduling preserves read-before-write dependencies", () => {
  const result = simulate(
    parseProgram(
      "memory",
      "LDR R1, [0]\nSTR 9, [0]\nADD R2, R1, 2\nSTR R2, [128]\nRET",
    ),
    { blockDim: 1, initialMemory: { 0: 5 } },
  );
  assert.deepEqual(
    scheduleGraph(extractGraph(result), 4).at(-1).memory,
    result.finalMemory,
  );
});

test("forward provenance reaches only the outputs consuming an input", () => {
  for (const [lesson, addresses] of [
    ["vector-add", [128]],
    ["prefix-sum", [128, 129, 130, 131]],
    ["matrix-multiply", [128, 129]],
  ]) {
    const graph = extractGraph(runLesson(lesson));
    const loads = graph.nodes.filter(
      (node) =>
        node.opcode === "LDR" &&
        node.inputs.some(
          (input) => input.kind === "memory" && input.name === "memory[0]",
        ),
    );
    const consumers = consumersOf(
      graph,
      loads.map((node) => node.id),
    );
    assert.deepEqual(
      graph.nodes
        .filter(
          (node) => node.outputAddress !== undefined && consumers.has(node.id),
        )
        .map((node) => node.outputAddress)
        .sort(),
      addresses,
    );
    assert.equal(consumersOf(graph, []).size, 0);
  }
});

test("invalid graphs fail explicitly", () => {
  const graph = extractGraph(runLesson("vector-add"));
  graph.nodes[0].dependencies.push(graph.nodes.at(-1).id);
  graph.nodes.at(-1).dependencies.push(graph.nodes[0].id);
  assert.throws(() => scheduleGraph(graph), /cycle/);
});

test("2 x 2 systolic wavefront computes real dot products with staggered readiness", () => {
  for (const [a, b] of [
    [
      [2, 5, 3, 7],
      [4, 1, 6, 2],
    ],
    [
      [0, -2, 4, 5],
      [8, 0, -1, 3],
    ],
  ]) {
    const steps = simulateSystolic(a, b);
    assert.deepEqual(
      steps.at(-1).outputs,
      expectedOutput("matrix-multiply", a, b),
    );
    assert.equal(
      steps[0].cells.filter((cell) => cell.k !== undefined).length,
      1,
    );
    assert.deepEqual(steps[0].outputs, [null, null, null, null]);
    assert.equal(
      steps.flatMap((step) => step.cells).filter((cell) => cell.k !== undefined)
        .length,
      8,
    );
  }
});
