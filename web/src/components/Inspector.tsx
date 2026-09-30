import type {
  PerformanceMetrics,
  ThreadState,
  TraceEvent,
} from "@tinygpu-trace-lab/simulator";
import { glossary } from "../data/glossary";

interface Props {
  event: TraceEvent;
  thread?: ThreadState;
  metrics: PerformanceMetrics;
  memory: Record<number, number>;
}

export function Inspector({ event, thread, metrics, memory }: Props) {
  const registers = thread ? Object.entries(thread.registers).slice(0, 13) : [];
  const memoryEntries = Object.entries(memory).slice(0, 10);

  return (
    <aside className="inspector" aria-label="Event inspector">
      <section className="panel explanation">
        <div className="panel-title">What just happened?</div>
        <p>{event.explanatoryText}</p>
        <code>{event.instruction}</code>
      </section>

      <section className="panel metrics-grid" aria-label="Performance Metrics">
        {[
          ["Operations / logical tick", metrics.ipc.toFixed(2)],
          ["Instruction Count", metrics.instructionCount],
          ["Memory Access Count", metrics.memoryAccessCount],
          ["Branch Count", metrics.branchCount],
          ["Cache model", "Not modeled"],
          ["Stall timing", "Not modeled"],
          ["Hardware occupancy", "Not modeled"],
          ["Elapsed time", "Not modeled"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="panel hazard-panel" aria-label="Pipeline hazards">
        <div className="panel-title">Pipeline Hazards</div>
        {(["RAW", "WAR", "WAW", "Memory latency", "Divergence"] as const).map(
          (hazard) => (
            <div
              key={hazard}
              className={event.stallReason === hazard ? "active" : ""}
            >
              <span>{hazard}</span>
              <strong>
                {hazard === "Divergence"
                  ? event.stallReason === hazard
                    ? "Masked lanes"
                    : "No split at this event"
                  : "Not modeled"}
              </strong>
            </div>
          ),
        )}
      </section>

      <section className="panel table-panel">
        <div className="panel-title">Register File</div>
        <div className="register-grid">
          {registers.map(([register, value]) => (
            <div
              key={register}
              className={
                event.registerDiff.some((diff) => diff.register === register)
                  ? "changed"
                  : ""
              }
            >
              <span>{register}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-title">Memory Diff</div>
        {event.memoryDiff.length
          ? event.memoryDiff.map((diff) => (
              <div className="diff-row" key={diff.address}>
                <span>addr {diff.address}</span>
                <strong>
                  {diff.before} {"->"} {diff.after}
                </strong>
              </div>
            ))
          : memoryEntries.map(([address, value]) => (
              <div className="diff-row" key={address}>
                <span>addr {address}</span>
                <strong>{value}</strong>
              </div>
            ))}
      </section>

      <section className="panel glossary-panel">
        <div className="panel-title">Glossary</div>
        {glossary.slice(0, 8).map(([term, definition]) => (
          <details key={term} open={term === "ALU" || term === "LSU"}>
            <summary>{term}</summary>
            <p>{definition}</p>
          </details>
        ))}
      </section>

      <section
        className="panel tutor-panel"
        aria-label="AI Tutor future prompts"
      >
        <div className="panel-title">AI Tutor Prompts</div>
        {[
          "Why did this thread stall?",
          "Why was there divergence?",
          "How can I optimize this kernel?",
        ].map((question) => (
          <div className="tutor-row" key={question}>
            {question}
          </div>
        ))}
      </section>
    </aside>
  );
}
