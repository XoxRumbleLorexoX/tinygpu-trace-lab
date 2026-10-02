import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Box,
  Braces,
  Check,
  CheckCircle2,
  CircuitBoard,
  Code2,
  Cpu,
  Download,
  FlaskConical,
  GitCompareArrows,
  GitFork,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Upload,
} from "lucide-react";
import {
  checkLesson,
  defaultA,
  defaultB,
  executionModels,
  expectedOutput,
  lessons,
  runLesson,
  stateAt,
  type ExecutionModel,
  type ExecutionResult,
  type LessonId,
} from "@tinygpu-trace-lab/simulator";
import { LabArchitecture, type Inspection } from "./LabArchitecture";
import { GraphLab } from "./GraphLab";
import { HardwareLab } from "./HardwareLab";
import { ProgramStudio } from "./ProgramStudio";
import { TraceArchitecture, type ArchitectureLevel } from "./TraceArchitecture";
import "../styles/lab.css";

type View = "learn" | "compare" | "graph" | "studio" | "hardware" | "explorer";
const stages = ["Fetch", "Decode", "Execute", "Memory", "Writeback"];
const tabs = [
  { id: "learn", label: "Learning lab", icon: BookOpen },
  { id: "compare", label: "Compare", icon: GitCompareArrows },
  { id: "graph", label: "Computation graph", icon: GitFork },
  { id: "studio", label: "Program studio", icon: Code2 },
  { id: "hardware", label: "Hardware", icon: CircuitBoard },
  { id: "explorer", label: "Classic explorer", icon: Layers },
] as const;

export function LearningLab({
  explorer,
}: {
  explorer: (active: boolean) => ReactNode;
}) {
  const [view, setView] = useState<View>("learn");
  const [studioOpened, setStudioOpened] = useState(false);
  const [explorerOpened, setExplorerOpened] = useState(false);
  const [lessonId, setLessonId] = useState<LessonId>("vector-add");
  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(defaultB);
  const [model, setModel] = useState<ExecutionModel>("simt");
  const [laneWidth, setLaneWidth] = useState(4);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [loop, setLoop] = useState(false);
  const [focusedThread, setFocusedThread] = useState(0);
  const [spatial, setSpatial] = useState(false);
  const [architectureLevel, setArchitectureLevel] =
    useState<ArchitectureLevel>("GPU Overview");
  const [inspection, setInspection] = useState<Inspection>("program");
  const [prediction, setPrediction] = useState("");
  const [predictionStatus, setPredictionStatus] = useState<
    "none" | "correct" | "incorrect"
  >("none");
  const [visited, setVisited] = useState<string[]>([]);
  const [completed, setCompleted] = useState<LessonId[]>([]);
  const [fileError, setFileError] = useState("");
  const [outputIndex, setOutputIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceFocusPending = useRef(false);
  const executionRef = useRef<HTMLElement>(null);
  const lesson = lessons.find((item) => item.id === lessonId)!;
  const execution = useMemo(() => {
    try {
      return { result: runLesson(lessonId, a, b, model, laneWidth), error: "" };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Execution failed.",
      };
    }
  }, [lessonId, a, b, model, laneWidth]);
  const result = execution.result;
  const frames = useMemo(
    () =>
      result?.trace.flatMap((event, i, events) =>
        events[i + 1]?.tick !== event.tick ? [i] : [],
      ) ?? [],
    [result],
  );
  const safeFrame = Math.min(frame, Math.max(0, frames.length - 1));
  const eventIndex = frames[safeFrame] ?? 0;
  const snapshot = useMemo(
    () => (result ? stateAt(result, eventIndex) : null),
    [result, eventIndex],
  );
  const event =
    result?.trace
      .slice(Math.max(0, eventIndex - laneWidth + 1), eventIndex + 1)
      .find(
        (item) =>
          item.tick === result.trace[eventIndex].tick &&
          item.threadId === focusedThread,
      ) ?? result?.trace[eventIndex];
  const expected = expectedOutput(lessonId, a, b);
  const answer = expected[lessonId === "prefix-sum" ? 3 : 0];

  useEffect(() => {
    if (view !== "learn" || !sourceFocusPending.current) return;
    sourceFocusPending.current = false;
    executionRef.current?.focus();
  }, [view]);

  useEffect(() => {
    setFrame(0);
    setPlaying(false);
    setPrediction("");
    setPredictionStatus("none");
    setVisited([]);
    setFocusedThread(0);
  }, [result]);
  useEffect(() => {
    if (!event) return;
    const key =
      event.opcode === "LDR" && event.stage === "Memory"
        ? "load"
        : event.stage === "Execute" &&
            ["ADD", "SUB", "MUL"].includes(event.opcode)
          ? "compute"
          : event.opcode === "STR" && event.stage === "Memory"
            ? "store"
            : null;
    if (key)
      setVisited((items) => (items.includes(key) ? items : [...items, key]));
  }, [event]);
  useEffect(() => {
    if (!playing || !result) return;
    const timer = window.setInterval(
      () =>
        setFrame((current) => {
          if (current >= frames.length - 1) {
            if (loop) return 0;
            setPlaying(false);
            return current;
          }
          return current + 1;
        }),
      600 / speed,
    );
    return () => clearInterval(timer);
  }, [playing, result, frames.length, speed, loop]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        view !== "learn" ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        setFrame((current) =>
          Math.max(
            0,
            Math.min(
              frames.length - 1,
              current + (e.key === "ArrowRight" ? 1 : -1),
            ),
          ),
        );
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [view, frames.length]);

  function chooseLesson(id: LessonId) {
    setLessonId(id);
    setOutputIndex(0);
    setPlaying(false);
    if (id === "branches" && model === "simd") setModel("simt");
  }
  function seek(next: number) {
    setPlaying(false);
    setFrame(Math.max(0, Math.min(frames.length - 1, next)));
  }
  function checkpoint(kind: string) {
    if (!result) return;
    const i = frames.findIndex(
      (index) =>
        result.trace[index].opcode ===
          (kind === "load" ? "LDR" : kind === "store" ? "STR" : "ADD") &&
        result.trace[index].stage ===
          (kind === "compute" ? "Execute" : "Memory") &&
        (kind !== "compute" ||
          result.trace[index].instruction.startsWith("ADD R4,")),
    );
    if (i >= 0) seek(i);
  }
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: "tinygpu-lesson-1",
              lessonId,
              a,
              b,
              model,
              laneWidth,
              result,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lessonId}-${model}.trace.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error("Trace file exceeds 5 MB.");
      const data = JSON.parse(await file.text());
      if (
        data.format !== "tinygpu-lesson-1" ||
        !lessons.some((lesson) => lesson.id === data.lessonId) ||
        !Array.isArray(data.a) ||
        !Array.isArray(data.b) ||
        !Object.hasOwn(executionModels, data.model) ||
        ![1, 2, 4, 8].includes(data.laneWidth)
      )
        throw new Error("Not a supported lesson trace.");
      runLesson(data.lessonId, data.a, data.b, data.model, data.laneWidth);
      setLessonId(data.lessonId);
      setOutputIndex(0);
      setA(data.a);
      setB(data.b);
      setModel(data.model);
      setLaneWidth(data.laneWidth);
      setFrame(0);
      setPlaying(false);
      setFileError("");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Invalid trace.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  const canComplete =
    predictionStatus === "correct" &&
    visited.length === 3 &&
    !!result &&
    checkLesson(result, lessonId, a, b);

  return (
    <div className="lab-shell">
      <header className="lab-header">
        <a
          className="lab-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("learn");
          }}
        >
          <Cpu size={28} />
          <div>
            <strong>
              TinyGPU <span>Trace Lab</span>
            </strong>
            <small>COMPUTATION, MADE VISIBLE</small>
          </div>
        </a>
        <div className="lab-header-actions">
          <span className="local-badge">
            <span />
            Local simulation
          </span>
          <button
            className="icon-button"
            hidden={view === "studio"}
            title="Export reproducible trace"
            aria-label="Export trace"
            onClick={download}
            disabled={!result}
          >
            <Download size={18} />
          </button>
          <button
            className="icon-button"
            hidden={view === "studio"}
            title="Restore lesson trace"
            aria-label="Import trace"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={18} />
          </button>
          <input
            type="file"
            accept="application/json,.json"
            ref={fileRef}
            hidden
            onChange={(e) => void restore(e.currentTarget.files?.[0])}
          />
        </div>
      </header>
      <nav className="lab-tabs" aria-label="Laboratory views">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={view === id ? "page" : undefined}
            className={view === id ? "active" : ""}
            onClick={() => {
              setView(id);
              if (id === "studio") setStudioOpened(true);
              if (id === "explorer") setExplorerOpened(true);
              setPlaying(false);
            }}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      {fileError && (
        <p role="alert" className="lab-error">
          {fileError}
        </p>
      )}
      {studioOpened && (
        <div hidden={view !== "studio"}>
          <ProgramStudio active={view === "studio"} />
        </div>
      )}
      {explorerOpened && (
        <div className="legacy-container" hidden={view !== "explorer"}>
          {explorer(view === "explorer")}
        </div>
      )}
      {view === "studio" || view === "explorer" ? null : (
        <div className="lab-layout">
          <aside className="lesson-rail">
            <div className="rail-heading">
              <BookOpen size={16} />
              <strong>EXPERIMENTS</strong>
              <span>
                {completed.length}/{lessons.length}
              </span>
            </div>
            <div className="lesson-list">
              {lessons.map((item, i) => (
                <button
                  key={item.id}
                  className={lessonId === item.id ? "active" : ""}
                  onClick={() => chooseLesson(item.id)}
                  aria-current={lessonId === item.id ? "step" : undefined}
                >
                  <span className="lesson-number">
                    {completed.includes(item.id) ? (
                      <Check size={16} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.concept}</small>
                  </span>
                </button>
              ))}
            </div>
            <section className="rail-note">
              <FlaskConical size={20} />
              <h3>Teaching model</h3>
              <p>
                Deterministic integer execution. Five logical stages per issue.
                No cache, latency, or vendor performance model.
              </p>
              <details>
                <summary>Model assumptions</summary>
                <p>{executionModels[model].description}</p>
                <p>
                  One global issue slot. Core IDs describe placement, not
                  parallel hardware timing. Missing memory starts at zero.
                </p>
              </details>
            </section>
          </aside>
          <main className="lab-main">
            <div className="lab-page-heading">
              <div>
                <span className="eyebrow">
                  EXPERIMENT{" "}
                  {String(lessons.indexOf(lesson) + 1).padStart(2, "0")} /{" "}
                  {lesson.concept}
                </span>
                <h1>
                  {view === "learn"
                    ? lesson.title
                    : view === "compare"
                      ? "Same problem. Different machines."
                      : view === "graph"
                        ? "Where does the result come from?"
                        : "From execution to hardware"}
                </h1>
              </div>
              <div className="model-controls">
                <label>
                  Execution
                  <select
                    aria-label="Execution model"
                    value={model}
                    onChange={(e) =>
                      setModel(e.currentTarget.value as ExecutionModel)
                    }
                  >
                    {Object.entries(executionModels).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lanes
                  <select
                    aria-label="Lane width"
                    value={laneWidth}
                    onChange={(e) =>
                      setLaneWidth(Number(e.currentTarget.value))
                    }
                  >
                    {[1, 2, 4, 8].map((width) => (
                      <option key={width}>{width}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="input-band">
              <InputVector label="A" values={a} setValues={setA} />
              <InputVector
                label="B"
                values={b}
                setValues={setB}
                disabled={["reduction", "prefix-sum"].includes(lessonId)}
              />
              <ArrowRight className="input-arrow" size={20} />
              <div className="vector-group output-vector">
                <span className="vector-title">
                  C <small>OUTPUT / ADDR 128+</small>
                </span>
                <div>
                  {expected.map((_, i) => (
                    <button
                      key={i}
                      className={
                        snapshot?.memory[128 + i] !== undefined ? "written" : ""
                      }
                      aria-label={`Trace output C[${i}]`}
                      title={`Trace dependencies for C[${i}]`}
                      onClick={() => {
                        setOutputIndex(i);
                        setView("graph");
                        setPlaying(false);
                      }}
                    >
                      <small>{i}</small>
                      <strong data-testid={`output-${i}`}>
                        {snapshot?.memory[128 + i] ?? "--"}
                      </strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {execution.error && (
              <div className="lab-error" role="alert">
                {execution.error}
              </div>
            )}
            {view === "compare" && (
              <ComparisonLab
                lessonId={lessonId}
                a={a}
                b={b}
                laneWidth={laneWidth}
              />
            )}
            {view === "graph" && result && (
              <GraphLab
                key={`${lessonId}-${a.join()}-${b.join()}-${model}-${laneWidth}-${outputIndex}`}
                outputIndex={outputIndex}
                result={result}
                a={a}
                b={b}
                lessonId={lessonId}
                onSource={(index) => {
                  const source = result.trace[index];
                  const sourceFrame = frames.findIndex((i) => i >= index);
                  if (!source || sourceFrame < 0) return;
                  setFocusedThread(source.threadId);
                  setInspection("registers");
                  sourceFocusPending.current = true;
                  setView("learn");
                  seek(sourceFrame);
                }}
              />
            )}
            {view === "hardware" && <HardwareLab result={result} />}
            {view === "learn" && result && event && snapshot && (
              <div className="learning-grid">
                <section
                  className="execution-workspace"
                  ref={executionRef}
                  tabIndex={-1}
                  aria-label={`Visual execution: thread ${event.threadId}, PC ${event.pc}, ${event.stage}`}
                >
                  <div className="workspace-toolbar">
                    <div>
                      <span className="eyebrow">LIVE EXECUTION</span>
                      <strong>
                        Issue {event.issue + 1}{" "}
                        <span>/ {result.statistics.issues}</span>
                      </strong>
                    </div>
                    <div
                      className="segmented"
                      aria-label="Architecture display"
                    >
                      <button
                        className={!spatial ? "active" : ""}
                        onClick={() => {
                          setSpatial(false);
                          setArchitectureLevel("GPU Overview");
                        }}
                      >
                        <CircuitBoard size={15} />
                        2D
                      </button>
                      <button
                        className={spatial ? "active" : ""}
                        onClick={() => {
                          setSpatial(true);
                          setArchitectureLevel("GPU Overview");
                        }}
                      >
                        <Box size={15} />
                        3D
                      </button>
                    </div>
                    <label className="motion-toggle">
                      <input
                        type="checkbox"
                        checked={reducedMotion}
                        onChange={(e) =>
                          setReducedMotion(e.currentTarget.checked)
                        }
                      />
                      Reduce motion
                    </label>
                  </div>
                  <TraceArchitecture
                    result={result}
                    index={result.trace.indexOf(event)}
                    level={architectureLevel}
                    onLevel={(level) => {
                      setPlaying(false);
                      setArchitectureLevel(level);
                    }}
                    onSeek={(index) => {
                      const selected = result.trace[index];
                      const selectedFrame = frames.findIndex((i) => i >= index);
                      if (!selected || selectedFrame < 0) return;
                      setFocusedThread(selected.threadId);
                      seek(selectedFrame);
                    }}
                  >
                    <LabArchitecture
                      event={event}
                      spatial={spatial}
                      reducedMotion={reducedMotion}
                      inspect={setInspection}
                    />
                  </TraceArchitecture>
                  <div className="lab-stages">
                    {stages.map((stage, i) => (
                      <button
                        key={stage}
                        className={event.stage === stage ? "active" : ""}
                        onClick={() =>
                          seek(
                            frames.findIndex(
                              (index) =>
                                result.trace[index].issue === event.issue &&
                                result.trace[index].stage === stage,
                            ),
                          )
                        }
                      >
                        <small>{i + 1}</small>
                        {stage}
                      </button>
                    ))}
                  </div>
                  <div className="lab-playback">
                    <button
                      className="play-button"
                      aria-label={playing ? "Pause" : "Play"}
                      title={playing ? "Pause" : "Play"}
                      onClick={() => {
                        if (safeFrame === frames.length - 1) setFrame(0);
                        setPlaying(!playing);
                      }}
                    >
                      {playing ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      className="icon-button"
                      title="First event"
                      aria-label="First event"
                      onClick={() => seek(0)}
                      disabled={safeFrame === 0}
                    >
                      <SkipBack size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="Previous stage"
                      aria-label="Previous stage"
                      onClick={() => seek(safeFrame - 1)}
                      disabled={safeFrame === 0}
                    >
                      <StepBack size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="Next stage"
                      aria-label="Next stage"
                      onClick={() => seek(safeFrame + 1)}
                      disabled={safeFrame === frames.length - 1}
                    >
                      <StepForward size={17} />
                    </button>
                    <button
                      className="icon-button"
                      title="Final event"
                      aria-label="Final event"
                      onClick={() => seek(frames.length - 1)}
                      disabled={safeFrame === frames.length - 1}
                    >
                      <SkipForward size={17} />
                    </button>
                    <input
                      className="playback-range"
                      type="range"
                      min={0}
                      max={frames.length - 1}
                      value={safeFrame}
                      onChange={(e) => seek(Number(e.currentTarget.value))}
                      aria-label="Trace position"
                    />
                    <span className="tick-count">
                      {safeFrame + 1}/{frames.length}
                    </span>
                    <select
                      aria-label="Playback speed"
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.currentTarget.value))}
                    >
                      {[1, 2, 4, 8].map((speed) => (
                        <option key={speed} value={speed}>
                          {speed}x
                        </option>
                      ))}
                    </select>
                    <label className="loop-toggle">
                      <input
                        type="checkbox"
                        checked={loop}
                        onChange={(e) => setLoop(e.currentTarget.checked)}
                      />
                      Loop
                    </label>
                  </div>
                  <div
                    className="event-explanation"
                    aria-live={playing ? "off" : "polite"}
                  >
                    <span className="event-stage">{event.stage}</span>
                    <p>{event.explanatoryText}</p>
                  </div>
                  <div className="thread-lanes">
                    <h3>
                      Thread lanes{" "}
                      <span>
                        {event.activeThreads.length} active /{" "}
                        {event.maskedThreads.length} masked
                      </span>
                    </h3>
                    {snapshot.threads.map((thread) => (
                      <button
                        key={thread.threadId}
                        className={`${event.activeThreads.includes(thread.threadId) ? "active" : "masked"} ${event.threadId === thread.threadId ? "focused" : ""}`}
                        onClick={() => {
                          setFocusedThread(thread.threadId);
                          if (!event.activeThreads.includes(thread.threadId)) {
                            const next = frames.findIndex(
                              (index, frameIndex) =>
                                frameIndex >= safeFrame &&
                                result.trace[index].activeThreads.includes(
                                  thread.threadId,
                                ),
                            );
                            const previous =
                              frames.length -
                              1 -
                              [...frames]
                                .reverse()
                                .findIndex((index) =>
                                  result.trace[index].activeThreads.includes(
                                    thread.threadId,
                                  ),
                                );
                            seek(next >= 0 ? next : previous);
                          }
                        }}
                        aria-label={`Inspect thread ${thread.threadId}`}
                      >
                        <span>T{thread.threadId}</span>
                        <span className="lane-track">
                          <i
                            style={{
                              width: `${Math.min(100, ((thread.pc + Number(thread.complete)) / result.program.instructions.length) * 100)}%`,
                            }}
                          />
                        </span>
                        <span>
                          {thread.complete
                            ? "Done"
                            : event.activeThreads.includes(thread.threadId)
                              ? event.stage
                              : "Waiting"}
                        </span>
                        <code>PC {thread.pc}</code>
                      </button>
                    ))}
                  </div>
                  <div className="lesson-checkpoints">
                    {[
                      ["load", "Observe a load"],
                      ["compute", "Inspect arithmetic"],
                      ["store", "Follow a store"],
                    ].map(([key, label]) => (
                      <button key={key} onClick={() => checkpoint(key)}>
                        {visited.includes(key) ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <span className="checkpoint-dot" />
                        )}
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
                <aside className="learning-inspector">
                  <section className="prediction-section">
                    <div className="section-heading">
                      <FlaskConical size={17} />
                      <h2>Predict the result</h2>
                    </div>
                    <p>{lesson.question}</p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setPredictionStatus(
                          prediction.trim() !== "" &&
                            Number(prediction) === answer
                            ? "correct"
                            : "incorrect",
                        );
                      }}
                    >
                      <input
                        aria-label="Your prediction"
                        type="number"
                        step="1"
                        required
                        value={prediction}
                        onChange={(e) => {
                          setPrediction(e.currentTarget.value);
                          setPredictionStatus("none");
                        }}
                        placeholder="Your answer"
                      />
                      <button type="submit">
                        Check <ArrowRight size={14} />
                      </button>
                    </form>
                    {predictionStatus !== "none" && (
                      <p
                        role="status"
                        className={`prediction-feedback ${predictionStatus}`}
                      >
                        {predictionStatus === "correct"
                          ? "Correct. Now follow the values through execution."
                          : "Not quite. Check the operands and the operation, then try again."}
                      </p>
                    )}
                  </section>
                  <section className="state-section">
                    <div className="state-tabs">
                      {(
                        [
                          "program",
                          "registers",
                          "memory",
                          "arithmetic",
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab}
                          className={inspection === tab ? "active" : ""}
                          onClick={() => setInspection(tab)}
                        >
                          {tab === "arithmetic"
                            ? "Operands"
                            : tab[0].toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>
                    {inspection === "program" ? (
                      <div className="program-list">
                        {result.program.instructions.map((instruction, pc) => (
                          <button
                            key={pc}
                            className={event.pc === pc ? "active" : ""}
                            onClick={() => {
                              const target = frames.findIndex(
                                (index) => result.trace[index].pc === pc,
                              );
                              if (target >= 0) seek(target);
                            }}
                          >
                            <span>{String(pc).padStart(2, "0")}</span>
                            <code>{instruction.source}</code>
                            {event.pc === pc && <ArrowRight size={13} />}
                          </button>
                        ))}
                      </div>
                    ) : inspection === "registers" ? (
                      <div className="state-registers">
                        {Object.entries(
                          snapshot.threads[event.threadId].registers,
                        ).map(([name, value]) => (
                          <div
                            key={name}
                            className={
                              event.registerDiff.some(
                                (diff) => diff.register === name,
                              )
                                ? "changed"
                                : ""
                            }
                          >
                            <code>{name}</code>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                    ) : inspection === "memory" ? (
                      <div className="state-memory">
                        <div className="state-table-heading">
                          <span>Address</span>
                          <span>Value</span>
                        </div>
                        {Object.entries(snapshot.memory).map(
                          ([address, value]) => (
                            <div
                              key={address}
                              className={
                                event.memoryDiff.some(
                                  (diff) => diff.address === Number(address),
                                )
                                  ? "changed"
                                  : ""
                              }
                            >
                              <code>{address}</code>
                              <strong>{value}</strong>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="operand-list">
                        {event.operands.map((operand, i) => (
                          <div key={i}>
                            <code>{operand.name}</code>
                            <small>{operand.kind}</small>
                            <strong>{operand.value}</strong>
                          </div>
                        ))}
                        {event.resultValue !== undefined && (
                          <div className="operation-result">
                            <span>Result</span>
                            <strong>{event.resultValue}</strong>
                          </div>
                        )}
                        <p>Values captured before this instruction commits.</p>
                      </div>
                    )}
                  </section>
                  <section className="lesson-takeaway">
                    <h2>The idea</h2>
                    <p>{lesson.takeaway}</p>
                    <h3>Experiment</h3>
                    <p>{lesson.experiment}</p>
                    <button
                      className="complete-lesson"
                      disabled={!canComplete}
                      onClick={() =>
                        setCompleted((items) =>
                          items.includes(lessonId)
                            ? items
                            : [...items, lessonId],
                        )
                      }
                    >
                      <Check size={16} />
                      {completed.includes(lessonId)
                        ? "Lesson complete"
                        : "Complete lesson"}
                    </button>
                  </section>
                </aside>
              </div>
            )}
            <footer className="lab-footer">
              <span>TEACHING ENGINE v1 / INTEGER SEMANTICS</span>
              <span>Logical ticks are not hardware clock cycles.</span>
              <button
                className="reset-inputs"
                onClick={() => {
                  setA([...defaultA]);
                  setB([...defaultB]);
                  setFileError("");
                }}
              >
                <RotateCcw size={13} />
                Reset inputs
              </button>
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}

function InputVector({
  label,
  values,
  setValues,
  disabled = false,
}: {
  label: string;
  values: number[];
  setValues: (values: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`vector-group ${disabled ? "unused-vector" : ""}`}>
      <span className="vector-title">
        {label}
        <small>
          {disabled
            ? "UNUSED IN THIS LESSON"
            : `INPUT / ADDR ${label === "A" ? "0" : "64"}+`}
        </small>
      </span>
      <div>
        {values.map((value, i) => (
          <label key={i}>
            <small>{i}</small>
            <input
              aria-label={`${label}[${i}]`}
              type="number"
              min="-1000"
              max="1000"
              step="1"
              value={value}
              disabled={disabled}
              onChange={(e) => {
                const number = e.currentTarget.valueAsNumber;
                if (Number.isInteger(number) && Math.abs(number) <= 1000)
                  setValues(values.map((old, j) => (j === i ? number : old)));
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ComparisonLab({
  lessonId,
  a,
  b,
  laneWidth,
}: {
  lessonId: LessonId;
  a: number[];
  b: number[];
  laneWidth: number;
}) {
  const [position, setPosition] = useState(0);
  const runs = useMemo(
    () =>
      (["scalar", "simd", "simt"] as const).map((model) => {
        try {
          return {
            model,
            result: runLesson(lessonId, a, b, model, laneWidth),
            error: "",
          };
        } catch (error) {
          return { model, result: null, error: (error as Error).message };
        }
      }),
    [lessonId, a, b, laneWidth],
  );
  const max = Math.max(
    ...runs.map(({ result }) => result?.statistics.issues ?? 0),
  );
  useEffect(() => setPosition(0), [runs]);
  return (
    <section className="comparison-lab">
      <div className="comparison-toolbar">
        <div>
          <h2>Execution schedules</h2>
          <p>
            Identical program and inputs. Each colored block is one issued
            instruction.
          </p>
        </div>
        <label>
          Issue {Math.min(position, max - 1) + 1}
          <input
            aria-label="Comparison issue"
            type="range"
            min={0}
            max={max - 1}
            value={Math.min(position, max - 1)}
            onChange={(e) => setPosition(Number(e.currentTarget.value))}
          />
        </label>
      </div>
      <div className="machine-comparisons">
        {runs.map(({ model, result, error }, i) => (
          <article key={model} className={`machine machine-${i}`}>
            <header>
              <Cpu size={22} />
              <h2>{executionModels[model].name}</h2>
              <span>
                {model === "scalar" ? 1 : laneWidth} lane
                {model !== "scalar" && laneWidth !== 1 ? "s" : ""}
              </span>
            </header>
            <p>{executionModels[model].description}</p>
            {result ? (
              <>
                <div className="machine-metrics">
                  <div>
                    <strong>{result.statistics.issues}</strong>
                    <span>instruction issues</span>
                  </div>
                  <div>
                    <strong>
                      {Math.round(result.statistics.laneUtilization * 100)}%
                    </strong>
                    <span>used lane slots</span>
                  </div>
                </div>
                <div
                  className="schedule-grid"
                  aria-label={`${executionModels[model].name} schedule`}
                >
                  {result.trace
                    .filter(
                      (event) =>
                        event.stage === "Fetch" &&
                        event.threadId === event.activeThreads[0],
                    )
                    .map((event) => (
                      <button
                        key={event.issue}
                        title={`Issue ${event.issue + 1}: ${event.opcode}, threads ${event.activeThreads.join(", ")}`}
                        className={
                          event.issue === position
                            ? "selected"
                            : event.issue < position
                              ? "past"
                              : ""
                        }
                        onClick={() => setPosition(event.issue)}
                        aria-label={`${model} issue ${event.issue + 1}`}
                      >
                        {event.activeThreads.length}
                      </button>
                    ))}
                </div>
                <div className="machine-current">
                  <Braces size={17} />
                  <code>
                    {result.trace.find((event) => event.issue === position)
                      ?.instruction ?? "Complete"}
                  </code>
                </div>
                <div className="machine-output">
                  <CheckCircle2 size={16} />
                  <span>
                    {checkLesson(result, lessonId, a, b)
                      ? "Reference result matches"
                      : "Reference mismatch"}
                  </span>
                  <strong>
                    {expectedOutput(lessonId, a, b)
                      .map((_, i) => result.finalMemory[128 + i])
                      .join(", ")}
                  </strong>
                </div>
              </>
            ) : (
              <div className="unsupported-model">
                <strong>Unsupported control flow</strong>
                <p>{error}</p>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="comparison-note">
        <h3>What is being compared?</h3>
        <p>
          Instruction grouping and lane usage, not elapsed time. SIMD and SIMT
          can issue equally many instructions on straight-line workloads. A
          serial accumulator stays serial without an algorithm change.
        </p>
      </div>
    </section>
  );
}
