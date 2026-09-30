import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root));
const hash = (value) => createHash("sha256").update(value).digest("hex");

test("bundled hardware evidence matches source hashes, teaching operands, and waveform samples", async () => {
  const report = JSON.parse(await read("web/public/hardware-validation.json"));
  const teaching = JSON.parse(
    await read("web/public/hardware-teaching-trace.json"),
  );
  assert.equal(report.sourceHash, hash(await read("hardware/original/alu.sv")));
  assert.equal(
    report.testbenchHash,
    hash(await read("hardware/validation/alu_trace_tb.sv")),
  );
  assert.equal(
    report.waveformHash,
    hash(await read("web/public/hardware-waveform.vcd")),
  );
  assert.equal(report.status, "passed");
  assert.equal(report.checked, 31);
  assert.equal(report.mismatches, 0);
  assert.equal(report.samples.length, report.checked);
  assert.equal(
    report.samples.filter((sample) => sample.kind === "lesson").length,
    12,
  );
  assert.equal(report.waveform.scale, "1ns");
  const signal = report.waveform.signals.find(
    (signal) => signal.signalName === "alu_out",
  );
  assert.ok(signal);
  for (const sample of report.samples) {
    assert.equal(sample.actual, sample.expected);
    const bits = signal.wave
      .filter(([time]) => Number(time) <= sample.time)
      .at(-1)?.[1];
    assert.match(bits, /^[01]+$/);
    assert.equal(parseInt(bits, 2), sample.actual);
    if (sample.eventIndex !== null) {
      const event = teaching.trace[sample.eventIndex];
      assert.equal(event.stage, "Execute");
      assert.equal(event.operationId, sample.operationId);
      assert.equal(event.resultValue, sample.expected);
      assert.deepEqual(
        event.operands.map((operand) => operand.value),
        [sample.left, sample.right],
      );
    }
  }
  assert.ok(report.exclusions.includes("complete kernels"));
  assert.ok(report.exclusions.includes("vendor timing"));
});
