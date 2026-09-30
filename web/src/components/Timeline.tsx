import type { TraceEvent } from "@tinygpu-trace-lab/simulator";
import { tokenLegend } from "../data/views";

interface Props {
  trace: TraceEvent[];
  cycle: number;
  onSelect: (cycle: number) => void;
  range: [number, number];
}

export function Timeline({ trace, cycle, onSelect, range }: Props) {
  const sampled = trace.filter(
    (_, index) => index % Math.ceil(trace.length / 96 || 1) === 0,
  );
  const lanes = [
    "Core activity",
    "Memory activity",
    "Decode activity",
    "Masked paths",
    "Writeback activity",
  ];
  const rangeEvents = trace.filter(
    (event) => event.cycle >= range[0] && event.cycle <= range[1],
  );
  const commits = rangeEvents.filter(
    (event) => event.stage === "Writeback",
  ).length;

  return (
    <section className="timeline-panel" aria-label="Timeline View">
      <div className="timeline-head">
        <strong>Timeline View</strong>
        <span>
          Events {range[0]}-{range[1]} | {commits} lane instructions committed
        </span>
      </div>
      <div className="timeline-legend" aria-label="Timeline legend">
        {tokenLegend.map(([label, state]) => (
          <span key={state}>
            <i className={`legend-dot ${state}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
      <div className="lanes">
        {lanes.map((lane, laneIndex) => (
          <div className="lane" key={lane}>
            <span>{lane}</span>
            <div className="bars">
              {sampled.map((event) => {
                const active = Math.abs(event.cycle - cycle) < 3;
                const memoryLane =
                  laneIndex === 1 && event.activeComponent.includes("Memory");
                const stallLane = laneIndex === 3 && event.stallReason;
                const throughputLane =
                  laneIndex === 4 && event.stage === "Writeback";
                const schedulerLane =
                  laneIndex === 2 &&
                  ["Dispatcher", "Device Control Register"].includes(
                    event.activeComponent,
                  );
                const coreLane =
                  laneIndex === 0 && event.activeComponent !== "Data Memory";
                const hot =
                  memoryLane ||
                  stallLane ||
                  schedulerLane ||
                  coreLane ||
                  throughputLane;
                return (
                  <button
                    type="button"
                    key={`${lane}-${event.cycle}`}
                    className={`bar ${hot ? "hot" : ""} ${active ? "active" : ""} ${event.cycle === cycle ? "selected" : ""} ${event.stallReason ? "stall" : ""}`}
                    onClick={() => onSelect(event.cycle)}
                    aria-label={`Jump to event ${event.cycle}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
