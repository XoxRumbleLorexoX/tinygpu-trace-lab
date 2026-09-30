import parser from "vcd-parser";

// vcd-parser 1.0.1 assigns an undeclared state variable and uses Node's nextTick.
// Isolate both compatibility globals in this single-use worker, never the page.
Object.assign(globalThis, {
  state: 0,
  process: { nextTick: (callback: () => void) => queueMicrotask(callback) },
});
self.onmessage = async (event: MessageEvent<string>) => {
  try {
    const text = event.data;
    if (
      text.length > 256000 ||
      text.split("\n").length > 5000 ||
      !text.includes("$enddefinitions")
    )
      throw new Error(
        "VCD must contain definitions, at most 256 KB and 5,000 lines.",
      );
    const parsed = await parser.parse(
      text
        .replace(/\$comment[\s\S]*?\$end/g, "")
        .replace(/\$(dumpall|dumpon|dumpoff)\b/g, "$dumpvars"),
      { compress: true, expandAmbigousBus: true },
    );
    const endtime = Number(parsed.endtime);
    if (
      !parsed.signal.length ||
      parsed.signal.length > 64 ||
      !Number.isSafeInteger(endtime) ||
      endtime <= 0 ||
      parsed.signal.some(
        (signal) =>
          !Number.isInteger(signal.size) ||
          signal.size < 1 ||
          signal.size > 64 ||
          signal.wave.some(
            ([time, bits], i) =>
              !Number.isSafeInteger(Number(time)) ||
              Number(time) < 0 ||
              Number(time) > endtime ||
              (i > 0 && Number(time) < Number(signal.wave[i - 1][0])) ||
              !/^[01xz]+$/.test(bits) ||
              bits.length > signal.size,
          ),
      )
    )
      throw new Error(
        "Waveform must contain 1-64 signals, each 1-64 bits, ordered timestamps, and a positive duration.",
      );
    self.postMessage({
      waveform: {
        scale: parsed.scale?.trim() ?? "unknown",
        endtime,
        signals: parsed.signal.map((signal) => ({
          ...signal,
          signalName: signal.signalName.replace(/\[.*\]$/, ""),
        })),
      },
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Unsupported or malformed VCD waveform.",
    });
  }
};
