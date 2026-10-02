import { useMemo } from "react";
import { ArrowRight, Cpu } from "lucide-react";
import {
  executionModels,
  stateAt,
  type ExecutionResult,
} from "@tinygpu-trace-lab/simulator";
import { abstractionLevels, pipelineStages } from "../data/views";
import { AdderCircuit } from "./AdderCircuit";
import "../styles/classic-detail.css";

export function ClassicDetail({
  level,
  result,
  index,
  onSeek,
}: {
  level: (typeof abstractionLevels)[number];
  result: ExecutionResult;
  index: number;
  onSeek: (index: number) => void;
}) {
  const event = result.trace[index];
  const snapshot = useMemo(() => stateAt(result, index), [result, index]);
  const thread = snapshot.threads.find(
    (item) => item.threadId === event.threadId,
  )!;
  const operation = result.trace.flatMap((item, i) =>
    item.operationId === event.operationId ? [{ event: item, index: i }] : [],
  );
  const execute = operation.find(
    (item) => item.event.stage === "Execute",
  )?.event;
  const writeback = operation.find((item) => item.event.stage === "Writeback");
  const left = execute?.operands[0]?.value;
  const right = execute?.operands[1]?.value;
  const byteOperands =
    left !== undefined &&
    right !== undefined &&
    Number.isInteger(left) &&
    Number.isInteger(right) &&
    left >= 0 &&
    left <= 255 &&
    right >= 0 &&
    right <= 255;

  return (
    <section className="classic-detail" aria-label={level}>
      <header className="classic-detail-heading">
        <h2>{level}</h2>
        <span>
          Thread {event.threadId} / Core {event.coreId} / PC {event.pc}
        </span>
      </header>
      {level === "Core View" && (
        <>
          <div className="classic-cores">
            {Array.from({ length: result.options.coreCount }, (_, coreId) => (
              <section key={coreId} aria-label={`Core ${coreId} lanes`}>
                <h3>
                  <Cpu size={18} /> Core {coreId}
                </h3>
                {snapshot.threads
                  .filter((lane) => lane.coreId === coreId)
                  .map((lane) => (
                    <div
                      key={lane.threadId}
                      aria-current={
                        lane.threadId === event.threadId ? "true" : undefined
                      }
                      className={`classic-lane ${event.activeThreads.includes(lane.threadId) ? "issuing" : ""}`}
                    >
                      <strong>T{lane.threadId}</strong>
                      <span>Warp {lane.warpId}</span>
                      <code>PC {lane.pc}</code>
                      <span>
                        {lane.threadId === event.threadId ? "Selected / " : ""}
                        {lane.complete
                          ? "Complete"
                          : event.activeThreads.includes(lane.threadId)
                            ? event.stage
                            : "Waiting"}
                      </span>
                    </div>
                  ))}
              </section>
            ))}
          </div>
          <p>
            {executionModels[result.options.model].description} Core assignments
            group the recorded threads; they do not model simultaneous core
            execution or hardware latency.
          </p>
        </>
      )}
      {level === "Pipeline View" && (
        <>
          <code className="classic-operation">{event.instruction}</code>
          <ol className="classic-pipeline">
            {pipelineStages.map((stage) => {
              const source = operation.find(
                (item) => item.event.stage === stage,
              );
              return (
                <li key={stage}>
                  <button
                    disabled={!source}
                    aria-current={event.stage === stage ? "step" : undefined}
                    onClick={() => source && onSeek(source.index)}
                  >
                    <strong>{stage}</strong>
                    <span>
                      {source?.event.activeComponent ?? "Not recorded"}
                    </span>
                    <small>{source ? `Event ${source.index + 1}` : "--"}</small>
                  </button>
                </li>
              );
            })}
          </ol>
          <p>{event.explanatoryText}</p>
          <p>
            One recorded instruction across five logical stages, not five
            simultaneous hardware instructions.
          </p>
        </>
      )}
      {level === "Register View" && (
        <>
          <div className="classic-registers">
            {Object.entries(thread.registers).map(([name, value]) => {
              const diff = event.registerDiff.find(
                (item) => item.register === name,
              );
              const read = execute?.operands.some(
                (operand) => operand.name === name,
              );
              return (
                <div
                  key={name}
                  className={diff ? "committed" : read ? "read" : ""}
                >
                  <span>{name}</span>
                  <strong>{value}</strong>
                  <small>
                    {diff
                      ? `${diff.before} to ${diff.after} / committed`
                      : read
                        ? "Source operand"
                        : "Retained"}
                  </small>
                </div>
              );
            })}
          </div>
          <p>
            Values include commits through event {index + 1}. An ALU result is
            not a register update until Writeback.
          </p>
          {writeback && (
            <button
              className="classic-command"
              onClick={() => onSeek(writeback.index)}
            >
              <ArrowRight size={16} />
              {writeback.event.registerDiff.length
                ? "Inspect register commit"
                : writeback.event.memoryDiff.length
                  ? "Inspect memory commit"
                  : "Inspect writeback"}
            </button>
          )}
        </>
      )}
      {level === "Logic/Gate View" && (
        <>
          <code className="classic-operation">{event.instruction}</code>
          {event.opcode === "ADD" && byteOperands ? (
            <>
              <div
                className="classic-equation"
                aria-label="Selected ADD operands"
              >
                <span>{left}</span>
                <span>+</span>
                <span>{right}</span>
                <ArrowRight size={20} />
                <strong>{(left + right) & 255}</strong>
                <small>8-bit sum</small>
              </div>
              <AdderCircuit left={left} right={right} />
              <p>
                Carry out: {left + right > 255 ? 1 : 0}. Recorded{" "}
                {result.options.numberMode} result:{" "}
                {execute?.resultValue ?? "not recorded"}.
                {left + right > 255 && result.options.numberMode === "integer"
                  ? " The 8-bit circuit wraps; the integer simulator does not."
                  : " Both results agree for these operands."}
              </p>
              <p>
                Combinational ADD derived from this operation's operands. No
                gate delays, transistor model, or HDL validation is implied.
                Replay remains at {event.stage}.
              </p>
            </>
          ) : (
            <p role="status">
              No gate implementation for{" "}
              {event.opcode === "ADD"
                ? "ADD operands outside 0-255"
                : event.opcode}
              . The circuit covers unsigned 8-bit ADD only; this operation
              remains selected.
            </p>
          )}
        </>
      )}
    </section>
  );
}
