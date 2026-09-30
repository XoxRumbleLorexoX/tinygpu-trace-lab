import { useEffect, useRef, useState } from "react";
import { Upload, RotateCcw } from "lucide-react";

export interface Waveform {
  scale: string;
  endtime: number;
  signals: Array<{
    name: string;
    signalName: string;
    size: number;
    wave: [string, string][];
  }>;
}

export function WaveformLab({
  bundled,
  selectedTime,
}: {
  bundled: Waveform;
  selectedTime?: number;
}) {
  const [imported, setImported] = useState<Waveform | null>(null);
  const [cursor, setCursor] = useState(selectedTime ?? 0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<number>();
  const waveform = imported ?? bundled;
  useEffect(() => {
    if (!imported && selectedTime !== undefined) setCursor(selectedTime);
  }, [selectedTime, imported]);
  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );
  async function load(input?: File) {
    if (!input) return;
    if (input.size > 256000) {
      setError("VCD exceeds 256 KB.");
      return;
    }
    worker.current?.terminate();
    clearTimeout(timer.current);
    setLoading(true);
    setError("");
    const parser = new Worker(
      new URL("../workers/waveform.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = parser;
    const finish = () => {
      parser.terminate();
      clearTimeout(timer.current);
      setLoading(false);
      if (file.current) file.current.value = "";
    };
    parser.onmessage = (event) => {
      finish();
      if (event.data.error) setError(event.data.error);
      else {
        setImported(event.data.waveform);
        setCursor(0);
      }
    };
    parser.onerror = () => {
      finish();
      setError("Unsupported or malformed VCD waveform.");
    };
    timer.current = window.setTimeout(() => {
      finish();
      setError("Waveform parsing exceeded 15 seconds. Use a smaller capture.");
    }, 15000);
    try {
      parser.postMessage(await input.text());
    } catch {
      finish();
      setError("Cannot read waveform.");
    }
  }
  const scaleX = (time: number) => 205 + (time / waveform.endtime) * 700;
  return (
    <section className="waveform-lab">
      <div className="graph-toolbar">
        <div>
          <h3>
            {imported ? "Imported waveform / unmapped" : "Bundled ALU waveform"}
          </h3>
          <p>
            Signal values at hardware time {cursor} x {waveform.scale}. X/Z
            remain unknown, not zero.
          </p>
        </div>
        <div className="waveform-actions">
          <button disabled={loading} onClick={() => file.current?.click()}>
            <Upload size={15} />
            {loading ? "Parsing..." : "Import VCD"}
          </button>
          {imported && (
            <button
              onClick={() => {
                setImported(null);
                setCursor(selectedTime ?? 0);
                setError("");
              }}
            >
              <RotateCcw size={15} />
              Bundled trace
            </button>
          )}
          <input
            ref={file}
            aria-label="VCD file"
            type="file"
            accept=".vcd"
            hidden
            onChange={(event) => void load(event.currentTarget.files?.[0])}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="lab-error">
          {error}
        </p>
      )}
      <input
        aria-label="Hardware waveform time"
        type="range"
        min={0}
        max={waveform.endtime}
        value={cursor}
        onChange={(event) => setCursor(Number(event.currentTarget.value))}
      />
      <div className="waveform-canvas">
        <svg
          width="945"
          height={waveform.signals.length * 42 + 32}
          role="img"
          aria-label="Hardware signal waveform"
        >
          {waveform.signals.map((signal, row) => {
            const y = row * 42 + 20;
            const value =
              signal.wave
                .filter(([time]) => Number(time) <= cursor)
                .at(-1)?.[1] ?? "x";
            const display = /^[01]+$/.test(value)
              ? BigInt(`0b${value}`).toString()
              : value;
            return (
              <g key={signal.name}>
                <text x="0" y={y} fontSize="10" fill="#536d5d">
                  {signal.signalName.length > 22
                    ? signal.signalName.slice(0, 21) + "..."
                    : signal.signalName}
                  <title>{signal.name}</title>
                </text>
                <text
                  x="185"
                  y={y}
                  textAnchor="end"
                  fontSize="10"
                  fill="#215d3b"
                >
                  {display.length > 7 ? display.slice(0, 6) + "..." : display}
                  <title>{display}</title>
                </text>
                <line
                  x1="205"
                  x2="905"
                  y1={y + 6}
                  y2={y + 6}
                  stroke="#dbe5dd"
                />
                {signal.wave.map(([time, bits], i) => {
                  const start = Number(time),
                    end = Number(signal.wave[i + 1]?.[0] ?? waveform.endtime);
                  const x = scaleX(start),
                    next = scaleX(end),
                    high = signal.size === 1 && bits === "1";
                  const known = /^[01]+$/.test(bits);
                  const text = known ? BigInt(`0b${bits}`).toString() : bits;
                  return signal.size === 1 && known ? (
                    <path
                      key={i}
                      d={`M${x},${y + 5} V${high ? y - 13 : y + 5} H${next}`}
                      fill="none"
                      stroke="#318052"
                      strokeWidth="1.5"
                    />
                  ) : (
                    <g key={i} data-unknown={!known || undefined}>
                      <title>{text}</title>
                      <rect
                        x={x}
                        y={y - 14}
                        width={Math.max(0, next - x)}
                        height="22"
                        fill={known ? "#e2eee5" : "#fbe8d2"}
                        stroke={known ? "#95b7a0" : "#b98340"}
                        strokeDasharray={known ? undefined : "3 2"}
                      />
                      {next - x > text.length * 6 + 8 && (
                        <text x={x + 4} y={y + 1} fontSize="9" fill="#325d41">
                          {text}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          <line
            x1={scaleX(cursor)}
            x2={scaleX(cursor)}
            y1="0"
            y2={waveform.signals.length * 42 + 20}
            stroke="#b37c36"
            strokeWidth="2"
          />
        </svg>
      </div>
      {imported && (
        <p className="waveform-limit">
          Imported signals have no validated link to the teaching program.
          Signal inspection only.
        </p>
      )}
    </section>
  );
}
