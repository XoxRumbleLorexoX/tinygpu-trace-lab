# TinyGPU Trace Lab

A visual computation laboratory: predict a result, follow its instructions and values, change an input, compare execution models.

The default workspace combines guided lessons, synchronized 2D/3D architecture views, historical register/memory state, computation graphs, and hardware evidence with a reproducible GPU debugging experiment. Core learning runs locally in the browser without a backend.

The long-term direction is in [GOAL.md](GOAL.md). Current evidence and remaining gates are in [Implementation Status](docs/implementation-status.md).

## Repository Layout

- `hardware/original` - preserved upstream `adam-maj/tiny-gpu` SystemVerilog source.
- `simulator` - deterministic TypeScript execution models, lessons, graph extraction and scheduling.
- `web` - React + Vite + TypeScript + React Three Fiber frontend.
- `examples` - preserved assembly examples; the six guided lessons live in `simulator/src/lessons.ts`.
- `docs` - architecture notes, trace schema, tutorials, glossary, and screenshots.
- `.github/workflows/pages.yml` - GitHub Pages build and deployment.

## Quick Start

Use Node.js 22 and npm. From the project root:

```bash
npm ci
npm run dev
```

Then open the Vite URL printed by the command.

## Validation

```bash
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests cover desktop and mobile. The Playwright configuration starts Vite on port 5175 unless a server already exists there. On a Linux CI host, install Chromium's system dependencies with `npx playwright install --with-deps chromium`.

Optional hardware validation requires `iverilog` and `vvp` on `PATH`:

```bash
npm run validate:hardware
```

The checked-in hardware report works without an HDL toolchain. This command regenerates evidence by executing the preserved ALU, not by running a complete GPU. See [Hardware](hardware/README.md).

Full-GPU vector-add evidence requires Verilator on `PATH`:

```bash
npm run validate:kernel
npm run validate:kernel:experiment
```

The first command intentionally exits nonzero: the compatibility baseline stalls in the scheduler. The second runs a separately labeled scheduler-reset experiment and passes all three fixtures. Both use temporary source copies with 11 explicit compatibility adaptations; the experiment applies one additional behavioral change. `hardware/original` is never modified. These are separate reports, not a claim that the original GPU passes.

Generate fresh trace JSON for every bundled program with:

```bash
npm --workspace simulator run export:examples
```

## Learning Workspace

- Six runnable lessons: vector addition, dependent arithmetic, branching, reduction, prefix sum, 2 x 2 matrix multiplication.
- Prediction checks, load/compute/store checkpoints, editable inputs, observable lesson completion.
- Synchronized program, operands, register state, memory state, thread lanes, playback and rewind.
- Sequential, SIMD and SIMT schedules with measured issue counts and lane utilization within the teaching model.
- Output ancestry and input consumers extracted from the executed path; source-linked nodes replayed with two scheduling policies and configurable processing units.
- A [program studio](docs/program-studio.md) for editable assembly, memory assertions, independent model runs, observed-path graph extraction, source-line replay and portable experiment files. Includes counted-loop and shared-memory-order examples.
- A four-cell systolic matrix model with real multiply-accumulate wavefronts.
- An interactive 8-bit ripple-carry adder, reproducible ALU comparison report, linked waveform samples, bounded VCD import.
- A full-GPU debugging experiment: baseline deadlock, explicit scheduler-reset variant, source-linked commits/transfers, observed pipeline and LSU states, overflow and delayed-memory fixtures, downloadable raw evidence.
- Lesson trace export/import. Import validates configuration and reruns the simulation instead of trusting recorded results.
- The original explorer remains available in its own tab.

Start with the [Tutorial](docs/tutorial.md). Engine details: [Architecture](docs/architecture.md), [Trace Format](docs/trace-format.md).

## Fidelity Limits

Logical stages are not hardware clock cycles. Cache behavior, memory latency, hardware occupancy and vendor performance are not modeled. SIMD supports straight-line programs only. Graph extraction captures one executed path, not arbitrary source-language programs or all possible branches. Reduction and prefix sum intentionally use serial reference algorithms.

The unmodified ALU passes its component checks. Full-GPU evidence distinguishes a failing compatibility baseline from a passing scheduler-reset experiment on one four-thread vector-add block. General kernel correctness, multi-block behavior, branch divergence, transistor behavior and real-device timing remain unvalidated. Beginner usability targets have not yet been tested with people.

## Instruction Set

Registers: `R0` through `R12` plus `%blockIdx`, `%blockDim`, and `%threadIdx`.

Supported instructions: `ADD`, `SUB`, `MUL`, `DIV`, `CMP`, `BRnzp`, `LDR`, `STR`, `CONST`, `RET`.

## Hardware Preservation

The original SystemVerilog files were copied from `https://github.com/adam-maj/tiny-gpu/tree/master/src` into `hardware/original` so the educational simulator can evolve without replacing the hardware implementation.
