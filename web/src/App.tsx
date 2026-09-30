import { useEffect, useMemo, useState } from "react";
import { Cpu, GitCompareArrows, Layers, Route, Sparkles } from "lucide-react";
import {
  loadExampleProgram,
  simulate,
  stateAt,
} from "@tinygpu-trace-lab/simulator";
import { LearningLab } from "./components/LearningLab";
import { Controls } from "./components/Controls";
import { GpuScene } from "./components/GpuScene";
import { Inspector } from "./components/Inspector";
import { Timeline } from "./components/Timeline";
import {
  abstractionLevels,
  cameraPresets,
  comparisonCopy,
  comparisonModes,
  exampleDescriptions,
  exampleLabels,
  memoryHierarchy,
  pipelineStages,
} from "./data/views";

type ExampleKey = keyof typeof exampleLabels;

export function App() {
  return <LearningLab explorer={<Explorer />} />;
}

function Explorer() {
  const [example, setExample] = useState<ExampleKey>("vectorAdd");
  const [cycle, setCycle] = useState(18);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const [loop, setLoop] = useState(true);
  const [range, setRange] = useState<[number, number]>([0, 120]);
  const [cameraMode, setCameraMode] =
    useState<(typeof cameraPresets)[number]>("Overview");
  const [level, setLevel] =
    useState<(typeof abstractionLevels)[number]>("GPU Overview");
  const [comparison, setComparison] =
    useState<(typeof comparisonModes)[number]>("CPU vs GPU");

  const result = useMemo(
    () =>
      simulate(loadExampleProgram(example), {
        blockDim: example === "branchDivergence" ? 8 : 6,
        coreCount: 2,
      }),
    [example],
  );
  const maxCycle = Math.max(0, result.trace.length - 1);
  const safeCycle = Math.min(cycle, maxCycle);
  const event = result.trace[safeCycle] ?? result.trace[0];
  const snapshot = useMemo(
    () => stateAt(result, safeCycle),
    [result, safeCycle],
  );
  const thread = snapshot.threads.find(
    (item) => item.threadId === event.threadId,
  );
  const warps = [...new Set(snapshot.threads.map((item) => item.warpId))].map(
    (warpId) => {
      const members = snapshot.threads.filter((item) => item.warpId === warpId);
      const complete = members.every((item) => item.complete);
      const active =
        !complete &&
        members.some((item) => event.activeThreads.includes(item.threadId));
      return { warpId, complete, active };
    },
  );
  const comparisonDetails = comparisonCopy(comparison);

  useEffect(() => {
    setCycle((current) => Math.min(current, maxCycle));
    setRange(([start, end]) => {
      const nextStart = Math.min(start, maxCycle);
      const nextEnd = Math.min(Math.max(end, nextStart), maxCycle);
      return [nextStart, nextEnd];
    });
  }, [maxCycle]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCycle((current) => {
        if (current < range[0]) return range[0];
        if (current >= range[1]) return loop ? range[0] : range[1];
        return current + 1;
      });
    }, 420 / speed);
    return () => window.clearInterval(timer);
  }, [loop, playing, range, speed]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Cpu size={22} />
          <div>
            <h1>TinyGPU Trace Lab</h1>
            <p>An interactive 3D GPU architecture simulator</p>
          </div>
        </div>
        <nav aria-label="Camera Presets">
          {cameraPresets.map((preset) => (
            <button
              type="button"
              key={preset}
              className={preset === cameraMode ? "selected" : ""}
              onClick={() => setCameraMode(preset)}
            >
              {preset}
            </button>
          ))}
        </nav>
        <label className="camera-select">
          Camera
          <select
            value={cameraMode}
            onChange={(event) =>
              setCameraMode(
                event.currentTarget.value as (typeof cameraPresets)[number],
              )
            }
          >
            {cameraPresets.map((preset) => (
              <option key={preset}>{preset}</option>
            ))}
          </select>
        </label>
      </header>

      <aside className="left-rail" aria-label="Examples and views">
        <section>
          <h2>Examples</h2>
          {Object.entries(exampleLabels).map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={key === example ? "selected" : ""}
              onClick={() => setExample(key as ExampleKey)}
            >
              <Route size={15} />
              <span>
                <strong>{label}</strong>
                <small>{exampleDescriptions[key as ExampleKey]}</small>
              </span>
            </button>
          ))}
        </section>
        <section>
          <h2>Abstraction</h2>
          {abstractionLevels.map((item) => (
            <button
              type="button"
              key={item}
              className={item === level ? "selected" : ""}
              onClick={() => setLevel(item)}
            >
              <Layers size={15} />
              {item}
            </button>
          ))}
        </section>
        <section className="compare-box">
          <h2>Comparison Mode</h2>
          <GitCompareArrows size={17} />
          <select
            value={comparison}
            onChange={(event) =>
              setComparison(
                event.currentTarget.value as (typeof comparisonModes)[number],
              )
            }
          >
            {comparisonModes.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </section>
      </aside>

      <section className="workspace">
        <div className="status-strip">
          <StatusChip label="Event" value={safeCycle} />
          <StatusChip label="Thread" value={event.threadId} />
          <StatusChip label="Core" value={event.coreId} />
          <StatusChip label="PC" value={event.pc} />
          <StatusChip label="Opcode" value={event.opcode} />
          <StatusChip label="Token" value={event.tokenType} />
        </div>

        <div
          className="active-instruction-chip"
          aria-label="Active instruction"
        >
          <span>Active instruction</span>
          <strong>{event.instruction}</strong>
          <em>{event.activeComponent}</em>
        </div>

        <div className="stage-row" aria-label="Pipeline Visualization">
          {pipelineStages.map((stage) => (
            <div
              key={stage}
              className={`stage ${event.stage === stage ? "active" : ""} ${event.stallReason ? "stalling" : ""}`}
            >
              <span>{stage}</span>
              <strong>
                {event.stage === stage ? event.activeComponent : "idle"}
              </strong>
            </div>
          ))}
        </div>

        <GpuScene event={event} cameraMode={cameraMode} />

        <div className="warp-band" aria-label="Warp Visualization">
          {warps.map(({ warpId, active, complete }) => (
            <div
              key={warpId}
              className={active ? "active" : complete ? "complete" : "idle"}
            >
              <span>Warp {warpId}</span>
              <strong>
                {complete ? "Completed" : active ? "Scheduled" : "Waiting"}
              </strong>
            </div>
          ))}
          <div className="divergence-callout">
            <Sparkles size={16} />
            <span>
              Teaching schedule: {result.statistics.divergentIssues} issues with
              divergent thread paths. Logical stages are not hardware clock
              cycles.
            </span>
          </div>
        </div>

        <div
          className="analysis-grid"
          aria-label="Comparison Mode and Memory Visualization"
        >
          <section className="analysis-card comparison-card">
            <h2>{comparison} / concept notes</h2>
            <div className="comparison-columns">
              <div>
                <span>{comparisonDetails.baselineLabel}</span>
                <strong>{comparisonDetails.baselineValue}</strong>
                <p>
                  Conceptual baseline only. Measured model comparisons live in
                  the Compare tab.
                </p>
              </div>
              <div>
                <span>{comparisonDetails.experimentLabel}</span>
                <strong>{comparisonDetails.experimentValue}</strong>
                <p>
                  Grouping and masking are modeled. Memory latency and hardware
                  throughput are not.
                </p>
              </div>
            </div>
          </section>
          <section className="analysis-card memory-card">
            <h2>Memory Visualization</h2>
            <div className="memory-levels">
              {memoryHierarchy.map(([name, valueKey, stateKey]) => {
                const value =
                  valueKey === "cacheMisses"
                    ? "Not modeled"
                    : valueKey === "memoryAccessCount"
                      ? `${result.metrics.memoryAccessCount} accesses`
                      : valueKey === "1 cycle"
                        ? "Functional state"
                        : valueKey;
                const state =
                  stateKey === "stallWhenPresent"
                    ? result.metrics.cacheMisses
                      ? "stall"
                      : "active"
                    : stateKey === "activeAccesses"
                      ? "active"
                      : stateKey;
                return (
                  <div key={name} className={state}>
                    <span>{name}</span>
                    <strong>{value}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <Controls
          playing={playing}
          cycle={safeCycle}
          maxCycle={maxCycle}
          speed={speed}
          loop={loop}
          range={range}
          onPlaying={setPlaying}
          onCycle={setCycle}
          onSpeed={setSpeed}
          onLoop={setLoop}
          onRange={setRange}
        />
        <Timeline
          trace={result.trace}
          cycle={safeCycle}
          onSelect={setCycle}
          range={range}
        />
      </section>

      <Inspector
        event={event}
        thread={thread}
        metrics={result.metrics}
        memory={snapshot.memory}
      />
    </main>
  );
}

function StatusChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="status-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
