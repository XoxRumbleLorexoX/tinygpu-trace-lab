# Hardware

`hardware/original` contains the upstream `adam-maj/tiny-gpu` SystemVerilog source files from `src` on the `master` branch.

The simulator in this repository mirrors the teaching concepts from these files, while keeping the hardware source untouched for future HDL experiments and deeper architecture views.

## Reproduce The ALU Comparison

Install Icarus Verilog so `iverilog` and `vvp` are on `PATH`. With npm dependencies installed, run from the project root:

```bash
npm run validate:hardware
```

The script compiles `hardware/original/alu.sv` with the separate `hardware/validation/alu_trace_tb.sv`. It derives vector-add arithmetic operands from a `uint8` teaching run, adds boundary/control cases, executes the HDL, compares sampled outputs, and writes:

- `web/public/hardware-validation.json`: tool version, source/testbench/waveform SHA-256 hashes, samples, mismatches and explicit scope.
- `web/public/hardware-waveform.vcd`: hardware-generated signals.
- `web/public/hardware-teaching-trace.json`: the source-linked teaching run.

Failed commands or incomplete sample streams fail validation. Mismatched outputs produce a failed report and nonzero exit status. Temporary diagnostics are retained after execution errors. The original HDL files are never edited.

## Evidence Scope

The bundled run uses Icarus Verilog 13.0 and checks 31 cases with zero mismatches: 12 arithmetic events from vector addition, 16 ADD/SUB/MUL/DIV boundary cases, and three disabled-hold, non-EXECUTE-hold and reset cases.

Values are unsigned 8-bit. Overflow wraps modulo 256. The testbench samples outputs after clock edges; VCD units are 1 ns. Sample times are stimulus times, not measurements of real-chip propagation delay or full-kernel runtime.

This validates only the preserved ALU for these vectors. Exclusions: CMP/NZP encoding, division by zero, complete kernels, memory controllers, scheduler and vendor timing. The current editable lesson may differ from the bundled fixture; its changes do not silently alter the stored report. Regenerate evidence explicitly after changing the fixture or testbench.

`npm test` verifies report hashes, source-event operands/results and waveform/sample agreement. It checks the stored evidence; `npm run validate:hardware` is the command that actually runs HDL.

## Imported Waveforms

The full GPU captures below are available as downloads. The browser's bounded general-purpose VCD importer may reject a full GPU capture with too many signals or lines; the kernel inspector uses six extracted diagnostic signals with preserved source names.

The browser uses `vcd-parser@1.0.1` inside a disposable worker, with worker-local compatibility globals for its Node callback scheduling and undeclared parser state. Import limits: 256 KB, 5,000 lines, 64 signals, 64 bits per signal, positive safe-integer duration, ordered timestamps, and a 15-second timeout. Comments and dump-control sections are normalized for the parser. Unsupported/malformed inputs are rejected without replacing the current waveform.

X/Z values, including partially unknown buses, remain unknown. Imported signals have no validated link to teaching events. The ripple-carry gate view implements ADD only; selecting operands from another instruction does not change it into a MUL/DIV or transistor simulator.

## Full-GPU Debugging Experiment

Install Verilator so `verilator` is on `PATH`. From the project root:

```bash
npm run validate:kernel
npm run validate:kernel:experiment
```

Run these separately. The baseline command writes a failed report and returns exit status 1; the experiment returns 0 when every check agrees. `npm test` checks stored evidence, not a fresh HDL execution.

The testbench instantiates the complete GPU: two cores, four threads per block, one program channel, two data channels. One block runs on core 0. The external memory handshake responds after a configurable delay. The clock period is 10 ns; runs stop after completion or a 4,096-period budget.

### Source Variants

The preserved sources cannot compile directly in Verilator 5.052. Their failed lint output is retained in `web/public/kernel-original-compile.log`. The runner creates temporary copies with exactly 11 audited adaptations: five trailing commas removed from parameter/instantiation lists, six unpacked-array zero resets expressed as assignment patterns. Every original and compiled-copy hash, changed line, before/after text and reason is recorded. Anchors must match exactly; source drift fails the adaptation.

The **compatibility baseline** makes no additional execution-logic change. All three fixtures time out: four initial memory reads complete, no register writes commit, PC remains 0 in WAIT. In the default waveform, `any_lsu_waiting` becomes 1 at 155 ns; all four LSUs are Done by 285 ns, but the accumulator never clears. The declaration initializer in `scheduler.sv` does not reset this static variable on every WAIT evaluation.

The **scheduler-reset experiment** adds one explicit behavioral change to its temporary scheduler copy: separate declaration from assignment so `any_lsu_waiting = 1'b0` executes at every WAIT evaluation. It does not change `hardware/original` or replace the baseline report.

| Fixture                     | Baseline               | Scheduler experiment | Experiment outputs |
| --------------------------- | ---------------------- | -------------------- | ------------------ |
| Default                     | TIMEOUT, 4,096 periods | DONE, 145 periods    | 6, 6, 9, 9         |
| Unsigned 8-bit overflow     | TIMEOUT, 4,096 periods | DONE, 145 periods    | 0, 0, 255, 44      |
| Memory delay 3 instead of 1 | TIMEOUT, 4,096 periods | DONE, 175 periods    | 6, 6, 9, 9         |

Each successful fixture matches 28 register commits, 12 memory transfers, nine instruction fetches and four final outputs against the teaching trace. An independent modulo-256 vector sum also checks reference outputs. Commit order, missing/duplicate samples, before/after values and termination are checked; final-output agreement alone is insufficient. These clock-period counts describe this HDL testbench, not a physical GPU benchmark.

### Artifacts And Inspection

- `web/public/kernel-validation.json`: failing compatibility baseline.
- `web/public/kernel-scheduler-reset-validation.json`: separately labeled experiment.
- `web/public/kernel[-scheduler-reset]-<fixture>.vcd`: raw HDL signals.
- `web/public/kernel[-scheduler-reset]-<fixture>.log`: raw monitor output.
- `web/public/kernel[-scheduler-reset]-<fixture>-teaching.json`: reference teaching trace.

The Hardware view includes source selection, fixture selection, output comparisons, source-linked commits/transfers, observed pipeline states and six waveform-derived scheduler/LSU signals. The instruction/event mapping belongs to the bundled fixture, not the currently edited lesson. State-transition log entries are sampled at falling clock edges; register commits are sampled 1 ns after the rising edge. The pipeline description explicitly reports its last state sample; diagnostic signals use their VCD transition times.

Tests verify all source/testbench/artifact hashes, recompare raw monitor logs, compare extracted signals with raw VCD data, and cross-check register commits and instruction fetches against those waveforms. Baseline failure remains an expected regression fixture, not a hidden pass.

Excluded: other kernels, multiple blocks, divergent branches, four-state X/Z equivalence, vendor timing and real devices. Passing the experiment demonstrates this workload under this explicit source variant; it does not validate the unmodified GPU.

## Preserved Components

Preserved components include:

- ALU
- Controller
- Core
- Device Control Register
- Decoder
- Dispatch
- Fetcher
- GPU top level
- LSU
- Program Counter
- Registers
- Scheduler
