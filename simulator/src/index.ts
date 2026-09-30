export {
  simulate,
  stateAt,
  executionModels,
  normalizeNumber,
} from "./execution.js";
export type {
  ExecutionModel,
  ExecutionOptions,
  ExecutionResult,
  ExecutionEvent,
  Operand,
  NumberMode,
} from "./execution.js";
export { parseProgram } from "./parser.js";
export { exampleSources, loadExampleProgram } from "./programs.js";
export type * from "./types.js";
export {
  lessons,
  defaultA,
  defaultB,
  lessonProgram,
  lessonMemory,
  expectedOutput,
  runLesson,
  checkLesson,
} from "./lessons.js";
export type { Lesson, LessonId } from "./lessons.js";
export {
  extractGraph,
  scheduleGraph,
  ancestorsOf,
  consumersOf,
  simulateSystolic,
} from "./graph.js";
export type {
  ComputationNode,
  ComputationGraph,
  GraphStep,
  SystolicCell,
  SystolicStep,
} from "./graph.js";
export {
  experimentLimits,
  validateExperiment,
  runExperiment,
} from "./experiment.js";
export type {
  ProgramExperiment,
  ExperimentRun,
  ExperimentReport,
} from "./experiment.js";
