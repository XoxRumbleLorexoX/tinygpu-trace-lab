# Implementation Status

Updated September 16, 2026 (Europe/London). This records the current implementation, not completion of every ambition in GOAL.md or the original specification.

| Roadmap stage            | Implemented                                                                                                                                                                  | Remaining gate or boundary                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Traceable first lesson   | Vector-add prediction, synchronized state, load/add/store checkpoints, rewind, input edits, 2D/3D                                                                            | Human explanation quality needs observation                |
| Guided learning lab      | Six runnable lessons with reference outputs, prediction checks and experiments                                                                                               | Four-of-five beginner target has not been tested           |
| Genuine model comparison | Sequential, SIMD and SIMT schedules; identical reference outputs; configurable width                                                                                         | Teaching scheduling only, no vendor timing                 |
| Extraction and mapping   | Editable teaching-assembly studio, observed-path graphs, backward/forward provenance, source-line replay, two scheduling policies, configurable units, systolic matrix model | No arbitrary-language or all-path extraction               |
| Hardware exploration     | Ripple-carry ADD, 31-case preserved-ALU comparison, full-GPU baseline/experiment reports, source-linked commits and transfers, observed scheduler signals, VCD import        | Original GPU fails; passing experiment covers one workload |

## Verification

- `npm test`: 53 passing simulator, replay, lesson, graph, systolic, program-experiment and stored hardware-evidence tests. Kernel tests verify source adaptations, raw logs, hashes, waveform/commit agreement and baseline failure separately from the experiment.
- `npm run test:browser`: 32 passing checks against the development server and 32 against the production build using `LAB_TEST_URL=http://127.0.0.1:5176/tinygpu-trace-lab/`. Covers guided execution, model comparison, provenance, waveform import, trace import, classic replay, 3D pixels, motion, orbit, layout, kernel source variants, source-linked commits/transfers and unavailable evidence. The eight studio checks cover editable programs, assertions, loop extraction, source navigation, replay, portable files, invalid input, event limits and model-order disagreements. All eight also passed on development after the final long-source navigation refinement.
- Desktop (1440 x 1000) and mobile (390 x 844) screenshots reviewed, including studio graphs and loop replay. Additional layout checks cover 320px, 768px and 1920px widths across learning, comparison, graph, hardware and studio views. Compact 2D labels and circuit selection are checked at 320px.
- `npm run typecheck` and `npm run build`: passed. The main production JavaScript bundle is 1,104.89 kB before gzip (307.38 kB compressed); the experiment worker is 17.20 kB before gzip. Vite's large-chunk warning remains. Lazy loading is a future performance improvement, not a completed optimization.
- `npm run validate:hardware`: Icarus Verilog 13.0 executed 31 ALU cases with zero mismatches, distinct from testing stored artifacts.
- `npm run validate:kernel`: Verilator 5.052 executed three compatibility-baseline fixtures, all timing out at the first load after 4,096 clock periods. The command correctly returns exit status 1 and retains the failed reports.
- `npm run validate:kernel:experiment`: three fixtures pass with 28 register commits, 12 memory transfers, nine fetches and four outputs each. Default and overflow complete in 145 testbench clock periods; delayed memory takes 175. Both source variants include 11 explicit compatibility adaptations in temporary copies; the experiment adds a separately disclosed scheduler-accumulator reset. No original HDL is edited.
- Original GPU specification suffix SHA-256 remains `bb88e58b125a77c4223ce666fd1bf2a852b1aee35d3fef034378a2a9e2f30657`; preserved ALU source SHA-256 remains `7179e3d819e6963c36db60b08eeef436c3abc893fa786795ce13797b6e7f8c9a`.
- Browser screenshots are written under `test-results/`; see [Screenshots](screenshots.md).

Automated checks verify behavior, not whether a beginner understands it. No public deployment, real-user study, vendor benchmark or general/unmodified-GPU validation is claimed. The passing experiment is narrow, source-variant-specific evidence.

The [Roadmap Evidence Audit](roadmap-evidence.md) maps the numbered gates and supporting requirements to their current evidence. It separately records missing learner observations, incomplete keyboard/screen-reader and multilevel-navigation verification, and unverified external publication. This status table is not a declaration that those requirements are complete.

## Keyboard Audit

The [Keyboard Workflow Audit](keyboard-audit.md) exercised key learning, graph, comparison, studio, hardware and classic workflows using keyboard-only actions in local headless Chromium. Four findings remain: graph source navigation keeps the previously inspected thread, the same transition loses keyboard focus, narrow graph nodes can remain partly clipped when focused, and the classic comparison selector lacks an accessible name. The Thread 3 source-navigation reproduction shows Thread 0's result until the user manually selects Thread 3; this limits the source-linked navigation claim above.

The exploratory record contains 25 passed checks, seven failed observations across those four findings and five superseded probes. No browser page errors were captured. These observations are not a new full regression run or accessibility certification; real screen-reader and learner sessions remain unperformed. This increment changes documentation and generated audit evidence only, not application code.

## Architecture Navigation

The [Selection Continuity Audit](selection-continuity.md) adds six passing local learning-view transitions and two confirmed classic-view gaps. The classic Abstraction buttons only change selected styling; they do not render another detail level. Leaving Classic explorer resets its replay and abstraction state on return. These findings contradict a claim of complete multilevel exploration, even though the tested learning view preserves Thread 3, writeback position and Registers inspection across 2D/3D and laboratory-tab round trips. Application fixes remain outside the current documentation-only scope.

## Editable Computation Extraction

[Program Studio](program-studio.md) accepts teaching assembly, initial memory, expected-memory assertions and execution settings. Sequential, SIMD and SIMT execute independently. Expected-value matches, final-state agreement and graph equivalence are separate checks; unsupported SIMD branches and differing shared-memory results remain visible.

Completed runs expose source-linked dependency graphs and historical replay. Both graph policies are verified with 1, 2, 4 and 8 units before exploration. The counted-loop example produces six at address 200; the shared-memory example deliberately produces private outputs `[1, 2]` under Sequential versus `[1, 1]` under SIMT.

Work is bounded to 16 threads and 2,500 events per model inside a cancellable worker. Incomplete runs retain partial replay but cannot claim verified assertions or graph extraction. Portable files contain configuration only; imports validate and rerun rather than trusting supplied results. Drafts survive laboratory-tab changes, not page reloads.

## Hardware Finding

The original source first fails compilation. The compatibility copy then stalls in WAIT because `any_lsu_waiting` retains 1 after the LSUs finish. Default raw VCD data shows the last LSU finishing at 285 ns; the accumulator stays high to timeout. Resetting the accumulator on every WAIT evaluation in a separate experimental copy allows the same workload to complete. The browser exposes both outcomes, exact source changes and downloads. See [Hardware](../hardware/README.md) for reproduction and limits.

## Next Evidence Gate: Beginner Study

Recruit five people unfamiliar with GPU execution. Start each at Follow a sum with default inputs; provide no outside explanation. Record elapsed time, checkpoints reached, wrong predictions, confusing labels and help requested. Ask each participant to explain load/add/store, register commit timing and why changing A[0] affects only C[0].

The target is at least four participants completing within ten minutes and correctly explaining load/add/store. Results are pending. Do not mark this gate passed using automated browser tests.

Use the [Beginner Study Protocol](beginner-study.md) and [Session Record](beginner-study-session.md) for a fixed-build, five-person cohort. Primary scoring requires both visible completion and independent explanations; rewind, changed-input causality and register commit timing are separate post-task transfer checks. No participant sessions have been conducted or fabricated by this documentation pass.

## Longer-Term Work

Extend HDL coverage beyond the single vector-add experiment separately from richer memory/timing models, parallel reduction/scan algorithms, larger matrices, direct graph authoring, additional language frontends and arbitrary-language extraction. Editable teaching-assembly programs are implemented; broader language and all-path extraction remain research work. Each extension needs reference semantics and reproducible tests before new performance claims.
