import { runExperiment } from "@tinygpu-trace-lab/simulator";

self.onmessage = (event: MessageEvent<unknown>) => {
  try {
    self.postMessage({ report: runExperiment(event.data) });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Experiment failed.",
    });
  }
};
