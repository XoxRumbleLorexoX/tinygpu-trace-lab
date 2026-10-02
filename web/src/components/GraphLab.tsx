import { useId, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Code2,
  GitFork,
  StepBack,
  StepForward,
} from "lucide-react";
import {
  ancestorsOf,
  consumersOf,
  extractGraph,
  scheduleGraph,
  simulateSystolic,
  expectedOutput,
  type ExecutionResult,
  type LessonId,
} from "@tinygpu-trace-lab/simulator";

export function GraphLab({
  result,
  a = [],
  b = [],
  lessonId,
  outputIndex = 0,
  outputAddress = 128 + outputIndex,
  onSource,
}: {
  result: ExecutionResult;
  a?: number[];
  b?: number[];
  lessonId?: LessonId;
  outputIndex?: number;
  outputAddress?: number;
  onSource: (index: number) => void;
}) {
  const markerId = useId();
  const graph = useMemo(() => extractGraph(result), [result]);
  const [units, setUnits] = useState(4);
  const [policy, setPolicy] = useState<"source-order" | "critical-path">(
    "source-order",
  );
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(
    graph.nodes.filter((node) => node.outputAddress === outputAddress).at(-1)
      ?.id ?? graph.nodes[0].id,
  );
  const [inputAddress, setInputAddress] = useState("");
  const [accelerator, setAccelerator] = useState(false);
  const steps = useMemo(
    () => scheduleGraph(graph, units, policy),
    [graph, units, policy],
  );
  const serialTicks = useMemo(() => scheduleGraph(graph, 1).length, [graph]);
  const step = steps[Math.min(tick, steps.length - 1)];
  const node = graph.nodes.find((node) => node.id === selected)!;
  const ancestors = useMemo(
    () =>
      inputAddress === ""
        ? ancestorsOf(graph, selected)
        : consumersOf(
            graph,
            graph.nodes
              .filter(
                (node) =>
                  node.opcode === "LDR" &&
                  node.inputs.some(
                    (input) =>
                      input.kind === "address" &&
                      input.value === Number(inputAddress),
                  ),
              )
              .map((node) => node.id),
          ),
    [graph, selected, inputAddress],
  );
  const positions = useMemo(() => {
    const depths = new Map<string, number>();
    const counts = new Map<string, number>();
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of graph.nodes) {
      let depth = Math.max(
        0,
        ...node.dependencies.map((id) => (depths.get(id) ?? 0) + 1),
      );
      const column = node.threadId;
      depth = Math.max(depth, counts.get(String(column)) ?? 0);
      depths.set(node.id, depth);
      counts.set(String(column), depth + 1);
      positions.set(node.id, { x: 30 + column * 175, y: 48 + depth * 64 });
    }
    return positions;
  }, [graph]);
  const width = Math.max(730, result.initialThreads.length * 175 + 60);
  const height =
    Math.max(...[...positions.values()].map((point) => point.y)) + 85;
  const sameOutput = Object.entries(result.finalMemory).every(
    ([address, value]) => steps.at(-1)!.memory[Number(address)] === value,
  );
  return (
    <section className="graph-lab">
      <div className="graph-toolbar">
        <div>
          <h2>
            <GitFork size={20} />{" "}
            {accelerator
              ? "Systolic matrix array"
              : "Observed computation graph"}
          </h2>
          <p>
            {accelerator
              ? "A travels right. B travels down. Each processing element accumulates one dot product."
              : "Dependencies extracted from this completed run. Reordering ready operations preserves the result."}
          </p>
        </div>
        {lessonId === "matrix-multiply" && (
          <div className="segmented">
            <button
              className={!accelerator ? "active" : ""}
              onClick={() => setAccelerator(false)}
            >
              Dataflow
            </button>
            <button
              className={accelerator ? "active" : ""}
              onClick={() => setAccelerator(true)}
            >
              Systolic array
            </button>
          </div>
        )}
      </div>
      {accelerator ? (
        <SystolicLab a={a} b={b} />
      ) : (
        <>
          <div className="graph-controls">
            <label>
              Provenance
              <select
                aria-label="Trace input consumers"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.currentTarget.value)}
              >
                <option value="">Selected operation inputs</option>
                {Object.keys(result.initialMemory).map((address) => (
                  <option key={address} value={address}>
                    Consumers of memory[{address}]
                  </option>
                ))}
              </select>
            </label>
            <label>
              Processing units
              <select
                aria-label="Graph processing units"
                value={units}
                onChange={(e) => {
                  setUnits(Number(e.currentTarget.value));
                  setTick(0);
                }}
              >
                {[1, 2, 4, 8].map((count) => (
                  <option key={count}>{count}</option>
                ))}
              </select>
            </label>
            <label>
              Scheduling policy
              <select
                aria-label="Graph scheduling policy"
                value={policy}
                onChange={(e) => {
                  setPolicy(e.currentTarget.value as typeof policy);
                  setTick(0);
                }}
              >
                <option value="source-order">Source order</option>
                <option value="critical-path">Longest remaining path</option>
              </select>
            </label>
            <span>
              <strong>{steps.length}</strong> ticks{" "}
              <small>/ {serialTicks} with one unit</small>
            </span>
            <span className="verified">
              <CheckCircle2 size={16} />
              {sameOutput ? "Same output" : "Output mismatch"}
            </span>
          </div>
          <div className="graph-workspace">
            <div className="graph-canvas">
              <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Operation dependency graph"
              >
                <defs>
                  <marker
                    id={markerId}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto"
                  >
                    <path d="M0 0L10 5L0 10Z" fill="#799584" />
                  </marker>
                </defs>
                {result.initialThreads.map((thread) => (
                  <text
                    key={thread.threadId}
                    x={40 + thread.threadId * 175}
                    y="24"
                    className="graph-thread-label"
                  >
                    THREAD {thread.threadId}
                  </text>
                ))}
                {graph.nodes.flatMap((node) =>
                  node.dependencies.map((source) => {
                    const from = positions.get(source)!,
                      to = positions.get(node.id)!;
                    return (
                      <path
                        key={`${source}:${node.id}`}
                        d={`M${from.x + 70},${from.y + 42} C${from.x + 70},${from.y + 58} ${to.x + 70},${to.y - 15} ${to.x + 70},${to.y}`}
                        fill="none"
                        stroke={
                          ancestors.has(source) && ancestors.has(node.id)
                            ? "#2c8863"
                            : "#d9e1dc"
                        }
                        strokeWidth={
                          ancestors.has(source) && ancestors.has(node.id)
                            ? 2
                            : 1
                        }
                        markerEnd={`url(#${markerId})`}
                      />
                    );
                  }),
                )}
                {graph.nodes.map((node) => {
                  const point = positions.get(node.id)!;
                  const active = step.active.includes(node.id),
                    done = step.completed.includes(node.id);
                  return (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      onFocus={(e) => {
                        const container =
                          e.currentTarget.closest(".graph-canvas");
                        if (!container) return;
                        const item = e.currentTarget.getBoundingClientRect();
                        const bounds = container.getBoundingClientRect();
                        const margin = 8;
                        // SVG focus scrolling can expose only part of a node.
                        container.scrollLeft +=
                          item.left < bounds.left + margin
                            ? item.left - bounds.left - margin
                            : Math.max(0, item.right - bounds.right + margin);
                        container.scrollTop +=
                          item.top < bounds.top + margin
                            ? item.top - bounds.top - margin
                            : Math.max(0, item.bottom - bounds.bottom + margin);
                      }}
                      aria-label={`${node.id}: ${node.instruction}`}
                      className={`graph-node ${node.id === selected ? "selected" : ""} ${ancestors.has(node.id) ? "ancestor" : ""}`}
                      onClick={() => setSelected(node.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(node.id);
                        }
                      }}
                    >
                      <rect
                        x={point.x}
                        y={point.y}
                        width="142"
                        height="42"
                        rx="4"
                        fill={active ? "#f8deaf" : done ? "#dff0e5" : "#ffffff"}
                        stroke={
                          node.id === selected
                            ? "#12543b"
                            : ancestors.has(node.id)
                              ? "#80b698"
                              : "#cedbd2"
                        }
                        strokeWidth={node.id === selected ? 3 : 1}
                      />
                      <text
                        x={point.x + 10}
                        y={point.y + 17}
                        fontSize="12"
                        fontWeight="650"
                      >
                        {node.opcode}
                        <tspan x={point.x + 132} textAnchor="end">
                          {done && node.expected !== undefined
                            ? step.values[node.id]
                            : `PC ${node.pc}`}
                        </tspan>
                      </text>
                      <text
                        x={point.x + 10}
                        y={point.y + 32}
                        fontSize="10"
                        fill="#5c7062"
                      >
                        {active
                          ? "EXECUTING"
                          : done
                            ? "COMPLETE"
                            : step.ready.includes(node.id)
                              ? "READY"
                              : "DEPENDENT"}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <aside className="graph-inspector">
              <span className="eyebrow">SELECTED OPERATION</span>
              <h3>
                {node.opcode} <span>T{node.threadId}</span>
              </h3>
              <code>{node.instruction}</code>
              <h4>Inputs</h4>
              {node.inputs.map((input, i) => (
                <div className="graph-input" key={i}>
                  <span>{input.name}</span>
                  <strong>{input.value}</strong>
                  <small>{input.producer ?? "Initial value"}</small>
                </div>
              ))}
              <h4>Dependencies</h4>
              {node.dependencies.length ? (
                node.dependencies.map((id) => (
                  <button key={id} onClick={() => setSelected(id)}>
                    {id}
                    <ArrowRight size={13} />
                  </button>
                ))
              ) : (
                <p>Independent of earlier operations.</p>
              )}
              <h4>Result</h4>
              <p>
                {node.outputAddress === undefined
                  ? (node.expected ?? "Control operation")
                  : `memory[${node.outputAddress}] = ${node.expected}`}
              </p>
              <button
                className="source-link"
                onClick={() => onSource(node.eventIndex)}
              >
                <Code2 size={16} />
                View source event
              </button>
            </aside>
          </div>
          <div className="graph-playback">
            <button
              className="icon-button"
              title="Previous graph tick"
              aria-label="Previous graph tick"
              disabled={tick === 0}
              onClick={() => setTick((tick) => Math.max(0, tick - 1))}
            >
              <StepBack size={17} />
            </button>
            <button
              className="icon-button"
              title="Next graph tick"
              aria-label="Next graph tick"
              disabled={tick >= steps.length - 1}
              onClick={() =>
                setTick((tick) => Math.min(steps.length - 1, tick + 1))
              }
            >
              <StepForward size={17} />
            </button>
            <input
              aria-label="Graph tick"
              type="range"
              min="0"
              max={steps.length - 1}
              value={Math.min(tick, steps.length - 1)}
              onChange={(e) => setTick(Number(e.currentTarget.value))}
            />
            <span>
              Tick {step.tick + 1}/{steps.length}
            </span>
          </div>
          <div className="comparison-note">
            <h3>Extraction boundary</h3>
            <p>
              This is the executed path for these inputs, not every possible
              branch. Data, memory ordering, and branch dependencies are
              preserved. Nodes cost one abstract tick; these ticks are not
              comparable to GPU clock cycles.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function SystolicLab({ a, b }: { a: number[]; b: number[] }) {
  const steps = useMemo(() => simulateSystolic(a, b), [a, b]);
  const [tick, setTick] = useState(0);
  const step = steps[tick];
  return (
    <div className="systolic-lab">
      <div className="systolic-summary">
        <div>
          <strong>2 x 2</strong>
          <span>processing elements</span>
        </div>
        <div>
          <strong>8</strong>
          <span>multiply-accumulates</span>
        </div>
        <div>
          <strong>{tick + 1} / 4</strong>
          <span>wavefront tick</span>
        </div>
      </div>
      <div className="systolic-array">
        {step.cells.map((cell) => (
          <article
            key={`${cell.row}-${cell.column}`}
            className={cell.k !== undefined ? "active" : ""}
          >
            <header>
              PE {cell.row},{cell.column}
              <span>
                {cell.k === undefined ? "Waiting / finished" : `k = ${cell.k}`}
              </span>
            </header>
            <div className="systolic-operands">
              <span>
                A <strong>{cell.a ?? "--"}</strong>
                <ArrowRight size={17} />
              </span>
              <span>
                B <strong>{cell.b ?? "--"}</strong>
                <ArrowDown size={17} />
              </span>
            </div>
            <p>
              {cell.k !== undefined
                ? `${cell.before} + (${cell.a} x ${cell.b})`
                : "Accumulator retained"}
            </p>
            <strong className="accumulator">{cell.after}</strong>
            <footer>
              C[{cell.row},{cell.column}] ={" "}
              {step.outputs[cell.row * 2 + cell.column] ?? "pending"}
            </footer>
          </article>
        ))}
      </div>
      <div className="graph-playback">
        <button
          className="icon-button"
          title="Previous systolic tick"
          aria-label="Previous systolic tick"
          disabled={tick === 0}
          onClick={() => setTick(tick - 1)}
        >
          <StepBack size={17} />
        </button>
        <button
          className="icon-button"
          title="Next systolic tick"
          aria-label="Next systolic tick"
          disabled={tick === 3}
          onClick={() => setTick(tick + 1)}
        >
          <StepForward size={17} />
        </button>
        <input
          aria-label="Systolic tick"
          type="range"
          min="0"
          max="3"
          value={tick}
          onChange={(e) => setTick(Number(e.currentTarget.value))}
        />
        <span>Tick {tick + 1}</span>
      </div>
      <p className="systolic-reference">
        Reference C: [{expectedOutput("matrix-multiply", a, b).join(", ")}].
        Ideal one-hop-per-tick transport; external memory and fill/drain
        overhead are excluded.
      </p>
    </div>
  );
}
