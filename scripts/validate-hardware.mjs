import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import VCDParser from "vcd-parser";
import {
  simulate,
  parseProgram,
  lessonProgram,
  lessonMemory,
  defaultA,
  defaultB,
} from "../simulator/dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), "tinygpu-hdl-"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = join(root, "hardware/original/alu.sv");
const testbench = join(root, "hardware/validation/alu_trace_tb.sv");
const out = join(root, "web/public");
let finished = false;
function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr}`,
    );
  return result.stdout;
}

try {
  const version = run("iverilog", ["-V"]).split("\n")[0];
  const trace = simulate(
    parseProgram("HDL vector-add fixture", lessonProgram("vector-add")),
    {
      model: "simt",
      laneWidth: 4,
      blockDim: 4,
      numberMode: "uint8",
      initialMemory: lessonMemory(defaultA, defaultB),
    },
  );
  const opcodes = ["ADD", "SUB", "MUL", "DIV"];
  const samples = trace.trace
    .filter(
      (event) => event.stage === "Execute" && opcodes.includes(event.opcode),
    )
    .map((event) => ({
      opcode: event.opcode,
      left: event.operands[0].value,
      right: event.operands[1].value,
      expected: event.resultValue,
      eventIndex: event.cycle,
      instruction: event.instruction,
      threadId: event.threadId,
      operationId: event.operationId,
      kind: "lesson",
      reset: 0,
      enable: 1,
      state: 5,
    }));
  for (const opcode of opcodes)
    for (const [left, right] of [
      [0, 1],
      [255, 1],
      [255, 255],
      [17, 3],
    ]) {
      const teaching = simulate(
        parseProgram(
          "ALU boundary fixture",
          `${opcode} R0, ${left}, ${right}\nRET`,
        ),
        { blockDim: 1, numberMode: "uint8" },
      );
      samples.push({
        opcode,
        left,
        right,
        expected: teaching.finalThreads[0].registers.R0,
        eventIndex: null,
        kind: "boundary",
        reset: 0,
        enable: 1,
        state: 5,
      });
    }
  const last = samples.at(-1).expected;
  samples.push(
    {
      opcode: "ADD",
      left: 6,
      right: 8,
      expected: last,
      eventIndex: null,
      kind: "disabled-hold",
      reset: 0,
      enable: 0,
      state: 5,
    },
    {
      opcode: "ADD",
      left: 6,
      right: 8,
      expected: last,
      eventIndex: null,
      kind: "non-execute-hold",
      reset: 0,
      enable: 1,
      state: 4,
    },
    {
      opcode: "ADD",
      left: 6,
      right: 8,
      expected: 0,
      eventIndex: null,
      kind: "reset",
      reset: 1,
      enable: 1,
      state: 5,
    },
  );
  const vectors =
    samples
      .map((sample, index) =>
        [
          index,
          sample.reset,
          sample.enable,
          sample.state,
          opcodes.indexOf(sample.opcode),
          sample.left,
          sample.right,
        ].join(" "),
      )
      .join("\n") + "\n";
  const vectorPath = join(scratch, "vectors.txt"),
    wavePath = join(scratch, "waveform.vcd"),
    executable = join(scratch, "alu.vvp");
  await writeFile(vectorPath, vectors);
  run("iverilog", [
    "-g2012",
    "-s",
    "alu_trace_tb",
    "-o",
    executable,
    source,
    testbench,
  ]);
  const log = run("vvp", [
    executable,
    `+vectors=${vectorPath}`,
    `+wave=${wavePath}`,
  ]);
  const readings = log
    .split("\n")
    .filter((line) => line.startsWith("SAMPLE,"))
    .map((line) => {
      const [, index, time, actual] = line.split(",");
      if (![index, time, actual].every((value) => /^\d+$/.test(value)))
        throw new Error(`Unknown HDL value: ${line}`);
      return {
        index: Number(index),
        time: Number(time),
        actual: Number(actual),
      };
    });
  if (
    readings.length !== samples.length ||
    readings.some((reading, i) => reading.index !== i)
  )
    throw new Error("Incomplete HDL sample stream.");
  readings.forEach(({ index, time, actual }) =>
    Object.assign(samples[index], { time, actual }),
  );
  const wave = await readFile(wavePath, "utf8");
  // Icarus emits a post-header comment/dumpall prelude; the parser accepts dumpvars.
  const parsed = await VCDParser.parse(
    wave
      .replace(/\$comment[\s\S]*?\$end/g, "")
      .replace(/\$(dumpall|dumpon|dumpoff)\b/g, "$dumpvars"),
    { compress: true },
  );
  const mismatches = samples.filter(
    (sample) => sample.expected !== sample.actual,
  ).length;
  const report = {
    format: "tinygpu-hardware-1",
    generatedAt: new Date().toISOString(),
    status: mismatches ? "failed" : "passed",
    tool: version,
    sourceHash: hash(await readFile(source)),
    testbenchHash: hash(await readFile(testbench)),
    waveformHash: hash(wave),
    checked: samples.length,
    mismatches,
    scope:
      "Preserved tiny-gpu ALU: bundled vector-add arithmetic, unsigned 8-bit boundaries, reset, enable, and EXECUTE gating. Not a complete GPU or timing validation.",
    exclusions: [
      "CMP/NZP encoding",
      "division by zero",
      "memory controllers",
      "complete kernels",
      "scheduler",
      "vendor timing",
    ],
    lesson: {
      id: "vector-add",
      a: defaultA,
      b: defaultB,
      model: "simt",
      laneWidth: 4,
      numberMode: "uint8",
    },
    samples,
    waveform: {
      scale: parsed.scale.trim(),
      endtime: Number(parsed.endtime),
      signals: parsed.signal.map((signal) => ({
        ...signal,
        signalName: signal.signalName.replace(/\[.*\]$/, ""),
      })),
    },
  };
  await mkdir(out, { recursive: true });
  await writeFile(
    join(out, "hardware-validation.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(join(out, "hardware-waveform.vcd"), wave);
  await writeFile(
    join(out, "hardware-teaching-trace.json"),
    JSON.stringify(trace, null, 2) + "\n",
  );
  console.log(
    `${version}\n${samples.length} cases, ${mismatches} mismatches\nALU SHA-256 ${report.sourceHash}`,
  );
  if (mismatches) process.exitCode = 1;
  finished = true;
} finally {
  if (finished) await rm(scratch, { recursive: true, force: true });
  else console.error(`Hardware diagnostics retained: ${scratch}`);
}
