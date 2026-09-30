# Screenshots

The implementation concept used for the first MVP screen is stored at:

`assets/concepts/primary-simulator-screen.png`

The concept is historical, not evidence of current implementation. Capture the actual app with:

```bash
npx playwright install chromium
npm run test:browser
```

The test configuration starts or reuses Vite on port 5175 and runs 1440 x 1000 desktop and 390 x 844 mobile views. Each project saves learning, graph, hardware, kernel-baseline, kernel-experiment, program-studio and 3D screenshots in its matching `test-results/` directory. Responsive checks also capture 320px, 768px and 1920px learning layouts after checking the learning, comparison, graph and hardware views. Failure traces and screenshots are retained there too.

Program-studio screenshots include:

- `program-graph.png`: edited multiplication outputs, source-linked store provenance and rescheduled operations, on desktop and mobile.
- `program-replay.png`: imported counted loop, internally scrolled source editor, final historical memory and the synchronized 2D architecture, on desktop and mobile.
- `program-wide.png`: shared-memory ordering experiment at 1920px, after checking page and button bounds at 320px, 768px and 1920px.

Studio browser checks also verify source-line selection, repeated loop operations, play/pause, draft retention across tabs, rerun-on-import behavior, input-only export, invalid-input recovery and partial replay without false verification after event-budget exhaustion.

To check a separately running production preview, set `LAB_TEST_URL` to its full application URL before running `npm run test:browser`. This skips Playwright's managed development server.

3D checks decode screenshot pixels, verify that animation changes the image, enable reduced motion, orbit the camera and verify the image changes again. Layout checks inspect content widths and bounding boxes, not only document scroll width, so clipped overflow cannot hide a stretched grid. At 320px, checks also require readable compact-circuit labels and working component selection.
