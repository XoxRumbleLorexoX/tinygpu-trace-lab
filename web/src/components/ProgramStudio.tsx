import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Code2,
  Download,
  GitFork,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  StepBack,
  StepForward,
  Upload,
} from "lucide-react";
import {
  defaultA,
  defaultB,
  executionModels,
  expectedOutput,
  lessonMemory,
  lessonProgram,
  lessons,
  stateAt,
  validateExperiment,
  type ExecutionModel,
  type ExecutionResult,
  type ExperimentReport,
  type LessonId,
  type ProgramExperiment,
} from "@tinygpu-trace-lab/simulator";
import { GraphLab } from "./GraphLab";
import { LabArchitecture, type Inspection } from "./LabArchitecture";
import { TraceArchitecture, type ArchitectureLevel } from "./TraceArchitecture";
import "../styles/studio.css";

type Draft = Omit<ProgramExperiment, "initialMemory" | "expectedMemory"> & {
  initialMemory: string;
  expectedMemory: string;
};

function preset(id: LessonId): ProgramExperiment {
  return {
    format: "tinygpu-program-1",
    modelVersion: "teaching-1",
    name: lessons.find((lesson) => lesson.id === id)!.title,
    source: lessonProgram(id),
    initialMemory: lessonMemory(defaultA, defaultB),
    expectedMemory: Object.fromEntries(
      expectedOutput(id, defaultA, defaultB).map((value, i) => [
        128 + i,
        value,
      ]),
    ),
    blockDim: ["reduction", "prefix-sum"].includes(id) ? 1 : 4,
    blockCount: 1,
    laneWidth: 4,
    numberMode: "integer",
  };
}

function draftOf(document: ProgramExperiment): Draft {
  return {
    ...document,
    initialMemory: JSON.stringify(document.initialMemory, null, 2),
    expectedMemory: JSON.stringify(document.expectedMemory, null, 2),
  };
}

function documentOf(draft: Draft): ProgramExperiment {
  let initialMemory: unknown, expectedMemory: unknown;
  try {
    initialMemory = JSON.parse(draft.initialMemory);
  } catch {
    throw new Error("Initial memory must be valid JSON.");
  }
  try {
    expectedMemory = JSON.parse(draft.expectedMemory);
  } catch {
    throw new Error("Expected memory must be valid JSON.");
  }
  return validateExperiment({ ...draft, initialMemory, expectedMemory });
}

export function ProgramStudio({ active }: { active: boolean }) {
  const [draft, setDraft] = useState(() => draftOf(preset("vector-add")));
  const [report, setReport] = useState<ExperimentReport | null>(null);
  const [reportKey, setReportKey] = useState("");
  const [selectedModel, setSelectedModel] = useState<ExecutionModel>("simt");
  const [view, setView] = useState<"execution" | "graph">("execution");
  const [architectureLevel, setArchitectureLevel] =
    useState<ArchitectureLevel>("GPU Overview");
  const [eventIndex, setEventIndex] = useState(0);
  const [outputAddress, setOutputAddress] = useState(128);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState<LessonId>("vector-add");
  const [editorOpen, setEditorOpen] = useState(
    () => !matchMedia("(max-width: 760px)").matches,
  );
  const worker = useRef<Worker | null>(null);
  const timeout = useRef<number>();
  const source = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const replayRef = useRef<HTMLElement>(null);
  const sourceFocusPending = useRef(false);
  const dirty = reportKey !== "" && JSON.stringify(draft) !== reportKey;
  const run = report?.runs.find((run) => run.model === selectedModel);
  const result = run?.result;

  useEffect(() => {
    if (view !== "execution" || !sourceFocusPending.current) return;
    sourceFocusPending.current = false;
    replayRef.current?.focus();
  }, [view]);

  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timeout.current);
    setBusy(false);
  }

  function launch(document: ProgramExperiment, snapshot: Draft) {
    cancel();
    setError("");
    setBusy(true);
    if (matchMedia("(max-width: 760px)").matches) setEditorOpen(false);
    try {
      const instance = new Worker(
        new URL("../workers/experiment.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = instance;
      const fail = (message: string) => {
        if (worker.current !== instance) return;
        cancel();
        setError(message);
      };
      instance.onmessage = (
        event: MessageEvent<{ report?: ExperimentReport; error?: string }>,
      ) => {
        if (worker.current !== instance) return;
        cancel();
        if (!event.data.report) {
          setError(event.data.error ?? "Experiment failed.");
          return;
        }
        setReport(event.data.report);
        setReportKey(JSON.stringify(snapshot));
        setEventIndex(0);
        setView("execution");
      };
      instance.onerror = () =>
        fail("Experiment worker failed. Previous results remain unchanged.");
      timeout.current = window.setTimeout(
        () =>
          fail(
            "Experiment exceeded 15 seconds. Reduce the program or thread count.",
          ),
        15000,
      );
      instance.postMessage(document);
    } catch (error) {
      cancel();
      setError(
        error instanceof Error
          ? error.message
          : "Cannot start the experiment worker.",
      );
    }
  }

  useEffect(() => {
    const initial = preset("vector-add");
    launch(initial, draftOf(initial));
    return () => {
      worker.current?.terminate();
      worker.current = null;
      clearTimeout(timeout.current);
    };
  }, []);

  function execute() {
    try {
      launch(documentOf(draft), draft);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid experiment.");
    }
  }

  function loadTemplate() {
    if (
      dirty &&
      !window.confirm(
        "Replace the edited program and memory with the selected example?",
      )
    )
      return;
    const document = preset(template),
      next = draftOf(document);
    setDraft(next);
    launch(document, next);
  }

  function exportExperiment() {
    try {
      const document = documentOf(draft);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], {
          type: "application/json",
        }),
      );
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "tinygpu-program.json";
      link.click();
      URL.revokeObjectURL(url);
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid experiment.");
    }
  }

  async function importExperiment(input?: File) {
    if (!input) return;
    try {
      if (input.size > 65536) throw new Error("Experiment file exceeds 64 KB.");
      const document = validateExperiment(JSON.parse(await input.text()));
      if (
        dirty &&
        !window.confirm(
          "Replace the edited program and memory with this imported experiment?",
        )
      )
        return;
      const next = draftOf(document);
      setDraft(next);
      launch(document, next);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Invalid experiment file.",
      );
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  function focusLine(line: number) {
    if (dirty || !source.current) return;
    const lines = draft.source.split("\n");
    const start = lines
      .slice(0, line - 1)
      .reduce((size, text) => size + text.length + 1, 0);
    setEditorOpen(true);
    requestAnimationFrame(() => {
      const editor = source.current;
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
      const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight);
      editor.scrollTop = Math.max(0, (line - 3) * lineHeight);
      editor.scrollIntoView({ block: "center" });
    });
  }

  const addresses = useMemo(
    () =>
      result
        ? [
            ...new Set([
              ...Object.keys(report!.document.expectedMemory).map(Number),
              ...result.trace.flatMap((event) =>
                event.memoryAccess === "write"
                  ? event.memoryDiff.map((diff) => diff.address)
                  : [],
              ),
            ]),
          ].sort((a, b) => a - b)
        : [],
    [report, result],
  );

  return (
    <main className="program-studio">
      <header className="studio-heading">
        <div>
          <span className="eyebrow">COMPUTATION EXTRACTION</span>
          <h1>Program studio</h1>
        </div>
        <div className="studio-actions">
          <button
            className="icon-button"
            title="Export program experiment"
            aria-label="Export program experiment"
            onClick={exportExperiment}
            disabled={busy}
          >
            <Download size={18} />
          </button>
          <button
            className="icon-button"
            title="Import program experiment"
            aria-label="Import program experiment"
            onClick={() => file.current?.click()}
            disabled={busy}
          >
            <Upload size={18} />
          </button>
          <input
            hidden
            ref={file}
            type="file"
            accept=".json,application/json"
            aria-label="Program experiment file"
            onChange={(event) =>
              void importExperiment(event.currentTarget.files?.[0])
            }
          />
          {busy ? (
            <button onClick={cancel}>
              <Square size={16} />
              Cancel
            </button>
          ) : (
            <button className="studio-run" onClick={execute}>
              <Play size={16} />
              Run experiment
            </button>
          )}
        </div>
      </header>
      {error && (
        <p className="lab-error" role="alert">
          {error}
        </p>
      )}
      {dirty && (
        <p className="studio-warning" role="status">
          Draft changed. Displayed results belong to the last run.
        </p>
      )}
      <div
        className={`studio-workspace ${editorOpen ? "" : "studio-source-closed"}`}
      >
        <details
          className="studio-editor-disclosure"
          open={editorOpen}
          onToggle={(event) => setEditorOpen(event.currentTarget.open)}
        >
          <summary>Source and inputs</summary>
          <fieldset className="studio-editor" disabled={busy}>
            <legend>Experiment source</legend>
            <div className="studio-template">
              <label>
                Example
                <select
                  aria-label="Program example"
                  value={template}
                  onChange={(event) =>
                    setTemplate(event.currentTarget.value as LessonId)
                  }
                >
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button"
                title="Load selected example"
                aria-label="Load selected example"
                onClick={loadTemplate}
              >
                <RotateCcw size={17} />
              </button>
            </div>
            <label>
              Name
              <input
                aria-label="Experiment name"
                maxLength={80}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.currentTarget.value })
                }
              />
            </label>
            <label>
              Assembly source
              <textarea
                ref={source}
                aria-label="Assembly source"
                spellCheck={false}
                autoCapitalize="off"
                maxLength={16384}
                className="studio-source"
                value={draft.source}
                onChange={(event) =>
                  setDraft({ ...draft, source: event.currentTarget.value })
                }
              />
            </label>
            <div className="studio-config">
              <label>
                Threads / block
                <input
                  aria-label="Program threads per block"
                  type="number"
                  min={1}
                  max={16}
                  value={draft.blockDim}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      blockDim: Number(event.currentTarget.value),
                    })
                  }
                />
              </label>
              <label>
                Blocks
                <input
                  aria-label="Program blocks"
                  type="number"
                  min={1}
                  max={8}
                  value={draft.blockCount}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      blockCount: Number(event.currentTarget.value),
                    })
                  }
                />
              </label>
              <label>
                Lane width
                <input
                  aria-label="Program lane width"
                  type="number"
                  min={1}
                  max={16}
                  value={draft.laneWidth}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      laneWidth: Number(event.currentTarget.value),
                    })
                  }
                />
              </label>
              <label>
                Numbers
                <select
                  aria-label="Program number mode"
                  value={draft.numberMode}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      numberMode: event.currentTarget
                        .value as ProgramExperiment["numberMode"],
                    })
                  }
                >
                  <option value="integer">Safe integers</option>
                  <option value="uint8">Unsigned 8-bit</option>
                </select>
              </label>
            </div>
            <div className="studio-memory-editors">
              <label>
                Initial memory
                <textarea
                  aria-label="Program initial memory"
                  spellCheck={false}
                  maxLength={8192}
                  value={draft.initialMemory}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      initialMemory: event.currentTarget.value,
                    })
                  }
                />
              </label>
              <label>
                Expected memory
                <textarea
                  aria-label="Program expected memory"
                  spellCheck={false}
                  maxLength={8192}
                  value={draft.expectedMemory}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      expectedMemory: event.currentTarget.value,
                    })
                  }
                />
              </label>
            </div>
            <details className="studio-semantics">
              <summary>Assembly semantics and limits</summary>
              <p>
                R0-R12 start at zero. %threadIdx is local to a block; global
                index = %blockIdx x %blockDim + %threadIdx. Missing memory reads
                as zero.
              </p>
              <p>
                ADD, SUB, MUL, DIV, CMP, BRnzp, LDR, STR, CONST, RET. Semicolons
                start comments; labels name branch targets. Division truncates
                toward zero. uint8 arithmetic wraps modulo 256.
              </p>
              <p>
                Maximum 128 instructions, 16 total threads, 64 initial memory
                cells, 2,500 events per model. Expected memory contains value
                assertions; an empty object means no expected-value checks.
              </p>
              <p>
                These are logical instruction schedules, not GPU clocks. No
                synchronization primitive or cache model. Shared-memory programs
                can depend on execution order.
              </p>
            </details>
          </fieldset>
        </details>
        <section
          className="studio-results"
          aria-busy={busy}
          aria-label="Program results"
        >
          <header className="studio-result-heading">
            <h2>
              {report
                ? `Last run: ${report.document.name}`
                : "Experiment results"}
            </h2>
            <span role="status">
              {busy ? "Running three execution models..." : "Local execution"}
            </span>
          </header>
          {report && (
            <>
              <div className="studio-models">
                {report.runs.map((item) => (
                  <button
                    key={item.model}
                    className={selectedModel === item.model ? "selected" : ""}
                    aria-pressed={selectedModel === item.model}
                    aria-label={`Inspect ${executionModels[item.model].name} program run`}
                    onClick={() => {
                      setSelectedModel(item.model);
                      setEventIndex(0);
                      setView("execution");
                    }}
                  >
                    <strong>{executionModels[item.model].name}</strong>
                    <span>
                      {item.result
                        ? `${item.result.statistics.issues} issues / ${item.result.statistics.laneOperations} operations`
                        : "Execution unavailable"}
                    </span>
                    <small>
                      {item.result?.status === "limit"
                        ? "Event limit reached"
                        : !item.result
                          ? "Unsupported / runtime error"
                          : !item.checks.length
                            ? "No expected-value checks"
                            : `${item.checks.filter((check) => check.matches).length}/${item.checks.length} expectations match`}
                    </small>
                  </button>
                ))}
              </div>
              <p className="studio-model-description">
                {executionModels[selectedModel].description}
              </p>
              {run?.error && (
                <p className="lab-error" role="alert">
                  {run.error}
                </p>
              )}
              {run?.agreesWithSequential === false && (
                <p className="studio-warning">
                  Final memory, registers, or flags differ from Sequential.
                  Shared-memory ordering can change results.
                </p>
              )}
              {result?.status === "limit" && (
                <p className="studio-warning">
                  Event limit reached before every thread returned. Partial
                  replay only; expectations and graph extraction remain
                  unverified.
                </p>
              )}
              {run?.graphError && (
                <p className="lab-error" role="alert">
                  Graph verification failed: {run.graphError}
                </p>
              )}
              {result && (
                <>
                  <div className="studio-output-scroll">
                    <table className="studio-outputs">
                      <caption>
                        Memory outputs
                        {result.status === "limit" ? " / partial" : " / final"}
                      </caption>
                      <thead>
                        <tr>
                          <th>Address</th>
                          <th>Observed</th>
                          <th>Expected</th>
                          <th>Check</th>
                        </tr>
                      </thead>
                      <tbody>
                        {addresses.map((address) => {
                          const check = run!.checks.find(
                            (check) => check.address === address,
                          );
                          const written = result.trace.some(
                            (event) =>
                              event.memoryAccess === "write" &&
                              event.memoryDiff.some(
                                (diff) => diff.address === address,
                              ),
                          );
                          return (
                            <tr key={address}>
                              <td>
                                <button
                                  title={`Trace memory[${address}] dependencies`}
                                  aria-label={`Trace program output ${address}`}
                                  disabled={!run?.graphVerified || !written}
                                  onClick={() => {
                                    setOutputAddress(address);
                                    setView("graph");
                                  }}
                                >
                                  <GitFork size={14} />
                                  {address}
                                </button>
                              </td>
                              <td>{result.finalMemory[address] ?? 0}</td>
                              <td>
                                {report.document.expectedMemory[address] ??
                                  "--"}
                              </td>
                              <td
                                className={
                                  check
                                    ? check.matches
                                      ? "studio-pass"
                                      : "studio-fail"
                                    : ""
                                }
                              >
                                {result.status === "limit"
                                  ? "Unverified"
                                  : check
                                    ? check.matches
                                      ? "Match"
                                      : "Mismatch"
                                    : "Not asserted"}
                                {!written ? " / not written" : ""}
                              </td>
                            </tr>
                          );
                        })}
                        {!addresses.length && (
                          <tr>
                            <td colSpan={4}>
                              No memory writes or output assertions.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="studio-review-tabs segmented">
                    <button
                      className={view === "execution" ? "active" : ""}
                      aria-pressed={view === "execution"}
                      onClick={() => setView("execution")}
                    >
                      <Code2 size={16} />
                      Execution replay
                    </button>
                    <button
                      className={view === "graph" ? "active" : ""}
                      aria-pressed={view === "graph"}
                      disabled={!run?.graphVerified}
                      onClick={() => setView("graph")}
                    >
                      <GitFork size={16} />
                      Extracted graph
                    </button>
                  </div>
                  {view === "graph" && run?.graphVerified ? (
                    <GraphLab
                      key={`${reportKey}-${selectedModel}-${outputAddress}`}
                      result={result}
                      outputAddress={outputAddress}
                      onSource={(index) => {
                        sourceFocusPending.current = true;
                        setEventIndex(index);
                        setView("execution");
                      }}
                    />
                  ) : (
                    <ProgramReplay
                      key={`${reportKey}-${selectedModel}`}
                      result={result}
                      eventIndex={eventIndex}
                      setEventIndex={setEventIndex}
                      active={active && !busy}
                      focusLine={dirty ? undefined : focusLine}
                      replayRef={replayRef}
                      architectureLevel={architectureLevel}
                      setArchitectureLevel={setArchitectureLevel}
                    />
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ProgramReplay({
  result,
  eventIndex,
  setEventIndex,
  active,
  focusLine,
  replayRef,
  architectureLevel,
  setArchitectureLevel,
}: {
  result: ExecutionResult;
  eventIndex: number;
  setEventIndex: (index: number) => void;
  active: boolean;
  focusLine?: (line: number) => void;
  replayRef: RefObject<HTMLElement>;
  architectureLevel: ArchitectureLevel;
  setArchitectureLevel: (level: ArchitectureLevel) => void;
}) {
  const descriptionId = useId();
  const [playing, setPlaying] = useState(false);
  const [inspection, setInspection] = useState<Inspection>("registers");
  const index = Math.min(eventIndex, result.trace.length - 1);
  const event = result.trace[index];
  const snapshot = useMemo(() => stateAt(result, index), [result, index]);
  const thread = snapshot.threads[event.threadId];
  const instruction = result.program.instructions[event.pc];
  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);
  useEffect(() => {
    if (!playing || !active) return;
    const timer = window.setTimeout(() => {
      if (index >= result.trace.length - 1) setPlaying(false);
      else setEventIndex(index + 1);
    }, 150);
    return () => clearTimeout(timer);
  }, [playing, active, index, result, setEventIndex]);
  function seek(next: number) {
    setPlaying(false);
    setEventIndex(Math.max(0, Math.min(result.trace.length - 1, next)));
  }
  return (
    <section
      className="studio-replay"
      ref={replayRef}
      tabIndex={-1}
      aria-label="Program execution replay"
      aria-describedby={descriptionId}
    >
      <div className="studio-replay-controls">
        <button
          className="icon-button"
          title="First program event"
          aria-label="First program event"
          disabled={index === 0}
          onClick={() => seek(0)}
        >
          <SkipBack size={17} />
        </button>
        <button
          className="icon-button"
          title="Previous program event"
          aria-label="Previous program event"
          disabled={index === 0}
          onClick={() => seek(index - 1)}
        >
          <StepBack size={17} />
        </button>
        <button
          className="icon-button"
          title={playing ? "Pause program" : "Play program"}
          aria-label={playing ? "Pause program" : "Play program"}
          onClick={() => {
            if (index === result.trace.length - 1) setEventIndex(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          className="icon-button"
          title="Next program event"
          aria-label="Next program event"
          disabled={index === result.trace.length - 1}
          onClick={() => seek(index + 1)}
        >
          <StepForward size={17} />
        </button>
        <button
          className="icon-button"
          title="Final program event"
          aria-label="Final program event"
          disabled={index === result.trace.length - 1}
          onClick={() => seek(result.trace.length - 1)}
        >
          <SkipForward size={17} />
        </button>
        <span>
          Event {index + 1}/{result.trace.length}
        </span>
        <input
          aria-label="Program trace position"
          type="range"
          min={0}
          max={result.trace.length - 1}
          value={index}
          onChange={(event) => seek(Number(event.currentTarget.value))}
        />
      </div>
      <div className="studio-event" id={descriptionId}>
        <span>
          {event.stage} / Thread {event.threadId} / PC {event.pc}
        </span>
        <strong>{event.instruction}</strong>
        <p>{event.explanatoryText}</p>
        <button
          className="source-link"
          disabled={!focusLine}
          onClick={() => focusLine?.(instruction.lineNumber ?? event.pc + 1)}
        >
          <Code2 size={15} />
          Source line {instruction.lineNumber ?? event.pc + 1}
        </button>
      </div>
      <TraceArchitecture
        result={result}
        index={index}
        level={architectureLevel}
        onLevel={(level) => {
          setPlaying(false);
          setArchitectureLevel(level);
        }}
        onSeek={seek}
      >
        <LabArchitecture
          event={event}
          spatial={false}
          reducedMotion={matchMedia("(prefers-reduced-motion: reduce)").matches}
          inspect={setInspection}
        />
      </TraceArchitecture>
      <div className="studio-state-tabs segmented">
        {(["program", "registers", "memory", "arithmetic"] as const).map(
          (item) => (
            <button
              key={item}
              className={inspection === item ? "active" : ""}
              aria-pressed={inspection === item}
              onClick={() => setInspection(item)}
            >
              {item === "arithmetic"
                ? "Operands"
                : item[0].toUpperCase() + item.slice(1)}
            </button>
          ),
        )}
      </div>
      {inspection === "program" ? (
        <div className="studio-instructions">
          {result.program.instructions.map((instruction, pc) => (
            <button
              key={pc}
              aria-label={`Inspect program source line ${instruction.lineNumber}`}
              className={event.pc === pc ? "selected" : ""}
              onClick={() => {
                const next =
                  result.trace.find(
                    (item) =>
                      item.pc === pc &&
                      item.threadId === event.threadId &&
                      item.cycle > index,
                  ) ??
                  result.trace.find(
                    (item) =>
                      item.pc === pc && item.threadId === event.threadId,
                  );
                if (next) seek(next.cycle);
              }}
              disabled={
                !result.trace.some(
                  (item) => item.pc === pc && item.threadId === event.threadId,
                )
              }
            >
              <span>{instruction.lineNumber}</span>
              <code>{instruction.source}</code>
            </button>
          ))}
        </div>
      ) : inspection === "arithmetic" ? (
        <div className="studio-state-values">
          {event.operands.map((operand, i) => (
            <div key={i}>
              <span>{operand.name}</span>
              <strong>{operand.value}</strong>
              <small>{operand.kind}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="studio-state-values">
          {Object.entries(
            inspection === "memory" ? snapshot.memory : thread.registers,
          ).map(([key, value]) => (
            <div key={key}>
              <span>{inspection === "memory" ? `memory[${key}]` : key}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
