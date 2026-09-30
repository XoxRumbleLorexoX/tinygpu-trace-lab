import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircuitBoard, Download } from "lucide-react";
import type { ExecutionResult } from "@tinygpu-trace-lab/simulator";
import { WaveformLab, type Waveform } from "./WaveformLab";
import { KernelEvidence } from "./KernelEvidence";

interface HardwareReport {
  generatedAt: string;
  status: string;
  tool: string;
  sourceHash: string;
  checked: number;
  mismatches: number;
  scope: string;
  waveform: Waveform;
  samples: Array<{
    opcode: string;
    left: number;
    right: number;
    expected: number;
    actual: number;
    eventIndex: number | null;
    time: number;
    instruction?: string;
    threadId?: number;
    kind: string;
  }>;
}

export function HardwareLab({ result }: { result: ExecutionResult | null }) {
  const [report, setReport] = useState<HardwareReport | null>(null);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(2),
    [right, setRight] = useState(4);
  const [selected, setSelected] = useState(0);
  const [selectedSample, setSelectedSample] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}hardware-validation.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error("No hardware validation report is available.");
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data.samples) || data.sourceHash?.length !== 64)
          throw new Error("Invalid hardware report.");
        setReport(data);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => controller.abort();
  }, []);
  const arithmetic = useMemo(
    () =>
      result?.trace.filter(
        (event) =>
          event.stage === "Execute" &&
          ["ADD", "SUB", "MUL", "DIV"].includes(event.opcode),
      ) ?? [],
    [result],
  );
  const bits = useMemo(() => {
    let carry = 0;
    return Array.from({ length: 8 }, (_, bit) => {
      const a = (left >> bit) & 1,
        b = (right >> bit) & 1,
        carryIn = carry;
      const xor = a ^ b;
      const sum = xor ^ carryIn;
      carry = (a & b) | (carryIn & xor);
      return { bit, a, b, carryIn, xor, sum, carry };
    });
  }, [left, right]);
  return (
    <section className="hardware-lab">
      <div className="graph-toolbar">
        <div>
          <h2>
            <CircuitBoard size={21} />
            8-bit arithmetic laboratory
          </h2>
          <p>Unsigned byte arithmetic. The carry beyond bit 7 is discarded.</p>
        </div>
        <span className="hardware-scope">
          ALU COMPONENT / NOT FULL GPU TIMING
        </span>
      </div>
      <div className="adder-controls">
        <label>
          Input A
          <input
            aria-label="Adder input A"
            type="number"
            min="0"
            max="255"
            value={left}
            onChange={(e) => {
              const n = e.currentTarget.valueAsNumber;
              if (Number.isInteger(n) && n >= 0 && n <= 255) setLeft(n);
            }}
          />
        </label>
        <strong>+</strong>
        <label>
          Input B
          <input
            aria-label="Adder input B"
            type="number"
            min="0"
            max="255"
            value={right}
            onChange={(e) => {
              const n = e.currentTarget.valueAsNumber;
              if (Number.isInteger(n) && n >= 0 && n <= 255) setRight(n);
            }}
          />
        </label>
        <strong>=</strong>
        <div className="adder-result">
          <strong>{(left + right) & 255}</strong>
          <span>
            {left + right > 255 ? "Overflow: carry out = 1" : "Carry out = 0"}
          </span>
        </div>
      </div>
      <div className="bit-grid">
        {[...bits].reverse().map((bit) => (
          <button
            key={bit.bit}
            className={selected === bit.bit ? "selected" : ""}
            onClick={() => setSelected(bit.bit)}
            aria-label={`Inspect adder bit ${bit.bit}`}
          >
            <small>BIT {bit.bit}</small>
            <span>
              {bit.a} + {bit.b}
            </span>
            <strong>{bit.sum}</strong>
            <small>
              carry {bit.carryIn} / {bit.carry}
            </small>
          </button>
        ))}
      </div>
      <div className="gate-detail">
        <div>
          <span className="eyebrow">FULL ADDER / BIT {selected}</span>
          <h3>XOR, AND, OR</h3>
        </div>
        <code>
          sum = ({bits[selected].a} XOR {bits[selected].b}) XOR{" "}
          {bits[selected].carryIn} = {bits[selected].sum}
        </code>
        <code>
          carry = (A AND B) OR (carry-in AND (A XOR B)) = {bits[selected].carry}
        </code>
      </div>
      <section className="trace-alu-operands">
        <h3>Arithmetic from the current program</h3>
        <select
          aria-label="Load arithmetic operands"
          defaultValue=""
          onChange={(e) => {
            const event = arithmetic[Number(e.currentTarget.value)];
            if (event?.operands.length >= 2) {
              setLeft(((event.operands[0].value % 256) + 256) % 256);
              setRight(((event.operands[1].value % 256) + 256) % 256);
            }
          }}
        >
          <option value="" disabled>
            Choose source operands
          </option>
          {arithmetic.map((event, i) => (
            <option key={event.eventId} value={i}>
              T{event.threadId} / {event.instruction} /{" "}
              {event.operands.map((operand) => operand.value).join(", ")}
            </option>
          ))}
        </select>
        <p>
          The gate view performs ADD on the selected operands; it does not
          implement MUL, DIV, or a transistor model.
        </p>
      </section>
      <KernelEvidence />
      <section className="hardware-evidence">
        <h2>ALU component / hardware-generated evidence</h2>
        {error ? (
          <p role="status">{error}</p>
        ) : !report ? (
          <p role="status">Loading validation evidence...</p>
        ) : (
          <>
            <div className="evidence-heading">
              <span
                className={report.mismatches === 0 ? "verified" : "lab-error"}
              >
                <CheckCircle2 size={18} />
                {report.checked} cases / {report.mismatches} mismatches
              </span>
              <a
                href={`${import.meta.env.BASE_URL}hardware-validation.json`}
                download
              >
                <Download size={15} />
                JSON report
              </a>
              <a
                href={`${import.meta.env.BASE_URL}hardware-waveform.vcd`}
                download
              >
                <Download size={15} />
                VCD waveform
              </a>
            </div>
            <p>{report.scope}</p>
            <dl>
              <dt>Simulator</dt>
              <dd>{report.tool}</dd>
              <dt>Generated</dt>
              <dd>{report.generatedAt}</dd>
              <dt>Preserved ALU SHA-256</dt>
              <dd>
                <code>{report.sourceHash}</code>
              </dd>
            </dl>
            <WaveformLab
              bundled={report.waveform}
              selectedTime={report.samples[selectedSample]?.time}
            />
            <p className="hardware-source-event">
              {report.samples[selectedSample]?.instruction
                ? `Bundled source: T${report.samples[selectedSample].threadId} / ${report.samples[selectedSample].instruction} / event ${report.samples[selectedSample].eventIndex}`
                : `Control or boundary fixture: ${report.samples[selectedSample]?.kind}`}
            </p>
            <a
              href={`${import.meta.env.BASE_URL}hardware-teaching-trace.json`}
              download
            >
              Bundled teaching trace
            </a>
            <div className="hardware-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Instruction</th>
                    <th>A</th>
                    <th>B</th>
                    <th>Expected</th>
                    <th>HDL result</th>
                    <th>Hardware sample</th>
                  </tr>
                </thead>
                <tbody>
                  {report.samples.slice(0, 32).map((sample, i) => (
                    <tr
                      key={i}
                      className={selectedSample === i ? "selected-sample" : ""}
                    >
                      <td>{sample.opcode}</td>
                      <td>{sample.left}</td>
                      <td>{sample.right}</td>
                      <td>{sample.expected}</td>
                      <td>{sample.actual}</td>
                      <td>
                        <button
                          aria-label={`Inspect hardware sample ${i + 1}`}
                          onClick={() => setSelectedSample(i)}
                        >
                          {sample.time} ns / {sample.kind}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="evidence-limits">
              This stored report covers its bundled test vectors, not every
              edited program. Agreement validates ALU outputs only: memory
              controllers, complete kernels and scheduling are outside this ALU
              report. The separate kernel report has its own coverage.
            </p>
          </>
        )}
      </section>
    </section>
  );
}
