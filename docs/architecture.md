# Architecture

## Execution Before Rendering

`simulator/src/index.ts` exports the active engine from `execution.ts`. The older `engine.ts` remains preserved but is not exported or used by the learning lab or classic explorer. New behavior belongs in the active engine; importing the old file directly is unsupported.

`parser.ts` validates the teaching assembly. `lessons.ts` supplies six programs, input constraints, reference outputs and lesson questions. `execution.ts` implements functional instruction semantics, scheduling, event emission and replay without React or browser dependencies.

## Three Execution Models

| Model      | Issue selection                                                                  | Boundary                                                          |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Sequential | One thread runs to completion, then the next thread starts                       | One available lane per issue                                      |
| SIMD       | A group shares a PC and executes a straight-line program before the next group   | Any branch instruction is rejected                                |
| SIMT       | Groups rotate; unfinished lanes at the selected group's lowest PC issue together | Other lanes are masked; no vendor reconvergence or fairness claim |

All models share the functional ISA and numeric rules. They use different scheduling paths, not scaled copies of one trace. Lane width changes group membership and issue counts. Core IDs identify placement; additional cores do not introduce simultaneous issue or a throughput model.

Each issue has five logical stages: Fetch, Decode, Execute, Memory, Writeback. Active lanes emit separate events at the same tick. Operands are captured before the issue executes. Stores commit during Memory; register values, comparison flags, PCs and completion commit during Writeback. Concurrent writes to the same address within an issue are rejected. Across issues, the selected deterministic ordering applies; this is not a general data-race detector.

`stateAt(result, eventIndex)` rebuilds state from the initial snapshot and committed diffs. The learning UI selects the final event of a tick for a complete lane-group snapshot, while its inspector can focus on an individual lane.

## Numeric And Memory Rules

- `integer`: finite safe JavaScript integers; arithmetic outside the safe range throws.
- `uint8`: data operands and results wrap modulo 256; division truncates toward zero after operand normalization. Addresses remain separate 16-bit-range indices. Used for the hardware arithmetic fixture.
- Division by zero is rejected, not silently converted to zero.
- Comparisons produce N/Z/P from the operands. This is not claimed equivalent to tiny-gpu's hardware NZP encoding.
- Flat memory uses addresses 0 through 65535; unread initialized-or-absent locations return their value or zero. No caches, access latency, contention or memory hierarchy timing.
- Lesson inputs contain four integers in [-1000, 1000]. A starts at address 0, B at 64, C at 128.
- `maxCycles` is a retained option name for an event budget. An issue is emitted completely or not at all. Incomplete runs return `status: 'limit'`.

## Computation Extraction

`graph.ts` extracts one node per completed lane operation. It preserves value dependencies, memory read/write ordering and observed branch dependencies. Nodes retain source PCs, instruction text, thread IDs and trace event links.

The graph is explicitly `observed-path`: changing inputs or control flow requires a new execution and extraction. It is not a compiler, symbolic analyzer or arbitrary-language extractor.

`scheduleGraph` evaluates ready nodes on 1-32 abstract units using source-order or longest-remaining-path priority. Each node occupies one abstract tick. Every computed value is checked against the captured source result. These ticks are not comparable to the five-stage execution model's ticks. `ancestorsOf` traces backward; `consumersOf` follows dependent work forward.

`simulateSystolic` is a separate 2 x 2 matrix model. Skewed row/column inputs reach four processing elements over four abstract ticks; eight multiply-accumulates produce four outputs. It does not model memory bandwidth or a vendor tensor unit.

## Browser Views

`experiment.ts` validates portable custom programs, executes each model independently and distinguishes expected-memory assertions from cross-model final-state agreement. Completed runs must also pass both graph policies at 1, 2, 4 and 8 units before the studio enables extraction. Work is bounded to 16 threads and 2,500 events per model. Failed models, incomplete runs and graph disagreements remain separate results.

`ProgramStudio` owns editable assembly and memory, retains drafts across laboratory tabs, and uses a disposable worker with cancellation and a timeout. Source instructions carry optional one-based `lineNumber` metadata, including comments and standalone-label offsets. Imported experiments are validated and re-executed; supplied reports are ignored. The studio replays individual lane events, rather than the guided lesson's grouped ticks. See [Program Studio](program-studio.md).

`LearningLab` owns lesson inputs, model selection, playback, prediction state and historical inspection. `LabArchitecture` offers matching 2D and Three.js views with reduced motion. `GraphLab` presents dependencies, remapping and the systolic model. `HardwareLab` provides gate arithmetic and checked-in hardware evidence; `WaveformLab` imports bounded captures in an isolated, disposable worker.

The classic explorer retains its earlier layout. Its warp states now come from replay snapshots. Unsupported metrics are labeled rather than shown as invented measurements.

## Hardware Boundary

`hardware/original` is preserved. The separate testbench and `scripts/validate-hardware.mjs` execute its ALU with Icarus Verilog. Generated samples are compared to unsigned-byte teaching results and published as static JSON/VCD assets. Only linked bundled samples have a validated source mapping. Imported VCDs remain unmapped.

No runtime backend or HDL compiler is required to use the browser app. HDL tools are needed only to regenerate evidence. See [Hardware](../hardware/README.md) for scope and reproduction.
