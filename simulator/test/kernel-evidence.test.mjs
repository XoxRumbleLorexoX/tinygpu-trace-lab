import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import VCDParser from "vcd-parser";
import {
  simulate,
  parseProgram,
  lessonProgram,
  lessonMemory,
  defaultA,
  defaultB,
} from "../dist/index.js";
import {
  encodeHardwareProgram,
  parseKernelLog,
  compareKernelRun,
  adaptKernelSyntax,
  resetSchedulerWait,
} from "../../scripts/lib/kernel-evidence.mjs";

const program = parseProgram("Vector addition", lessonProgram("vector-add"));
const words = encodeHardwareProgram(program);
const teaching = simulate(program, {
  initialMemory: lessonMemory(defaultA, defaultB),
  numberMode: "uint8",
});

// Synthetic monitor data tests the comparison harness, not the hardware itself.
function syntheticMonitor() {
  const commits = teaching.trace.flatMap((event) =>
    event.registerDiff.map((diff) => ({
      time: event.cycle * 10 + 1,
      core: 0,
      threadId: event.threadId,
      pc: event.pc,
      register: diff.register,
      before: diff.before,
      actual: diff.after,
    })),
  );
  const transactions = teaching.trace
    .filter((event) => event.stage === "Memory" && event.memoryAccess)
    .map((event) => ({
      kind: event.memoryAccess,
      time: event.cycle * 10,
      channel: event.threadId % 2,
      address: event.memoryDiff[0].address,
      actual: event.memoryDiff[0].after,
    }));
  return {
    commits,
    transactions,
    states: [],
    fetches: words.map((word, pc) => ({ word, pc, time: pc * 100 })),
    outputs: [128, 129, 130, 131].map((address) => ({
      address,
      actual: teaching.finalMemory[address],
    })),
    termination: "DONE",
    time: 2000,
    cycles: 200,
  };
}

test("hardware encoder matches decoder bit fields and rejects unsupported source forms", () => {
  assert.deepEqual(
    words,
    [0x71f0, 0x9240, 0x322f, 0x7320, 0x3413, 0x9580, 0x355f, 0x8054, 0xf000],
  );
  assert.throws(
    () =>
      encodeHardwareProgram(
        parseProgram("Immediate arithmetic", "ADD R1, R2, 3\nRET"),
      ),
    /must be registers/,
  );
  assert.throws(
    () =>
      encodeHardwareProgram(
        parseProgram("Wide constant", "CONST R1, 256\nRET"),
      ),
    /8-bit/,
  );
  assert.throws(
    () => encodeHardwareProgram(parseProgram("Branch", "HERE: BRnzp nzp HERE")),
    /Unsupported hardware opcode/,
  );
});

test("kernel monitor parser rejects unknown values, partial runs and duplicate termination", () => {
  assert.equal(
    parseKernelLog("COMMIT,46,0,1,0,1,0,5\nDONE,200,20").commits[0].actual,
    5,
  );
  assert.throws(
    () => parseKernelLog("READ,50,0,0,x\nDONE,100,10"),
    /unknown HDL sample/,
  );
  assert.throws(() => parseKernelLog("DONE,100,10\nDONE,100,10"), /Multiple/);
  assert.throws(() => parseKernelLog("READ,50,0,0,2"), /no completion/);
  assert.equal(parseKernelLog("TIMEOUT,40960,4096").termination, "TIMEOUT");
});

test("synthetic complete monitor coverage agrees with the reference", () => {
  const comparison = compareKernelRun(teaching, syntheticMonitor(), words);
  assert.equal(comparison.status, "passed");
  assert.equal(comparison.expectedCommitCount, 28);
  assert.equal(comparison.expectedTransactionCount, 12);
  assert.ok(comparison.commits.every((sample) => sample.eventIndex !== null));
  assert.ok(
    comparison.transactions.every((sample) => sample.eventIndex !== null),
  );
});

test("matching final outputs cannot hide missing, reordered or incorrect hardware events", () => {
  for (const mutate of [
    (run) => run.commits.pop(),
    (run) => {
      run.commits[0].before = 42;
    },
    (run) => {
      run.commits[0].core = 1;
    },
    (run) => {
      run.commits.reverse();
    },
    (run) => {
      run.transactions[0].actual = 99;
    },
    (run) => run.transactions.pop(),
    (run) => run.fetches.push(run.fetches[0]),
    (run) => run.outputs.push(run.outputs[0]),
    (run) => {
      run.termination = "TIMEOUT";
    },
  ]) {
    const run = syntheticMonitor();
    mutate(run);
    const comparison = compareKernelRun(teaching, run, words);
    assert.equal(comparison.status, "failed");
    assert.ok(comparison.differences.length);
  }
});

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("compatibility and scheduler experiment edits are exact, explicit and fail on changed anchors", async () => {
  const source = (await read("hardware/original/scheduler.sv")).toString();
  const adapted = adaptKernelSyntax("hardware/original/scheduler.sv", source);
  assert.equal(adapted.changes.length, 1);
  assert.ok(adapted.content.includes("reg any_lsu_waiting = 1'b0;"));
  assert.equal(resetSchedulerWait(adapted.content).changes.length, 1);
  assert.throws(
    () => adaptKernelSyntax("hardware/original/scheduler.sv", adapted.content),
    /anchor changed/,
  );
  assert.throws(() => resetSchedulerWait("different source"), /anchor changed/);
  assert.equal(
    (await read("hardware/original/scheduler.sv")).toString(),
    source,
  );
});

test("stored kernel evidence preserves baseline failure and separately verifies the scheduler experiment", async () => {
  const reports = [];
  for (const prefix of ["kernel", "kernel-scheduler-reset"]) {
    const report = JSON.parse(
      await read(`web/public/${prefix}-validation.json`),
    );
    reports.push(report);
    const experiment = prefix !== "kernel";
    assert.equal(report.status, experiment ? "passed" : "failed");
    assert.equal(
      report.variant,
      experiment ? "scheduler-reset-experiment" : "compatibility-baseline",
    );
    assert.equal(report.originalCompilation.status, "failed");
    assert.equal(report.sourceChanges.length, 11);
    assert.equal(report.executionChanges.length, experiment ? 1 : 0);
    assert.equal(
      report.testbenchHash,
      hash(await read("hardware/validation/kernel_trace_tb.sv")),
    );
    assert.equal(
      report.originalCompilation.logHash,
      hash(await read(`web/public/${report.originalCompilation.logFile}`)),
    );
    const expectedChanges = [];
    for (const [path, digest] of Object.entries(report.sourceHashes)) {
      const original = await read(path);
      assert.equal(hash(original), digest, path);
      const adapted = adaptKernelSyntax(path, original.toString());
      expectedChanges.push(...adapted.changes);
      const compiled =
        experiment && path.endsWith("scheduler.sv")
          ? resetSchedulerWait(adapted.content).content
          : adapted.content;
      assert.equal(hash(compiled), report.compiledSourceHashes[path], path);
    }
    assert.deepEqual(report.sourceChanges, expectedChanges);
    for (const fixture of report.cases) {
      const log = await read(`web/public/${fixture.logFile}`);
      const trace = await read(`web/public/${fixture.traceFile}`);
      const wave = await read(`web/public/${fixture.waveformFile}`);
      assert.equal(hash(log), fixture.logHash);
      assert.equal(hash(trace), fixture.traceHash);
      assert.equal(hash(wave), fixture.waveformHash);
      const teaching = JSON.parse(trace);
      const comparison = compareKernelRun(
        teaching,
        parseKernelLog(log.toString()),
        report.program.words,
      );
      for (const [key, value] of Object.entries(comparison))
        assert.deepEqual(fixture[key], value, `${fixture.id}: ${key}`);
      assert.deepEqual(
        fixture.outputs.map((output) => output.expected),
        fixture.a.map((a, i) => (a + fixture.b[i]) % 256),
      );
      const parsed = await VCDParser.parse(wave.toString(), { compress: true });
      assert.equal(parsed.scale.trim(), "1ns");
      const byName = new Map(
        parsed.signal.map((signal) => [signal.name, signal]),
      );
      const valueAt = (name, time) => {
        const signal = byName.get(name);
        assert.ok(signal, name);
        const bits = signal.wave.filter(([t]) => Number(t) <= time).at(-1)?.[1];
        assert.match(bits, /^[01]+$/);
        return parseInt(bits, 2);
      };
      for (const signal of fixture.observedSignals)
        assert.deepEqual(signal.wave, byName.get(signal.name)?.wave);
      assert.equal(fixture.observedSignals.length, 6);
      for (const commit of fixture.commits) {
        const name = `kernel_trace_tb.dut.cores[${commit.core}].core_instance.threads[${commit.threadId}].register_instance.registers[${commit.register.slice(1)}][7:0]`;
        assert.equal(valueAt(name, commit.time), commit.actual);
        assert.equal(valueAt(name, commit.time - 2), commit.before);
      }
      for (const fetch of fixture.fetches)
        assert.equal(
          valueAt("kernel_trace_tb.program_mem_read_data[0][15:0]", fetch.time),
          fetch.word,
        );
      if (experiment) {
        assert.equal(fixture.commits.length, 28);
        assert.equal(fixture.transactions.length, 12);
        assert.equal(fixture.fetches.length, 9);
        assert.equal(fixture.termination, "DONE");
        assert.ok(fixture.outputs.every((output) => output.match));
      } else {
        assert.equal(fixture.termination, "TIMEOUT");
        assert.equal(fixture.commits.length, 0);
        assert.equal(fixture.transactions.length, 4);
        assert.equal(fixture.states.at(-1).state, 4);
        assert.equal(
          valueAt(
            "kernel_trace_tb.dut.cores[0].core_instance.scheduler_instance.unnamedblk1.any_lsu_waiting",
            fixture.time,
          ),
          1,
        );
        for (let lane = 0; lane < 4; lane++)
          assert.equal(
            valueAt(
              `kernel_trace_tb.dut.cores[0].core_instance.lsu_state[${lane}][1:0]`,
              fixture.time,
            ),
            3,
          );
      }
    }
  }
  assert.deepEqual(reports[0].sourceHashes, reports[1].sourceHashes);
  assert.ok(reports[1].cases[2].cycles > reports[1].cases[0].cycles);
  assert.deepEqual(reports[1].cases[2].outputs, reports[1].cases[0].outputs);
});
