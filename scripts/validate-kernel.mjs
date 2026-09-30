import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import VCDParser from "vcd-parser";
import {
  simulate,
  parseProgram,
  lessonProgram,
  lessonMemory,
  defaultA,
  defaultB,
} from "../simulator/dist/index.js";
import {
  encodeHardwareProgram,
  parseKernelLog,
  compareKernelRun,
  adaptKernelSyntax,
  resetSchedulerWait,
} from "./lib/kernel-evidence.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const schedulerReset = process.argv.includes("--scheduler-reset");
if (process.argv.slice(2).some((arg) => arg !== "--scheduler-reset"))
  throw new Error("Only --scheduler-reset is supported.");
const prefix = schedulerReset ? "kernel-scheduler-reset" : "kernel";
const scratch = await mkdtemp(join(tmpdir(), "tinygpu-kernel-"));
const out = join(root, "web/public");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const testbench = "hardware/validation/kernel_trace_tb.sv";
const sourcePaths = (await readdir(join(root, "hardware/original")))
  .filter((path) => path.endsWith(".sv"))
  .sort()
  .map((path) => `hardware/original/${path}`);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (path) => [
      path,
      hash(await readFile(join(root, path))),
    ]),
  ),
);
const testbenchHash = hash(await readFile(join(root, testbench)));
const run = async (command, args, timeout = 120000, allowFailure = false) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout,
    maxBuffer: 32 * 1024 * 1024,
  });
  await writeFile(
    join(scratch, "last-command.log"),
    `${command} ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  );
  if (result.error || (result.status !== 0 && !allowFailure))
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.status}\n${result.stderr}\n${result.stdout}`,
    );
  return result;
};

let finished = false;
try {
  const tool = (await run("verilator", ["--version"])).stdout.trim();
  const originalCheck = await run(
    "verilator",
    [
      "--lint-only",
      "--timing",
      "--trace",
      "--top-module",
      "kernel_trace_tb",
      "-Wno-fatal",
      ...sourcePaths,
      testbench,
    ],
    120000,
    true,
  );
  const originalLog = originalCheck.stdout + originalCheck.stderr;
  await writeFile(join(out, "kernel-original-compile.log"), originalLog);
  const sourceChanges = [];
  const executionChanges = [];
  const compiledSourceHashes = {};
  const compiledPaths = [];
  await mkdir(join(scratch, "sources"));
  for (const path of sourcePaths) {
    const original = await readFile(join(root, path), "utf8");
    const adapted =
      originalCheck.status === 0
        ? { content: original, changes: [] }
        : adaptKernelSyntax(path, original);
    sourceChanges.push(...adapted.changes);
    if (schedulerReset && path === "hardware/original/scheduler.sv") {
      const experiment = resetSchedulerWait(adapted.content);
      adapted.content = experiment.content;
      executionChanges.push(...experiment.changes);
    }
    const compiledPath = join(scratch, "sources", path.split("/").at(-1));
    await writeFile(compiledPath, adapted.content);
    compiledPaths.push(compiledPath);
    compiledSourceHashes[path] = hash(adapted.content);
  }
  const compile = await run("verilator", [
    "--binary",
    "--timing",
    "--trace",
    "--top-module",
    "kernel_trace_tb",
    "--Mdir",
    join(scratch, "obj"),
    "-Wno-fatal",
    "-j",
    "2",
    ...compiledPaths,
    testbench,
  ]);
  await writeFile(
    join(scratch, "compile.log"),
    compile.stdout + compile.stderr,
  );
  const program = parseProgram(
    "Vector add / hardware",
    lessonProgram("vector-add"),
  );
  const words = encodeHardwareProgram(program);
  const programPath = join(scratch, "program.hex");
  await writeFile(
    programPath,
    Array.from({ length: 256 }, (_, i) =>
      (words[i] ?? 0).toString(16).padStart(4, "0"),
    ).join("\n") + "\n",
  );
  const cases = [];
  for (const fixture of [
    { id: "default", a: defaultA, b: defaultB, latency: 1 },
    {
      id: "overflow",
      a: [255, 128, 0, 200],
      b: [1, 128, 255, 100],
      latency: 1,
    },
    { id: "delayed-memory", a: defaultA, b: defaultB, latency: 3 },
  ]) {
    const initialMemory = lessonMemory(fixture.a, fixture.b);
    const teaching = simulate(program, {
      initialMemory,
      model: "simt",
      blockDim: 4,
      laneWidth: 4,
      numberMode: "uint8",
    });
    fixture.a.forEach((value, i) => {
      if (teaching.finalMemory[128 + i] !== (value + fixture.b[i]) % 256)
        throw new Error(
          "Teaching result disagrees with independent uint8 vector sum.",
        );
    });
    const dataPath = join(scratch, `${fixture.id}.hex`);
    const waveformPath = join(scratch, `${fixture.id}.vcd`);
    await writeFile(
      dataPath,
      Array.from({ length: 256 }, (_, i) =>
        (initialMemory[i] ?? 0).toString(16).padStart(2, "0"),
      ).join("\n") + "\n",
    );
    const log = (
      await run(
        join(scratch, "obj/Vkernel_trace_tb"),
        [
          `+program=${programPath}`,
          `+data=${dataPath}`,
          `+wave=${waveformPath}`,
          `+latency=${fixture.latency}`,
        ],
        30000,
      )
    ).stdout;
    const comparison = compareKernelRun(teaching, parseKernelLog(log), words);
    const wave = await readFile(waveformPath);
    const waveformFile = `${prefix}-${fixture.id}.vcd`;
    const traceFile = `${prefix}-${fixture.id}-teaching.json`;
    const logFile = `${prefix}-${fixture.id}.log`;
    const parsedWave = await VCDParser.parse(wave.toString(), {
      compress: true,
    });
    const corePath = "kernel_trace_tb.dut.cores[0].core_instance.";
    const observedSignals = parsedWave.signal
      .filter((signal) =>
        [
          "core_state[2:0]",
          "lsu_state[0][1:0]",
          "lsu_state[1][1:0]",
          "lsu_state[2][1:0]",
          "lsu_state[3][1:0]",
          "scheduler_instance.unnamedblk1.any_lsu_waiting",
        ].some((name) => signal.name === corePath + name),
      )
      .map(({ name, size, wave }) => ({ name, size, wave }));
    if (observedSignals.length !== 6)
      throw new Error("Missing diagnostic HDL waveform signals.");
    const teachingBytes = JSON.stringify(teaching, null, 2) + "\n";
    await writeFile(join(out, waveformFile), wave);
    await writeFile(join(out, traceFile), teachingBytes);
    await writeFile(join(out, logFile), log);
    cases.push({
      ...fixture,
      ...comparison,
      waveformFile,
      waveformHash: hash(wave),
      traceFile,
      traceHash: hash(teachingBytes),
      logFile,
      logHash: hash(log),
      observedSignals,
    });
    console.log(
      `${fixture.id}: ${comparison.status}; ${comparison.commits.length}/${comparison.expectedCommitCount} commits; ${comparison.transactions.length}/${comparison.expectedTransactionCount} memory transactions; ${comparison.termination}`,
    );
  }
  const report = {
    format: "tinygpu-kernel-1",
    generatedAt: new Date().toISOString(),
    tool,
    variant: schedulerReset
      ? "scheduler-reset-experiment"
      : "compatibility-baseline",
    status: cases.every((item) => item.status === "passed")
      ? "passed"
      : "failed",
    scope: `A temporary compatibility copy of the preserved GPU attempts one four-thread vector-add block through dispatcher, program/data controllers, cores, registers, ALUs and LSUs. ${sourceChanges.length} explicit source adaptations remove trailing commas and express unpacked-array resets as all-zero assignment patterns. ${schedulerReset ? "An additional experimental behavioral change resets the scheduler wait accumulator on every WAIT evaluation." : "No execution-logic fixes are applied."} Original files remain unchanged. External testbench memory uses a configurable response delay.`,
    exclusions: [
      "Divergent branches",
      "other kernels",
      "multiple blocks",
      "real-device timing",
      "four-state X/Z equivalence",
    ],
    configuration: {
      cores: 2,
      threadsPerBlock: 4,
      threads: 4,
      dataChannels: 2,
      programChannels: 1,
      clockPeriodNs: 10,
    },
    sourceHashes,
    compiledSourceHashes,
    sourceChanges,
    executionChanges,
    originalCompilation: {
      status: originalCheck.status === 0 ? "passed" : "failed",
      logFile: "kernel-original-compile.log",
      logHash: hash(originalLog),
    },
    testbenchHash,
    program: { source: program.source, words },
    cases,
    compilerWarnings: compile.stderr,
  };
  await writeFile(
    join(out, `${prefix}-validation.json`),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(`${tool}\nKernel comparison: ${report.status}`);
  if (report.status !== "passed") process.exitCode = 1;
  finished = true;
} finally {
  if (finished) await rm(scratch, { recursive: true, force: true });
  else console.error(`Kernel diagnostics retained: ${resolve(scratch)}`);
}
