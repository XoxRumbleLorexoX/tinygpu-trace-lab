import type { ReactNode } from "react";
import { CircuitBoard, Cpu, Layers, ListOrdered, Network } from "lucide-react";
import type { ExecutionResult } from "@tinygpu-trace-lab/simulator";
import { ClassicDetail } from "./ClassicDetail";
import "../styles/trace-architecture.css";

const levels = [
  { id: "GPU Overview", label: "Machine", icon: Network },
  { id: "Core View", label: "Cores", icon: Cpu },
  { id: "Pipeline View", label: "Pipeline", icon: Layers },
  { id: "Register View", label: "Registers", icon: ListOrdered },
  { id: "Logic/Gate View", label: "Gates", icon: CircuitBoard },
] as const;

export type ArchitectureLevel = (typeof levels)[number]["id"];

export function TraceArchitecture({
  result,
  index,
  level,
  onLevel,
  onSeek,
  children,
}: {
  result: ExecutionResult;
  index: number;
  level: ArchitectureLevel;
  onLevel: (level: ArchitectureLevel) => void;
  onSeek: (index: number) => void;
  children: ReactNode;
}) {
  const event = result.trace[index];
  return (
    <section
      className="trace-architecture"
      aria-label="Selected operation architecture"
      data-event-id={event.eventId}
      data-operation-id={event.operationId}
      data-thread-id={event.threadId}
    >
      <div
        className="architecture-levels"
        role="group"
        aria-label="Architecture level"
      >
        {levels.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={level === id}
            onClick={() => onLevel(id)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {level === "GPU Overview" ? (
        children
      ) : (
        <ClassicDetail
          level={level}
          result={result}
          index={index}
          onSeek={onSeek}
        />
      )}
    </section>
  );
}
