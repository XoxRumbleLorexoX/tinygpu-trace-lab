# TinyGPU Trace Lab UI Polish TODO

## Current UI Assessment

TinyGPU Trace Lab is a single-page React + Vite + TypeScript product UI in `web/src/App.tsx`, backed by React Three Fiber in `web/src/components/GpuScene.tsx` and a custom CSS styling system in `web/src/styles/global.css`. The current app already feels like a serious technical dashboard: it has a clear three-column product shell, dense simulator controls, a dark technical palette, animated GPU architecture visualization, trace timeline, inspector panels, glossary content, and strong domain-specific copy.

What works well:

- The product direction is clear: `web/src/App.tsx` presents a real simulator workspace instead of a marketing page.
- The main layout maps well to the task: examples/abstraction controls on the left, simulator scene and timeline in the center, cycle inspector on the right.
- The palette in `web/src/styles/global.css` has useful semantic accents: cyan for active/instruction state, amber for data/memory, green for completed/healthy state, red for stalls/hazards.
- Core controls are present and functional in `web/src/components/Controls.tsx`, including play, pause, stepping, reset, speed, loop, jump-to-cycle, and replay range.
- The app uses reusable component boundaries for the largest surfaces: `GpuScene`, `Timeline`, `Inspector`, and `Controls`.

What feels unfinished or visually weak:

- The visual system is still mostly one large stylesheet. Tokens exist in `:root`, but spacing, typography, state colors, panel styles, and control styles are repeatedly hand-coded.
- The dashboard is dense but not yet refined enough for a premium SaaS/product feel. Several panels use the same border/background treatment, so hierarchy can blur.
- The 3D scene in `web/src/components/GpuScene.tsx` combines real R3F geometry with an absolute-positioned 2D architecture map. This is practical, but it creates a slight mismatch between the intended 3D simulator and the current mostly diagrammatic visual read.
- The top camera preset navigation can become crowded because every mode is a full text button in `web/src/App.tsx`.
- Mobile responsiveness exists in `web/src/styles/global.css`, but it turns the entire product into a long stacked dashboard rather than a purpose-built mobile workflow.
- Disabled AI tutor prompt buttons in `web/src/components/Inspector.tsx` look like inert controls rather than a clearly future-state, read-only preview.

## High-Priority Visual Improvements

- [x] Create a small UI token layer in `web/src/styles/global.css` for spacing, panel padding, control height, text sizes, border colors, focus rings, shadows, and semantic state colors.
  - Added focused spacing, surface, text, panel padding, control height, shadow, and focus-ring tokens.
- [x] Improve dashboard hierarchy in `web/src/App.tsx` by giving the central simulator scene stronger visual priority over secondary comparison/memory cards.
  - Increased central scene height, added scene shadow, and softened secondary analysis cards.
- [ ] Refine `web/src/components/GpuScene.tsx` so the scene reads as one intentional architecture visualization, not a mix of small 3D blocks plus a separate overlay diagram.
- [ ] Consolidate all repeated panel/card styles in `web/src/styles/global.css` into shared classes such as `.surface`, `.surface-muted`, `.metric-tile`, `.nav-item`, and `.state-chip`.
- [x] Improve top navigation density in `web/src/App.tsx` by replacing long camera preset buttons with a segmented control, select menu, icon+tooltip controls, or compact horizontal tabs.
  - Preserved desktop preset buttons and added a compact mobile camera select.
- [ ] Add clear loading/empty states for future async simulator flows, especially before a trace is generated, when no example is selected, or if a custom program fails to parse.
- [ ] Strengthen typography hierarchy: page title, section labels, metric values, code/instruction text, and explanatory prose should have deliberate scale/weight rules instead of one-off sizes.
- [x] Add keyboard focus styles for buttons, selects, range inputs, timeline bars, glossary disclosures, and replay range fields.
  - Added shared `:focus-visible` treatment in `web/src/styles/global.css`.
- [x] Re-test desktop, tablet, and mobile after every substantial visual change; the current app is dense enough that small spacing changes can easily create overflow.
  - Verified desktop and 390px mobile in Playwright after layout changes; no horizontal overflow detected.

## Component-Level Improvements

### `web/src/App.tsx`

- [ ] Split the monolithic screen composition into layout components: `TopBar`, `LeftRail`, `Workspace`, `StatusStrip`, `PipelineStages`, `WarpBand`, and `AnalysisGrid`.
- [x] Move the inline comparison data and memory hierarchy arrays out of JSX into `web/src/data/views.ts` or a new `web/src/data/ui.ts`.
  - Added `comparisonModes`, `comparisonCopy`, `exampleDescriptions`, `tokenLegend`, and `memoryHierarchy` in `web/src/data/views.ts`.
- [x] Replace repeated string union state for `comparison` with exported constants from `web/src/data/views.ts` so labels, options, and display copy stay aligned.
  - `web/src/App.tsx` now derives comparison state/options/copy from exported view constants.
- [ ] Add a clearer product-level header area for current kernel, cycle, active thread, and selected view; the current status strip is useful but visually similar to other panel rows.

### `web/src/components/GpuScene.tsx`

- [ ] Decide whether the primary scene should be true 3D or an intentional 2D/3D hybrid diagram. Then simplify the implementation around that direction.
- [ ] Add component-specific visual states for instruction, data, combined token, stall, completed, and idle states instead of only highlighting `event.activeComponent`.
- [ ] Replace hard-coded absolute positions in `.map-node.*` CSS with a data-driven scene layout map exported near the component.
- [ ] Add tooltips or inspector affordances for hardware blocks so the scene supports learning without overcrowding labels.
- [ ] Improve perceived depth with consistent lighting, shadows, and scale; the current R3F blocks are subtle behind the overlay.

### `web/src/components/Controls.tsx`

- [ ] Group playback actions, cycle scrubber, speed, loop, and replay range into visually distinct control clusters.
- [x] Add disabled/edge states for step backward at cycle `0`, step forward at the final cycle, and invalid replay ranges.
  - Step backward, step forward, and reset now disable at their cycle bounds.
- [ ] Replace numeric replay range inputs with a more polished range control or paired compact fields with stronger labels.
- [ ] Add visible focus states and accessible labels that appear in tooltips or adjacent text for icon-only controls.

### `web/src/components/Timeline.tsx`

- [ ] Improve timeline readability by adding a stronger time axis, lane headers, hover states, and selected-cycle vertical marker.
- [ ] Make timeline bars encode event type more explicitly: instruction, data, combined, stall, memory access, and writeback.
- [ ] Add an empty/overflow strategy for long traces instead of always sampling into `96` columns.
- [x] Add a compact legend directly inside the timeline panel so colors are understandable without reading code.
  - Timeline now renders instruction, data, completed, and stall legend markers.

### `web/src/components/Inspector.tsx`

- [ ] Turn the inspector into clear subsections with stronger hierarchy: explanation, active instruction, metrics, hazards, registers, memory, glossary, tutor.
- [ ] Reduce visual repetition in metric tiles, hazard rows, register cells, and memory rows; many rows currently share the same surface treatment.
- [ ] Add changed-state animation or subtle highlight decay for `registerDiff` and `memoryDiff` so cycle changes feel alive.
- [x] Make the disabled tutor prompts visually read as “future / unavailable” rather than broken controls.
  - Replaced disabled prompt buttons with read-only `.tutor-row` preview rows.
- [ ] Consider making glossary entries searchable or filterable once all terms are shown, instead of rendering a fixed first slice from `web/src/data/glossary.ts`.

## Page-Level Improvements

### Main Simulator Workspace (`web/src/App.tsx`)

- [ ] Make the central scene the unmistakable hero of the app surface by increasing its default height on desktop and reducing visual competition from lower analysis panels.
- [ ] Improve scan order: kernel/example selection -> current cycle/instruction -> architecture scene -> timeline -> details. The current layout has all of these, but the hierarchy is fairly flat.
- [ ] Add a compact “active kernel” header near the workspace that displays the selected example, trace length, block/thread configuration, and current camera mode.
- [ ] Add a clear “custom program” future placeholder or import affordance if the product is meant to support direct experimentation beyond bundled examples.

### Left Rail (`web/src/App.tsx`, `.left-rail` in `web/src/styles/global.css`)

- [ ] Add secondary descriptions for examples or compact metadata such as `memory`, `branching`, `math`, and `scheduler` so users understand why each example matters.
- [ ] Differentiate examples, abstraction levels, and comparison mode with stronger section spacing or subtle section dividers.
- [ ] Improve selected and hover states so they feel premium rather than flat cyan fills.

### Right Inspector (`web/src/components/Inspector.tsx`)

- [ ] Make “What just happened?” the strongest explanatory card with a clearer active-instruction row and better code styling.
- [ ] Add sticky behavior or section tabs for long inspector content on smaller screens.
- [ ] Include flags in their own row/card; the simulator has `conditionFlags`, but the current inspector does not give them enough prominence.

### Mobile Screen (`@media (max-width: 760px)` in `web/src/styles/global.css`)

- [ ] Design a mobile-specific flow instead of simply stacking all desktop panels.
- [ ] Put the most useful mobile actions first: selected kernel, play/step controls, current explanation, scene/timeline toggle.
- [ ] Collapse left rail sections into accordions or a drawer to avoid pushing the simulator far down the page.
- [ ] Convert the seven camera preset buttons into a select, segmented scroll area, or action sheet on mobile.

## Design System Improvements

- [ ] Expand `:root` in `web/src/styles/global.css` from a small color set into a real design token layer.
- [ ] Add spacing tokens: `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-5`, `--space-6`.
- [ ] Add typography tokens for UI labels, body text, section headings, metric values, and monospace code.
- [ ] Add surface tokens: `--surface-base`, `--surface-raised`, `--surface-sunken`, `--surface-selected`, `--surface-warning`.
- [ ] Add border tokens: `--border-subtle`, `--border-strong`, `--border-active`, `--border-danger`.
- [ ] Add shadow/glow tokens for active components and token routes so cyan/amber glows are consistent.
- [ ] Standardise radius usage around the existing 8px maximum: 4px for dense cells, 6px for controls, 8px for panels.
- [ ] Standardise button variants: icon button, rail item, segmented control, primary action, disabled/future action.
- [ ] Standardise card/panel variants: major workspace panel, inspector panel, metric tile, table row, timeline lane.
- [ ] Define a state-color contract: cyan means instruction/active, amber means data/memory, green means completed/healthy, red means stall/hazard, muted gray means idle/future.

## Responsive / Mobile Improvements

- [ ] Test at `1440x960`, `1280x800`, `1024x768`, `768x1024`, `390x844`, and `360x740`.
- [ ] Verify no horizontal overflow after changing `.topbar nav`, `.bars`, `.controls`, `.scene-map`, or `.app-shell`.
- [ ] Check that the top camera controls do not wrap awkwardly or hide important modes on tablet widths.
- [ ] Check that `Controls` remains usable when all controls stack vertically on mobile.
- [ ] Check that `.scene` labels remain readable on mobile; absolute-positioned `.map-node` elements can overlap at narrow widths.
- [ ] Check that the right inspector content remains discoverable when moved below the workspace at `max-width: 1180px`.
- [ ] Add a mobile-first display mode that lets users switch between `Scene`, `Timeline`, `Inspector`, and `Glossary` instead of showing everything in one long page.
- [ ] Add visual regression screenshots for desktop and mobile after major UI changes.

## Implementation Plan

### Phase 1: Stabilise The Design System

- [x] Add spacing, typography, surface, border, radius, and shadow tokens in `web/src/styles/global.css`.
  - Added focused surface, text, spacing, and focus-shadow tokens.
- [x] Replace repeated hard-coded colors and borders with semantic tokens.
  - Replaced key control, status, stage, panel, input, and row surfaces with tokenized values.
- [ ] Create shared utility classes for panel surfaces, metric tiles, nav items, chips, and code blocks.
- [x] Add consistent `:focus-visible` styles for all interactive elements.
  - Buttons, selects, range fields, numeric fields, glossary summaries, and timeline bars share a visible focus ring.
- [x] Run `npm run typecheck`, `npm run build`, and browser smoke checks after token changes.
  - `npm run typecheck`, `npm run test`, `npm run build`, and Playwright smoke checks passed.

### Phase 2: Refine Desktop Layout

- [ ] Extract `TopBar`, `LeftRail`, `StatusStrip`, `PipelineStages`, `WarpBand`, and `AnalysisGrid` from `web/src/App.tsx`.
- [x] Improve central scene sizing and visual prominence in `.workspace` and `.scene`.
  - Raised scene minimum height and added a subtle shadow token for clearer workspace priority.
- [x] Tighten spacing between status strip, pipeline stages, scene, warp band, controls, and timeline.
  - Workspace grid rows were clarified so the instruction chip, stages, scene, controls, and timeline keep predictable spacing.
- [ ] Add a compact active-kernel summary near the top of the workspace.
- [ ] Rebalance the inspector so explanation and active instruction are visually primary.

### Phase 3: Upgrade The Scene And Timeline

- [ ] Refactor `web/src/components/GpuScene.tsx` around a clearer scene model and state map.
- [x] Add a proper legend for instruction/data/completed/stall token colors.
  - Implemented in `web/src/components/Timeline.tsx` using `tokenLegend`.
- [ ] Improve token route animation and active-component highlights.
- [x] Upgrade `web/src/components/Timeline.tsx` with selected-cycle marker, hover states, lane legends, and clearer throughput display.
  - Added selected-cycle bar styling, hover state, embedded legend, and retained throughput readout.
- [ ] Verify the scene and timeline at multiple trace lengths.

### Phase 4: Improve Mobile / Tablet UX

- [x] Replace mobile camera buttons with a compact mobile control.
  - Mobile now hides the camera button row and exposes a full-width camera select.
- [ ] Collapse left rail sections into accordions or a drawer.
- [ ] Add mobile tabs for `Scene`, `Timeline`, `Inspector`, and `Glossary`.
- [ ] Rework `.scene-map` node sizing for small screens.
- [x] Test horizontal overflow and key flows at phone and tablet sizes.
  - Verified 390px mobile layout has no horizontal overflow, stacked controls, and usable camera select.

### Phase 5: Add Product Polish States

- [ ] Add loading/empty/error states for future custom program parsing or trace generation.
- [x] Add disabled/invalid states for replay range and step controls.
  - Step controls now expose disabled edge states; replay range remains clamped in handlers.
- [ ] Add hover/focus tooltips for hardware components, timeline bars, and icon-only playback buttons.
- [ ] Add subtle transitions for cycle changes, register diffs, memory diffs, and active hazards.
- [ ] Add a lightweight visual regression checklist to `docs/screenshots.md`.

## Quick Wins

- [x] Add `:focus-visible` styles in `web/src/styles/global.css` for buttons, inputs, selects, timeline bars, and glossary summaries.
- [x] Add a token legend above or inside `web/src/components/GpuScene.tsx` for instruction, data, completed, and stall colors.
  - Added inside the timeline panel rather than the 3D scene to avoid crowding the architecture view.
- [x] Replace the disabled AI tutor prompt buttons in `web/src/components/Inspector.tsx` with read-only preview rows or a labeled “Future” state.
- [x] Add `disabled` states to step backward, step forward, and reset buttons in `web/src/components/Controls.tsx`.
- [x] Add hover styling for `.bar` timeline buttons so clickability is clearer.
- [x] Give `.analysis-grid` panels distinct titles and stronger visual hierarchy so they do not compete with the central scene.
  - Added analysis card variants with subtle top accents and quieter tile backgrounds.
- [x] Add brief descriptions under each example label in the left rail so users understand the teaching purpose of each kernel.
- [x] Move hard-coded comparison and memory hierarchy arrays from `web/src/App.tsx` into `web/src/data/views.ts`.
- [x] Reduce topbar crowding by changing camera presets into a segmented control with overflow behavior or a select on narrow screens.
  - Mobile view now hides the button row and exposes a full-width camera select.
- [x] Add a small “active instruction” chip near the status strip so users do not need to look right to understand the current cycle.

## Discovered Follow-Up Tasks

- [ ] Consider code-splitting the web app bundle; Vite still reports the production JS chunk is larger than 500 kB after minification.
