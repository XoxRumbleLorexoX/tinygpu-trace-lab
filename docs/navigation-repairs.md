# Navigation Repair Verification

October 1, 2026. Follow-up to the historical [keyboard audit](keyboard-audit.md)
and [selection continuity audit](selection-continuity.md). This records the local
working tree, not a published release or completion of the full roadmap.

## Repair Coverage

| Finding | Changed behavior | Regression evidence |
| --- | --- | --- |
| K1 | Graph source navigation selects the source thread, register inspection and containing replay frame together. | Thread 3's `ADD R4, R1, R3` opens at Writeback with result 9 under Sequential, SIMD and SIMT. |
| K2 | The destination execution region receives keyboard focus and names its thread, PC and stage. | Enter activates the source action; the destination is focused; the next Tab reaches 2D. |
| K3 | Focusing an SVG graph node scrolls its full bounds into view with an eight-pixel margin. | Tab traverses every node in the default graph; all four visible margins are at least six pixels. |
| K4 | The classic comparison select has the accessible name `Comparison mode`. | The named combobox is located and changed; its value survives a laboratory-tab round trip. |
| K5 | Studio graph source navigation focuses the labelled replay after mounting, with the selected event as its accessible description. | Source navigation preserves Thread 3 / PC 7 under every model; next Tab reaches First program event. Ordinary model selection keeps control focus. |
| S1 | Classic Core, Pipeline, Register and Logic/Gate selections render distinct trace-backed details. | Thread 3's classic `ADD R7, R3, R6` retains its operation across views. Pipeline Writeback seeks its exact event; R7 and the circuit match the recorded result. |
| S2 | Classic mounts on first use and retains replay and view state when hidden. Playback pauses on departure. | Event, view, comparison and selected adder bit survive departure/return. Hidden playback does not advance or restart on return. |

The executable checks are in [navigation.spec.ts](../web/test/navigation.spec.ts).
They run in desktop and mobile Chromium. Setup includes clicks, explicit focus,
select-option and slider fill; these are regression checks, not a replacement
for the historical keyboard-only workflow or actual screen-reader testing.

## Additional Defects Found During Verification

- Browser startup: the root npm script consumed the requested port flags. The
  Playwright server now invokes the web workspace directly so `--port 5175`
  and `--strictPort` reach Vite.
- The initial classic regression assumed the learning lesson's R4 destination.
  Classic uses a different program. The corrected check selects its actual
  data ADD, `ADD R7, R3, R6`, at PC 6, with operands 6 and 13, result 19.
- At 768px, Classic's implicit grid column grew wider than the visible
  workspace. Page-level overflow checks missed the internally clipped panel.
  A constrained workspace column and responsive status/warp grids repair it.
  A new matrix checks panel bounds and internal overflow for every detail view
  at 320, 390, 768, 1024 and 1440px. It runs once in the desktop project; its
  duplicate mobile-project instance is intentionally skipped.

## Boundaries

Learning and Classic still have independent programs, configurations and replay
cursors. Retaining state does not establish shared selection between those
simulations. Classic's overview camera state is not covered by this repair.

The gate view covers unsigned 8-bit ADD only. Unsupported operations retain
their selection and explicitly show unavailable gate detail. The circuit's
wrapped byte and carry are distinguished from the simulator's integer result.
No transistor model, gate delay or new HDL validation is implied.

Human beginner sessions and real screen-reader evaluation remain pending.
Tests of stored hardware evidence are not a fresh HDL execution. Pages
deployment is not established by local browser checks.

The original 7,260-byte specification suffix has SHA-256
`bb88e58b125a77c4223ce666fd1bf2a852b1aee35d3fef034378a2a9e2f30657`.
`GOAL.md` and `hardware/original` have no changes relative to the repository
baseline. Neither preservation target was edited during these repairs.

## Shared Architecture Follow-Up

Learning Lab and Program Studio now reuse the trace-backed detail views without
switching to Classic's separate simulation. Machine, Cores, Pipeline, Registers
and Gates use the current execution result, thread and operation. Changing level
pauses playback. Detail selection survives laboratory-tab departure and return.

Regression checks retain Thread 3's ADD and result 9 across all three learning
models. A Studio loop check selects the third ADD, follows its Fetch and commit
events, and verifies R1 changes from 4 to 6 without switching iterations. Overflow
checks distinguish integer 270 from uint8 14 for 250 + 20; the unsigned circuit
shows byte 14 and carry 1. Panel bounds are checked at 320, 390, 768, 1024 and
1440px. Unsupported gate operations remain explicitly unavailable.

A tablet screenshot exposed split pipeline stage names inside Studio's narrower
panel even though its bounds passed. Pipeline tracks now size against available
panel width rather than forcing five columns. The viewport matrix also verifies
that each stage title occupies one line. The existing lesson test scopes its
Registers action to the state inspector, distinct from architecture selection.

The Studio focus regression uses explicit focus and keyboard activation. It is
not a repeat of the historical keyboard-only audit or screen-reader evaluation.

## Verified Commands

- `npm test`: 53 passed, including stored hardware-evidence checks.
- `npm run typecheck`: passed. `npm run build`: passed after the final source
  changes. Main JavaScript bundle: 1,110.13 kB, 308.95 kB gzip. The existing
  large-chunk warning remains.
- Development: the initial full regression run passed 40 checks. After the
  tablet repair and new width matrix, the navigation suite passed nine checks
  with one intentional duplicate skip.
- Production: `LAB_TEST_URL=http://127.0.0.1:5176/tinygpu-trace-lab/ npm run test:browser`
  passed 41 checks with one intentional duplicate skip. This full run covers
  the final source changes, including hardware views, imports, studio,
  nonblank/moving/orbitable 3D and layout checks.
- Cold startup: with no server on port 5175, the desktop graph-source test
  passed through Playwright's corrected `webServer` command.
- Original suffix hash matched the value above; `git diff --exit-code --
  GOAL.md hardware/original` returned zero.

Screenshots were inspected for classic core, pipeline, registers and ADD gates,
including the repaired 768px pipeline. These views remain scrollable tools;
they are not required to fit all their vertical content in one viewport.

## Final Shared-View Verification

- `npm test`: 53 passed. `npm run typecheck`: passed.
- `npm run build`: passed after the pipeline-width repair. Final assets include
  `index-BkhhvPBv.js` and `index-BEO3NYdV.css`. Main JavaScript: 1,112.89 kB,
  309.69 kB gzip; existing chunk-size warning remains.
- `LAB_TEST_URL=http://127.0.0.1:5176/tinygpu-trace-lab/ npm run test:browser`:
  52 passed, two intentional duplicate viewport-matrix skips, on the final build.
- The full run includes desktop/mobile nonblank pixels, animation, orbit,
  graph focus, imports, hardware evidence and repeated-loop inspection.
- Inspected 320px gate, 768px gate/pipeline and desktop/mobile 3D screenshots.
  Pipeline title checks now catch the previously cramped tablet labels.
- `git diff --check` passed; `GOAL.md` and `hardware/original` remain unchanged.

No new HDL execution or public deployment belongs to this follow-up. Human
learning and screen-reader acceptance remain pending.
