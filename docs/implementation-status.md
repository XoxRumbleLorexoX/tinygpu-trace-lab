# Implementation Status

Updated October 1, 2026 (Europe/London). This records the current implementation, not completion of every ambition in GOAL.md or the original specification.

## Publication Checkpoint

The public repository `XoxRumbleLorexoX/tinygpu-trace-lab` now contains commit `3333dab29b1728bf69f5c4904f644f3daf8d2aed` on `main`; local and remote commit IDs were verified equal. The September 30 publication check reran `npm test` (53 passing), `npm run typecheck` and `npm run build` successfully. The existing Vite bundle-size warning remains. Browser and HDL execution suites were not rerun for this publication check.

GitHub Actions run `36772735773` reached Pages deployment but failed on September 30 at 20:27 UTC with `Failed to create deployment (status: 404)`. The log directs the owner to ensure GitHub Pages is enabled. Source publication is verified; a live website is not. No Pages settings were changed. Application and original specification files were unchanged during publication.

October 1 release recheck, 22:16 UTC: GitHub still lists exactly one workflow
run, the completed failure above; no deployment is currently running. Deploy
job `110083148280` found the uploaded artifact but failed while creating its
Pages deployment. The expected site at
`https://xoxrumblelorexox.github.io/tinygpu-trace-lab/` independently returned
HTTP 404. This is a publication blocker, not a pending build. Next release
action: enable Pages for the existing Actions workflow, then rerun deployment.
Acceptance still requires a successful run, a reachable application and working
hosted evidence downloads. This documentation-only recheck changed no repository
settings and started no deployment.

| Roadmap stage            | Implemented                                                                                                                                                                  | Remaining gate or boundary                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Traceable first lesson   | Vector-add prediction, synchronized state, load/add/store checkpoints, rewind, input edits, 2D/3D                                                                            | Human explanation quality needs observation                |
| Guided learning lab      | Six runnable lessons with reference outputs, prediction checks and experiments                                                                                               | Four-of-five beginner target has not been tested           |
| Genuine model comparison | Sequential, SIMD and SIMT schedules; identical reference outputs; configurable width                                                                                         | Teaching scheduling only, no vendor timing                 |
| Extraction and mapping   | Editable teaching-assembly studio, observed-path graphs, backward/forward provenance, source-line replay, two scheduling policies, configurable units, systolic matrix model | No arbitrary-language or all-path extraction               |
| Hardware exploration     | Ripple-carry ADD, 31-case preserved-ALU comparison, full-GPU baseline/experiment reports, source-linked commits and transfers, observed scheduler signals, VCD import        | Original GPU fails; passing experiment covers one workload |

## October 1 Verification

The local [navigation repairs](navigation-repairs.md) passed 53 simulator tests,
type checking and the final production build. The final production browser run
passed 41 checks, with one intentionally skipped duplicate viewport matrix.
Development passed the earlier 40-check full run, then all nine navigation
checks after the tablet repair. A cold-start test verified the corrected
Playwright server command. Screenshots of the new detail views were inspected.

The main JavaScript bundle is now 1,110.13 kB before gzip, 308.95 kB compressed;
the existing large-chunk warning remains. No fresh HDL tool execution or new
public deployment was performed. `GOAL.md` and `hardware/original` remain
unchanged; the original specification suffix checksum still matches.

## October 1 Hardware Reproduction

A subsequent documentation-only pass [reran the HDL checks in an isolated
copy](hardware-reproduction.md). The fresh ALU run passed all 31 cases. All three
compatibility-baseline kernel fixtures reproduced the 4,096-period timeout;
the separately labeled scheduler-reset experiment passed at 145, 145 and 175
periods. Seven focused evidence tests passed against the fresh artifacts;
before/after hashes confirmed 39 protected files unchanged.
The [visual evidence guide](hardware-evidence-guide.md) adds a value-flow
diagram, prediction checks and explicit limits. No application or bundled public
artifacts were replaced. These results do not complete the remaining learner,
accessibility, architecture-continuity or deployment gates.

## October 1 Studio Keyboard Follow-Up

A documentation-only [keyboard audit](studio-keyboard-audit.md) recorded eight
passing observations and two reproductions of K5: Program Studio's graph source
action restores the correct thread/instruction but drops focus to `BODY`.
Keyboard error recovery works at both measured viewport sizes. Before/after
hashes confirmed 76 protected files unchanged. K5 was unfixed at that audit
checkpoint; the authorized application follow-up below repairs it. The historical
audit does not establish screen-reader usability or complete keyboard coverage.

## Authorized Application Follow-Up

The documentation-only restriction was lifted while retaining the original
specification. Program Studio now focuses its labelled replay region after graph
source navigation; its accessible description identifies the selected event.
Ordinary execution-model selection retains focus on its own control.

Learning Lab and Program Studio now share Machine, Cores, Pipeline, Registers
and Gates inspection for their own execution result. Switching detail levels
pauses playback, preserves the selected operation and survives laboratory-tab
round trips. Pipeline navigation retains repeated-loop iteration identity.
Learning maps individual source events into its grouped replay frames; Studio
retains individual events. Core assignment is not a hardware concurrency claim.
ADD details distinguish the 8-bit circuit result from integer or uint8 execution.

These changes do not merge Learning and Classic configurations, implement gates
for every opcode, or satisfy human learning/accessibility acceptance gates.
See [Navigation Repair Verification](navigation-repairs.md) for final checks.

Final follow-up verification: 53 simulator tests, type checking and production
build passed. The complete production browser suite passed 52 checks with two
intentional duplicate viewport-matrix skips, including the final tablet label
repair. Desktop/mobile 3D pixel, motion and orbit checks passed; narrow gate and
tablet pipeline screenshots were inspected. The main bundle is 1,112.89 kB
(309.69 kB gzip); the existing chunk-size warning remains. No new HDL run,
commit, push or deployment was performed. The full `GOAL.md` SHA-256 remains
`dcec1b3f69adc37135f5cbbec5a031608e6ea19e0c8c505a40f9fd7288ef3d2a`.

## Earlier Verification

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

The historical [Keyboard Workflow Audit](keyboard-audit.md) identified four defects in source-thread selection, destination focus, focused graph-node visibility and the classic comparison selector's accessible name. The local working tree now repairs all four. [Navigation Repair Verification](navigation-repairs.md) maps each finding to executable regression coverage, including source navigation under all three models and desktop/mobile graph traversal.

The historical exploratory record remains intact: 25 passed checks, seven failed observations and five superseded probes. The new regression checks use programmatic setup as well as keyboard events; they do not establish complete keyboard accessibility or real screen-reader announcements. Screen-reader and learner sessions remain unperformed.

## Architecture Navigation

The historical [Selection Continuity Audit](selection-continuity.md) recorded six passing learning-view transitions and two classic-view gaps. The local repairs now render Core, Pipeline, Register and unsigned 8-bit ADD gate details from the selected classic operation. Replay, abstraction, comparison and adder-bit selection survive tab departure/return; hidden playback stops. Tablet clipping discovered during verification is also repaired, with panel-bound checks at 320, 390, 768, 1024 and 1440px. Learning and Classic remain independent simulations; this is not a claim of a unified hierarchy or shared cursor between them.

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
