import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Follow a sum", exact: true }),
  ).toBeVisible();
  const iconUrl = await page
    .locator('link[rel="icon"]')
    .evaluate((icon) => (icon as HTMLLinkElement).href);
  const icon = await page.request.get(iconUrl);
  expect(icon.ok()).toBe(true);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
});

test("guided lesson predicts, observes commits, rewinds, changes inputs", async ({
  page,
}, info) => {
  await expect(page.getByTestId("output-0")).toHaveText("--");
  await page.getByLabel("Your prediction").fill("5");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Not quite.", { exact: false })).toBeVisible();
  await page.getByLabel("Your prediction").fill("6");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "Observe a load" }).click();
  await page.getByRole("button", { name: "Inspect arithmetic" }).click();
  await expect(page.locator(".event-explanation")).toContainText("6");
  await page.getByRole("button", { name: "Registers", exact: true }).click();
  await expect(
    page
      .locator(".state-registers > div")
      .filter({ has: page.getByText("R4", { exact: true }) }),
  ).toContainText("0");
  await page.getByRole("button", { name: /Writeback$/, exact: false }).click();
  await expect(
    page
      .locator(".state-registers > div")
      .filter({ has: page.getByText("R4", { exact: true }) }),
  ).toContainText("6");
  await page.getByRole("button", { name: "Follow a store" }).click();
  await expect(page.getByTestId("output-0")).toHaveText("6");
  await page
    .getByRole("button", { name: "Complete lesson", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lesson complete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "First event", exact: true }).click();
  await expect(page.getByTestId("output-0")).toHaveText("--");
  await page.getByLabel("A[0]", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Final event", exact: true }).click();
  await expect(page.getByTestId("output-0")).toHaveText("14");
  await expect(page.getByTestId("output-1")).toHaveText("6");
  await page.screenshot({
    path: info.outputPath("learning.png"),
    fullPage: true,
  });
});

test("playback pauses, advances, preserves event across 2D and 3D", async ({
  page,
}) => {
  await page.getByLabel("Playback speed").selectOption("8");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() => page.getByLabel("Trace position").inputValue())
    .not.toBe("0");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const value = Number(await page.getByLabel("Trace position").inputValue());
  await page.getByRole("button", { name: "Next stage", exact: true }).click();
  await expect(page.getByLabel("Trace position")).toHaveValue(
    String(value + 1),
  );
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByLabel("Trace position")).toHaveValue(
    String(value + 1),
  );
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.getByLabel("Trace position")).toHaveValue(
    String(value + 1),
  );
});

test("all lessons produce expected results, model comparisons change actual schedules", async ({
  page,
}) => {
  for (const [title, values] of [
    ["Follow a dependency", ["12", "12", "18", "18"]],
    ["Watch lanes split", ["6", "6", "-3", "5"]],
    ["Combine many values", ["17"]],
    ["Build a running total", ["2", "7", "10", "17"]],
    ["Multiply two matrices", ["38", "12", "54", "17"]],
  ] as const) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page
      .getByRole("button", { name: "Final event", exact: true })
      .click();
    for (let i = 0; i < values.length; i++)
      await expect(page.getByTestId(`output-${i}`)).toHaveText(values[i]);
  }
  await page.getByRole("button", { name: /Follow a sum/ }).click();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator(".machine-0 .machine-metrics")).toContainText("36");
  await expect(page.locator(".machine-1 .machine-metrics")).toContainText("9");
  await page.getByLabel("Lane width").selectOption("2");
  await expect(page.locator(".machine-2 .machine-metrics")).toContainText("18");
  await page.getByRole("button", { name: /Watch lanes split/ }).click();
  await expect(
    page.getByText("Unsupported control flow", { exact: true }),
  ).toBeVisible();
});

test("output provenance, source navigation, graph remapping, systolic wavefront", async ({
  page,
}, info) => {
  await page
    .getByRole("button", { name: "Trace output C[2]", exact: true })
    .click();
  await expect(page.locator(".graph-inspector")).toContainText(
    "memory[130] = 9",
  );
  await expect(page.locator(".graph-controls")).toContainText("Same output");
  await page.getByLabel("Graph processing units").selectOption("1");
  await expect(page.locator(".graph-controls")).toContainText("36");
  await page.getByLabel("Graph processing units").selectOption("4");
  await expect(page.locator(".graph-controls")).toContainText("9");
  await page
    .getByLabel("Graph scheduling policy")
    .selectOption("critical-path");
  await page.getByLabel("Trace input consumers").selectOption("2");
  await expect(page.locator(".graph-node.ancestor")).not.toHaveCount(0);
  await page.screenshot({ path: info.outputPath("graph.png"), fullPage: true });
  await page.getByRole("button", { name: "View source event" }).click();
  await expect(page.locator(".event-explanation")).toContainText("Writeback");
  await page.getByRole("button", { name: /Multiply two matrices/ }).click();
  await page
    .getByRole("button", { name: "Computation graph", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Systolic array", exact: true })
    .click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next systolic tick" }).click();
  await expect(page.locator(".systolic-array .accumulator")).toHaveText([
    "38",
    "12",
    "54",
    "17",
  ]);
});

test("hardware evidence, gate carry, waveform selection, VCD import", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "Hardware", exact: true }).click();
  await expect(page.getByText("31 cases / 0 mismatches")).toBeVisible();
  await page.getByLabel("Adder input A").fill("255");
  await page.getByLabel("Adder input B").fill("1");
  await expect(page.locator(".adder-result")).toContainText(
    "Overflow: carry out = 1",
  );
  await expect(page.locator(".adder-result > strong")).toHaveText("0");
  await page
    .getByRole("button", { name: "Inspect adder bit 7", exact: true })
    .click();
  await expect(page.locator(".gate-detail")).toContainText("BIT 7");
  await page
    .getByRole("button", { name: "Inspect hardware sample 5", exact: true })
    .click();
  await expect(page.locator(".hardware-source-event")).toContainText(
    "ADD R4, R1, R3",
  );
  await expect(page.getByLabel("Hardware waveform time")).toHaveValue("56");
  await page
    .getByLabel("VCD file")
    .setInputFiles("web/public/hardware-waveform.vcd");
  await expect(
    page.getByRole("heading", { name: "Imported waveform / unmapped" }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Bundled trace", exact: true })
    .click();
  await page.getByLabel("VCD file").setInputFiles({
    name: "invalid.vcd",
    mimeType: "text/plain",
    buffer: Buffer.from("not a waveform"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "VCD must contain definitions",
  );
  await page.screenshot({
    path: info.outputPath("hardware.png"),
    fullPage: true,
  });
});

test("kernel evidence separates baseline deadlock from the scheduler experiment", async ({
  page,
}, info) => {
  await page.getByRole("button", { name: "Hardware", exact: true }).click();
  const kernel = page.getByRole("region", { name: "Full GPU evidence" });
  await expect(kernel.getByRole("status")).toHaveText("Hardware disagreement");
  await expect(kernel).toContainText("Original-source compilation: failed");
  await expect(kernel).toContainText("No execution-logic fixes applied");
  await kernel.getByLabel("Kernel hardware time").focus();
  await kernel.getByLabel("Kernel hardware time").press("End");
  await expect(kernel.locator(".kernel-stall-reason")).toContainText(
    "Every LSU is Done",
  );
  await expect(kernel.locator(".kernel-signals strong")).toHaveText([
    "1",
    "Done",
    "Done",
    "Done",
    "Done",
  ]);
  await kernel.screenshot({ path: info.outputPath("kernel-baseline.png") });
  await page
    .getByLabel("Kernel source variant")
    .selectOption("kernel-scheduler-reset");
  await expect(kernel.getByRole("status")).toHaveText(
    "Complete observed agreement",
  );
  await expect(kernel).toContainText(
    "This is not the preserved GPU's behavior",
  );
  await expect(kernel.locator(".kernel-coverage b")).toHaveText([
    "28 / 28",
    "12 / 12",
    "9 / 9",
    "4 / 4",
  ]);
  await kernel.getByLabel("Kernel instruction").selectOption("4");
  await expect(kernel.locator(".kernel-source code")).toHaveText(
    "ADD R4, R1, R3",
  );
  await kernel
    .getByRole("button", { name: "Inspect kernel commit T0 PC 4", exact: true })
    .click();
  await expect(kernel.getByLabel("Kernel hardware time")).toHaveValue("896");
  await kernel
    .getByRole("button", { name: "Inspect kernel transfer 9", exact: true })
    .click();
  await expect(kernel.getByLabel("Kernel instruction")).toHaveValue("7");
  await expect(kernel.locator(".kernel-source code")).toHaveText(
    "STR R4, [R5]",
  );
  await kernel.getByLabel("Kernel evidence fixture").selectOption("1");
  await expect(kernel.locator(".kernel-outputs > div").nth(3)).toContainText(
    "HDL 44",
  );
  await expect(kernel.locator(".output-mismatch")).toHaveCount(0);
  await kernel.getByLabel("Kernel evidence fixture").selectOption("2");
  await expect(kernel).toContainText("Memory response delay: 3 clock periods");
  await expect(
    kernel.getByRole("link", { name: "Kernel VCD", exact: true }),
  ).toHaveAttribute("href", /kernel-scheduler-reset-delayed-memory\.vcd$/);
  await kernel.screenshot({ path: info.outputPath("kernel-experiment.png") });
});

test("missing kernel evidence remains unavailable rather than claiming validation", async ({
  page,
}) => {
  await page.route("**/kernel-validation.json", (route) =>
    route.fulfill({ status: 404, body: "Unavailable" }),
  );
  await page.getByRole("button", { name: "Hardware", exact: true }).click();
  await expect(
    page.getByText("Full-kernel evidence is not available.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Complete observed agreement", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("31 cases / 0 mismatches", { exact: true }),
  ).toBeVisible();
});

test("trace export restores config; malformed files cannot replace current state", async ({
  page,
}) => {
  await page.getByLabel("A[0]", { exact: true }).fill("12");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export trace" }).click();
  const payload = await readFile((await (await download).path())!, "utf8");
  await page.getByLabel("A[0]", { exact: true }).fill("9");
  const upload = page.locator(".lab-header input[type=file]");
  await upload.setInputFiles({
    name: "trace.json",
    mimeType: "application/json",
    buffer: Buffer.from(payload),
  });
  await expect(page.getByLabel("A[0]", { exact: true })).toHaveValue("12");
  await upload.setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("A[0]", { exact: true })).toHaveValue("12");
  const forged = JSON.parse(payload);
  forged.result.finalMemory[128] = 999999;
  await upload.setInputFiles({
    name: "edited.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(forged)),
  });
  await page.getByRole("button", { name: "Final event", exact: true }).click();
  await expect(page.getByTestId("output-0")).toHaveText("16");
  forged.model = "toString";
  await upload.setInputFiles({
    name: "invalid-model.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(forged)),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Not a supported lesson trace",
  );
});

test("imported VCD preserves X/Z and rejects an oversized signal", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Hardware", exact: true }).click();
  const waveform =
    '$timescale 1ns $end\n$scope module fixture $end\n$var wire 1 ! unknown $end\n$var wire 4 " partial $end\n$upscope $end\n$enddefinitions $end\n#0\n$dumpvars\nx!\nb10xz "\n$end\n#5\nz!\n#10\n1!\n#20\n';
  await page.getByLabel("VCD file").setInputFiles({
    name: "unknown.vcd",
    mimeType: "text/plain",
    buffer: Buffer.from(waveform),
  });
  await expect(
    page.getByRole("heading", { name: "Imported waveform / unmapped" }),
  ).toBeVisible();
  await expect(page.locator("[data-unknown=true]")).toHaveCount(3);
  await expect(page.locator(".waveform-canvas")).toContainText("10xz");
  await page.getByLabel("VCD file").setInputFiles({
    name: "wide.vcd",
    mimeType: "text/plain",
    buffer: Buffer.from(waveform.replace("wire 4", "wire 65")),
  });
  await expect(page.getByRole("alert")).toContainText("1-64 bits");
  await expect(
    page.getByRole("heading", { name: "Imported waveform / unmapped" }),
  ).toBeVisible();
});

test("classic explorer derives warp completion from replay state", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Classic explorer", exact: true })
    .click();
  await expect(
    page.locator(".warp-band > div:not(.divergence-callout)"),
  ).toHaveCount(2);
  await expect(page.locator(".warp-band")).not.toContainText("Completed");
  await page
    .getByRole("slider", { name: "Jump To Event", exact: true })
    .focus();
  await page
    .getByRole("slider", { name: "Jump To Event", exact: true })
    .press("End");
  await expect(page.locator(".warp-band .complete")).toHaveCount(2);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".warp-band")).not.toContainText("Completed");
});

test("responsive workspaces fit narrow, tablet and wide viewports", async ({
  page,
}, info) => {
  for (const width of [320, 768, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of [
      "Learning lab",
      "Compare",
      "Computation graph",
      "Hardware",
    ]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      if (width === 320 && view === "Learning lab") {
        await expect(page.locator(".lab-architecture")).toHaveClass(
          /compact-circuit/,
        );
        const labelHeights = await page
          .locator(".circuit-block text:first-of-type")
          .evaluateAll((labels) =>
            labels.map((label) => label.getBoundingClientRect().height),
          );
        expect(labelHeights).toHaveLength(4);
        expect(Math.min(...labelHeights)).toBeGreaterThanOrEqual(11);
        await page
          .getByRole("button", { name: "Inspect Register file", exact: true })
          .click();
        await expect(page.locator(".state-registers")).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${view} document at ${width}px`,
      ).toBe(true);
      const overflowing = await page
        .locator(
          ".lab-header, .lab-page-heading, .lab-playback, .lab-stages, .input-band, .lab-main, .lesson-rail, .workspace-toolbar, .comparison-toolbar, .machine-comparisons, .graph-toolbar, .graph-controls, .adder-controls",
        )
        .evaluateAll((items) =>
          items
            .filter((item) => {
              const rect = item.getBoundingClientRect();
              return (
                item.scrollWidth > item.clientWidth + 2 ||
                rect.right > window.innerWidth + 2 ||
                rect.left < -2
              );
            })
            .map((item) => item.className),
        );
      expect(overflowing, `${view} controls at ${width}px`).toEqual([]);
    }
    await page
      .getByRole("button", { name: "Learning lab", exact: true })
      .click();
    await page.screenshot({
      path: info.outputPath(`layout-${width}.png`),
      fullPage: true,
    });
  }
});

test("3D is nonblank, moving, orbitable; layout stays within viewport", async ({
  page,
}, info) => {
  await page.getByLabel("Reduce motion").uncheck();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  const canvas = page.locator(".lab-architecture canvas");
  await expect(canvas).toBeVisible();
  // Inspect rendered screenshots, not a WebGL buffer cleared between frames.
  await expect
    .poll(async () =>
      page.evaluate(
        async (image: string) => {
          const source = new Image();
          source.src = `data:image/png;base64,${image}`;
          await source.decode();
          const surface = document.createElement("canvas");
          surface.width = source.width;
          surface.height = source.height;
          const context = surface.getContext("2d")!;
          context.drawImage(source, 0, 0);
          const pixels = context.getImageData(
            0,
            0,
            source.width,
            source.height,
          ).data;
          const colors = new Set<string>();
          for (let i = 0; i < pixels.length; i += 64)
            colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
          return colors.size;
        },
        (await canvas.screenshot()).toString("base64"),
      ),
    )
    .toBeGreaterThan(40);
  const hash = (value: Buffer) =>
    createHash("sha256").update(value).digest("hex");
  await page.screenshot({
    path: info.outputPath("scene-3d-initial.png"),
    fullPage: true,
  });
  const first = hash(await canvas.screenshot());
  await expect
    .poll(async () => hash(await canvas.screenshot()))
    .not.toBe(first);
  await page.getByLabel("Reduce motion").check();
  const stable = hash(await canvas.screenshot());
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 75,
    box.y + box.height / 2 + 20,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => hash(await canvas.screenshot()))
    .not.toBe(stable);
  await page.screenshot({
    path: info.outputPath("scene-3d.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const overflowing = await page
    .locator(
      ".lab-header, .lab-page-heading, .lab-playback, .lab-stages, .input-band, .lab-main, .lesson-rail, .workspace-toolbar",
    )
    .evaluateAll((items) =>
      items
        .filter(
          (item) =>
            item.scrollWidth > item.clientWidth + 2 ||
            item.getBoundingClientRect().right > window.innerWidth + 2,
        )
        .map((item) => item.className),
    );
  expect(overflowing).toEqual([]);
});
