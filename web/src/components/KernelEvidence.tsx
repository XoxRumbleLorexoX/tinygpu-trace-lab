import { useEffect, useState } from "react";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";

interface Commit {
  time: number;
  core: number;
  threadId: number;
  pc: number;
  register: string;
  before: number;
  actual: number;
  expected: number | null;
  eventIndex: number | null;
  instruction: string | null;
  match: boolean;
}
interface Transaction {
  time: number;
  channel: number;
  kind: "read" | "write";
  address: number;
  actual: number;
  expected: number | null;
  eventIndex: number | null;
  threadId: number | null;
  pc: number | null;
  instruction: string | null;
  match: boolean;
}
interface KernelCase {
  id: string;
  a: number[];
  b: number[];
  latency: number;
  status: "passed" | "failed";
  termination: "DONE" | "TIMEOUT";
  cycles: number;
  time: number;
  expectedCommitCount: number;
  expectedTransactionCount: number;
  commits: Commit[];
  transactions: Transaction[];
  states: { time: number; core: number; state: number; pc: number }[];
  fetches: { time: number; pc: number; word: number }[];
  outputs: {
    address: number;
    actual: number | null;
    expected: number;
    match: boolean;
  }[];
  differences: string[];
  waveformFile: string;
  traceFile: string;
  logFile: string;
  observedSignals: { name: string; size: number; wave: [string, string][] }[];
}
interface KernelReport {
  format: string;
  generatedAt: string;
  tool: string;
  scope: string;
  exclusions: string[];
  sourceHashes: Record<string, string>;
  compiledSourceHashes: Record<string, string>;
  sourceChanges: {
    path: string;
    line: number;
    before: string;
    after: string;
    reason: string;
  }[];
  originalCompilation: { status: string; logFile: string };
  executionChanges: {
    path: string;
    line: number;
    before: string;
    after: string;
    reason: string;
  }[];
  configuration: {
    clockPeriodNs: number;
    cores: number;
    threads: number;
    dataChannels: number;
  };
  program: { source: string; words: number[] };
  cases: KernelCase[];
}

const states = [
  "Idle",
  "Fetch",
  "Decode",
  "Request",
  "Wait",
  "Execute",
  "Update",
  "Done",
];
const reasons = [
  "The core has not started its block.",
  "The fetcher retrieves the instruction word through the program-memory controller.",
  "The decoder selects registers, the arithmetic operation and memory controls.",
  "Each active load/store unit may request a memory transfer.",
  "The scheduler waits until every load/store unit has finished its request.",
  "The arithmetic units compute values; the program counters compute the next address.",
  "Registers commit their selected values. RET ends the block; otherwise the PC advances.",
  "The core has finished its block. The dispatcher still controls whole-GPU completion.",
];
const labels: Record<string, string> = {
  default: "Default inputs",
  overflow: "8-bit overflow",
  "delayed-memory": "Delayed memory",
};

export function KernelEvidence() {
  const [variant, setVariant] = useState("kernel");
  return (
    <div className="kernel-laboratory">
      <label className="kernel-variant">
        HDL source{" "}
        <select
          aria-label="Kernel source variant"
          value={variant}
          onChange={(event) => setVariant(event.currentTarget.value)}
        >
          <option value="kernel">Compatibility baseline</option>
          <option value="kernel-scheduler-reset">
            Experimental scheduler reset
          </option>
        </select>
      </label>
      <KernelRun key={variant} variant={variant} />
    </div>
  );
}

function KernelRun({ variant }: { variant: string }) {
  const [report, setReport] = useState<KernelReport | null>(null);
  const [error, setError] = useState("");
  const [fixture, setFixture] = useState(0);
  const [time, setTime] = useState(0);
  const [pc, setPc] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}${variant}-validation.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error("Full-kernel evidence is not available.");
        return response.json();
      })
      .then((data: KernelReport) => {
        if (data.format !== "tinygpu-kernel-1" || !data.cases?.length)
          throw new Error("Invalid kernel evidence report.");
        setReport(data);
      })
      .catch((failure) => {
        if (failure.name !== "AbortError") setError(failure.message);
      });
    return () => controller.abort();
  }, [variant]);
  const run = report?.cases[fixture];
  if (!report || !run)
    return (
      <section className="kernel-evidence hardware-evidence">
        <h2>Full GPU / vector addition</h2>
        <p role="status">{error || "Loading kernel evidence..."}</p>
      </section>
    );
  const state = run.states
    .filter((sample) => sample.core === 0 && sample.time <= time)
    .at(-1);
  const observedValue = (suffix: string) => {
    const signal = run.observedSignals.find((item) =>
      item.name.endsWith(suffix),
    );
    const bits = signal?.wave
      .filter(([sampleTime]) => Number(sampleTime) <= time)
      .at(-1)?.[1];
    return bits && /^[01]+$/.test(bits) ? parseInt(bits, 2) : null;
  };
  const waiting = observedValue(".any_lsu_waiting");
  const lsuStates = [0, 1, 2, 3].map((lane) =>
    observedValue(`.lsu_state[${lane}][1:0]`),
  );
  const source =
    run.commits.find((sample) => sample.pc === pc)?.instruction ??
    run.transactions.find((sample) => sample.pc === pc)?.instruction ??
    (pc === report.program.words.length - 1 ? "RET" : "No mapped operation");
  const selectSample = (sample: { time: number; pc: number | null }) => {
    setTime(sample.time);
    if (sample.pc !== null) setPc(sample.pc);
  };
  return (
    <section
      className="kernel-evidence hardware-evidence"
      aria-label="Full GPU evidence"
    >
      <div className="graph-toolbar">
        <div>
          <h2>Full GPU / vector addition</h2>
          <p>
            Compatibility copy, one four-thread block, two external data
            channels.
          </p>
        </div>
        <label>
          Fixture{" "}
          <select
            aria-label="Kernel evidence fixture"
            value={fixture}
            onChange={(event) => {
              setFixture(Number(event.currentTarget.value));
              setTime(0);
              setPc(0);
            }}
          >
            {report.cases.map((item, index) => (
              <option key={item.id} value={index}>
                {labels[item.id] ?? item.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="kernel-compatibility">
        Original-source compilation: {report.originalCompilation.status}.{" "}
        {report.sourceChanges.length} explicit compatibility edits in temporary
        copies. Preserved files unchanged.
        {report.executionChanges.length
          ? " Experimental behavioral change: clear the wait accumulator on each WAIT evaluation. This is not the preserved GPU's behavior."
          : " No execution-logic fixes applied."}
      </p>
      <div className="evidence-heading">
        <strong
          className={run.status === "passed" ? "verified" : "kernel-failed"}
          role="status"
        >
          {run.status === "passed" ? (
            <CheckCircle2 size={18} />
          ) : (
            <TriangleAlert size={18} />
          )}
          {run.status === "passed"
            ? "Complete observed agreement"
            : "Hardware disagreement"}
        </strong>
        <span>
          {run.cycles} clock periods after launch / {run.termination}
        </span>
        <span>Memory response delay: {run.latency} clock periods</span>
      </div>
      <div className="kernel-coverage" aria-label="Observed kernel coverage">
        <span>
          <b>
            {run.commits.length} / {run.expectedCommitCount}
          </b>{" "}
          register commits
        </span>
        <span>
          <b>
            {run.transactions.length} / {run.expectedTransactionCount}
          </b>{" "}
          memory transfers
        </span>
        <span>
          <b>
            {run.fetches.length} / {report.program.words.length}
          </b>{" "}
          instruction fetches
        </span>
        <span>
          <b>{run.outputs.filter((output) => output.match).length} / 4</b>{" "}
          correct outputs
        </span>
      </div>
      <div className="kernel-outputs" aria-label="Kernel output comparison">
        {run.outputs.map((output, thread) => (
          <div
            key={output.address}
            className={output.match ? "output-match" : "output-mismatch"}
          >
            <span>
              T{thread} / C[{thread}]
            </span>
            <strong>
              {run.a[thread]} + {run.b[thread]}
            </strong>
            <span>
              Expected <b>{output.expected}</b>
            </span>
            <span>
              HDL <b>{output.actual ?? "missing"}</b>
            </span>
            <small>
              {output.match ? "MATCH" : "MISMATCH"} / address {output.address}
            </small>
          </div>
        ))}
      </div>
      <div className="kernel-inspector">
        <div className="kernel-source">
          <label>
            Instruction{" "}
            <select
              aria-label="Kernel instruction"
              value={pc}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                setPc(next);
                setTime(
                  run.states.find(
                    (sample) => sample.core === 0 && sample.pc === next,
                  )?.time ?? 0,
                );
              }}
            >
              {report.program.words.map((word, index) => (
                <option key={index} value={index}>
                  PC {index} / 0x{word.toString(16).padStart(4, "0")}
                </option>
              ))}
            </select>
          </label>
          <code>{source}</code>
        </div>
        <div className="kernel-stages" aria-label="Observed kernel pipeline">
          {states.map((name, index) => {
            const sample = run.states.find(
              (item) =>
                item.core === 0 && item.pc === pc && item.state === index,
            );
            return (
              <button
                key={name}
                disabled={!sample}
                aria-pressed={state?.pc === pc && state?.state === index}
                onClick={() => sample && setTime(sample.time)}
                title={
                  sample
                    ? `${name} at ${sample.time} ns`
                    : `${name} not observed at PC ${pc}`
                }
              >
                <span>{name}</span>
                <small>{sample ? `${sample.time} ns` : "not observed"}</small>
              </button>
            );
          })}
        </div>
        <p className="kernel-state-detail">
          {state
            ? `Last state sample / Core 0 / PC ${state.pc} / ${states[state.state]}: ${reasons[state.state]}`
            : "No recorded core state at this time."}
        </p>
        <label className="kernel-time">
          HDL time: {time} ns
          <input
            aria-label="Kernel hardware time"
            type="range"
            min={0}
            max={run.time}
            value={time}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              setTime(next);
              const selected = run.states
                .filter((sample) => sample.core === 0 && sample.time <= next)
                .at(-1);
              if (selected) setPc(selected.pc);
            }}
          />
        </label>
        <div className="kernel-signals" aria-label="Observed scheduler signals">
          <div>
            <span>Wait accumulator</span>
            <strong>{waiting ?? "unknown"}</strong>
          </div>
          {lsuStates.map((value, lane) => (
            <div key={lane}>
              <span>LSU {lane}</span>
              <strong>
                {value === null
                  ? "unknown"
                  : ["Idle", "Requesting", "Waiting", "Done"][value]}
              </strong>
            </div>
          ))}
        </div>
        {waiting === 1 && lsuStates.every((value) => value === 3) && (
          <p className="kernel-stall-reason">
            Every LSU is Done, but the wait accumulator remains 1. The scheduler
            cannot leave WAIT.
          </p>
        )}
      </div>
      <details open className="kernel-records">
        <summary>Register commits / PC {pc}</summary>
        <div key={run.id} className="hardware-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lane</th>
                <th>Register</th>
                <th>Before</th>
                <th>Expected</th>
                <th>HDL</th>
                <th>Source link</th>
              </tr>
            </thead>
            <tbody>
              {run.commits
                .filter((sample) => sample.pc === pc)
                .sort((left, right) => left.threadId - right.threadId)
                .map((sample, index) => (
                  <tr
                    key={index}
                    className={sample.time === time ? "selected-sample" : ""}
                  >
                    <td>T{sample.threadId}</td>
                    <td>{sample.register}</td>
                    <td>{sample.before}</td>
                    <td>{sample.expected ?? "unmapped"}</td>
                    <td>
                      {sample.actual} / {sample.match ? "match" : "mismatch"}
                    </td>
                    <td>
                      <button
                        onClick={() => selectSample(sample)}
                        aria-label={`Inspect kernel commit T${sample.threadId} PC ${pc}`}
                      >
                        {sample.time} ns / event{" "}
                        {sample.eventIndex ?? "unmapped"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!run.commits.some((sample) => sample.pc === pc) && (
          <p>No register commit recorded for this instruction.</p>
        )}
      </details>
      <details open className="kernel-records">
        <summary>Memory transfers</summary>
        <div key={run.id} className="hardware-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Channel</th>
                <th>Address</th>
                <th>Expected</th>
                <th>HDL</th>
                <th>Source link</th>
              </tr>
            </thead>
            <tbody>
              {run.transactions.map((sample, index) => (
                <tr
                  key={index}
                  className={sample.time === time ? "selected-sample" : ""}
                >
                  <td>{sample.kind.toUpperCase()}</td>
                  <td>{sample.channel}</td>
                  <td>{sample.address}</td>
                  <td>{sample.expected ?? "unmapped"}</td>
                  <td>
                    {sample.actual} / {sample.match ? "match" : "mismatch"}
                  </td>
                  <td>
                    <button
                      onClick={() => selectSample(sample)}
                      aria-label={`Inspect kernel transfer ${index + 1}`}
                      title={sample.instruction ?? "No source mapping"}
                    >
                      {sample.time} ns / T{sample.threadId ?? "?"} / event{" "}
                      {sample.eventIndex ?? "unmapped"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {!!run.differences.length && (
        <details open className="kernel-differences">
          <summary>{run.differences.length} recorded disagreements</summary>
          <ul>
            {run.differences.map((difference, index) => (
              <li key={index}>{difference}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="evidence-heading">
        {[
          [`${variant}-validation.json`, "Kernel JSON report"],
          [run.waveformFile, "Kernel VCD"],
          [run.traceFile, "Kernel teaching trace"],
          [run.logFile, "Raw HDL log"],
          [report.originalCompilation.logFile, "Original compile log"],
        ].map(([file, label]) => (
          <a key={file} href={`${import.meta.env.BASE_URL}${file}`} download>
            <Download size={15} />
            {label}
          </a>
        ))}
      </div>
      <details>
        <summary>Source provenance and fidelity</summary>
        <p>{report.scope}</p>
        <p>
          {report.tool} / {report.generatedAt} /{" "}
          {report.configuration.clockPeriodNs} ns clock period
        </p>
        <dl>
          {Object.entries(report.sourceHashes).map(([path, hash]) => (
            <div key={path}>
              <dt>{path}</dt>
              <dd>
                <code>{hash}</code>
              </dd>
              {report.compiledSourceHashes[path] !== hash && (
                <dd>
                  Compiled copy:{" "}
                  <code>{report.compiledSourceHashes[path]}</code>
                </dd>
              )}
            </div>
          ))}
        </dl>
        {[...report.sourceChanges, ...report.executionChanges].map(
          (change, index) => (
            <div key={index} className="kernel-source-change">
              <p>
                {change.path}:{change.line} / {change.reason}
              </p>
              <pre>{`Before:\n${change.before}\nAfter:\n${change.after}`}</pre>
            </div>
          ),
        )}
        <pre>{report.program.source}</pre>
      </details>
      <p className="evidence-limits">
        Stored fixtures only; edits in the lesson do not rerun HDL. Teaching
        event indices are source links, not HDL clock cycles. Not covered:{" "}
        {report.exclusions.join(", ")}.
      </p>
    </section>
  );
}
