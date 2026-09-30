# Trace Format

## Version 2

The active `simulate()` result has `schemaVersion: 2` and `modelVersion: 'teaching-1'`. Full TypeScript definitions live in `simulator/src/execution.ts` and `types.ts`.

The result includes parsed `program`, normalized `options`, `initialThreads`, `initialMemory`, `trace`, `finalThreads`, `finalMemory`, `status` and `statistics`. Programs, inputs, model identity, lane width, number mode and event budget reproduce a run deterministically; there is no random seed.

## Indices Are Not Hardware Time

| Field         | Meaning                                                       |
| ------------- | ------------------------------------------------------------- |
| `cycle`       | Legacy field name for the zero-based event index              |
| `eventId`     | `event-<index>`, stable within a reproduced run               |
| `operationId` | `t<thread>-op<count>`, shared by that operation's five stages |
| `issue`       | Zero-based instruction issue                                  |
| `tick`        | `issue * 5 + stageIndex`, a logical stage tick                |
| `timestamp`   | Compatibility alias for `tick`, not milliseconds              |

Multiple lanes have separate events at the same tick. Replaying one event may expose part of a group commit. The learning UI groups by tick and displays the snapshot after its last lane event.

## Event Payload

Events retain `threadId`, `blockId`, `coreId`, `warpId`, source `pc`, `instruction`, `opcode`, `stage`, `activeComponent`, `tokenType`, `tokenPosition` and `explanatoryText`.

`activeThreads` and `maskedThreads` describe the selected group. `operands` capture named register, immediate, address or memory values from before the issue. `resultValue`, when present from Execute onward, is the computed result; its presence does not imply a register has committed.

- `registerDiff`: emitted at Writeback; each entry has `register`, `before`, `after`.
- `memoryDiff`: emitted at Memory; loads contain a before/after read observation. Only `memoryAccess: 'write'` mutates memory.
- `conditionFlags`: flags after this event, not a future CMP result.
- `nextPc` and `complete`: thread state after this event, committed at Writeback.
- `stallReason: 'Divergence'`: compatibility annotation on masked-path Decode events. It does not represent a timed stall.

`stateAt(result, -1)` returns initial state. Valid event indices replay committed diffs. Out-of-range and non-integer indices throw.

## Measured Teaching Statistics

`issues` counts issues, `logicalTicks = issues * 5`, `laneOperations` counts active lane instructions including RET. `activeLaneSlots` counts useful lane slots; `availableLaneSlots` counts one per scalar issue or the configured width per vector/SIMT issue. `laneUtilization` is their ratio, including underfilled groups.

`reads`, `writes` and `divergentIssues` count observed operations or issues. Compatibility `metrics` remain for the classic explorer: `ipc` means lane operations per logical tick, not hardware IPC. `cacheMisses`, `stallCycles`, `occupancy` and `executionTime` are unsupported placeholders; zero does not assert a measurement.

## Lesson Export Envelope

The browser downloads `{ format: 'tinygpu-lesson-1', lessonId, a, b, model, laneWidth, result }`. Import is limited to 5 MB and known lessons, valid four-element arrays, supported models and lane widths 1, 2, 4 or 8.

Import reruns the validated configuration. It ignores the supplied `result` rather than trusting forged events or final values. This lesson envelope does not accept arbitrary external traces, older engine traces or edited assembly.

## Program Experiment Envelope

Edited assembly uses the separate `tinygpu-program-1` format in Program studio. Its document includes `modelVersion: "teaching-1"`, `name`, `source`, `initialMemory`, `expectedMemory`, `blockDim`, `blockCount`, `laneWidth` and `numberMode`. The file contains inputs and assertions, not authoritative recorded results. Imports are limited to 64 KB, validated, then re-executed on all three models. Extra report/trace fields are ignored. Full bounds and examples are in [Program Studio](program-studio.md).

Parsed instructions optionally include one-based `lineNumber` metadata. `pc` still indexes instructions, not source lines. Repeated loop operations can share a PC and source line while retaining distinct `operationId` values.

## Separate Hardware Format

`web/public/hardware-validation.json` uses `format: 'tinygpu-hardware-1'`. Its samples have real testbench timestamps in the reported VCD timescale, plus optional links to the bundled teaching trace. These times are independent of logical ticks. See [Hardware](../hardware/README.md).
