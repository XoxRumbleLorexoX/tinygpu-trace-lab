import { test, expect } from "@playwright/test";
import { loadExampleProgram, simulate } from "@tinygpu-trace-lab/simulator";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("./");
});

test("classic detail panels fit the workspace at phone, tablet and desktop widths", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Explicit viewport matrix");
  await page
    .getByRole("button", { name: "Classic explorer", exact: true })
    .click();
  const result = simulate(loadExampleProgram("vectorAdd"), {
    blockDim: 6,
    coreCount: 2,
  });
  const index = result.trace.findIndex(
    (e) =>
      e.threadId === 3 &&
      e.instruction === "ADD R7, R3, R6" &&
      e.stage === "Writeback",
  );
  expect(index).toBeGreaterThanOrEqual(0);
  await page
    .getByRole("slider", { name: "Jump To Event", exact: true })
    .fill(String(index));
  const menu = page.getByRole("complementary", { name: "Examples and views" });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of [
      "Core View",
      "Pipeline View",
      "Register View",
      "Logic/Gate View",
    ]) {
      await menu.getByRole("button", { name, exact: true }).click();
      const panel = page.locator(".classic-detail");
      await panel.scrollIntoViewIfNeeded();
      const bounds = await panel.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const workspace = node.closest(".workspace")!.getBoundingClientRect();
        return {
          left: rect.left - Math.max(0, workspace.left),
          right: Math.min(innerWidth, workspace.right) - rect.right,
          overflow: node.scrollWidth - node.clientWidth,
        };
      });
      expect(bounds.left, `${width} ${name} left`).toBeGreaterThanOrEqual(0);
      expect(bounds.right, `${width} ${name} right`).toBeGreaterThanOrEqual(0);
      expect(bounds.overflow, `${width} ${name} contents`).toBeLessThanOrEqual(
        1,
      );
      if (width === 320 || width === 768 || width === 1440) {
        await panel.screenshot({
          path: info.outputPath(
            `classic-${width}-${name.replaceAll("/", "-").replaceAll(" ", "-")}.png`,
          ),
        });
      }
    }
  }
});

test("graph source preserves thread and moves keyboard focus into execution", async ({
  page,
}) => {
  for (const model of ["simt", "simd", "scalar"]) {
    await page
      .getByLabel("Execution model", { exact: true })
      .selectOption(model);
    await page
      .getByRole("button", { name: "Computation graph", exact: true })
      .click();
    const node = page.getByRole("button", {
      name: "t3-op4: ADD R4, R1, R3",
      exact: true,
    });
    await node.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".graph-inspector")).toContainText("ADD T3");
    const source = page.getByRole("button", {
      name: "View source event",
      exact: true,
    });
    await source.focus();
    await page.keyboard.press("Enter");
    const destination = page.getByRole("region", {
      name: "Visual execution: thread 3, PC 4, Writeback",
      exact: true,
    });
    await expect(destination).toBeFocused();
    await expect(page.locator(".event-explanation")).toContainText(
      "Thread 3: R4 changes from 0 to 9",
    );
    await expect(page.locator(".thread-lanes .focused")).toHaveAttribute(
      "aria-label",
      "Inspect thread 3",
    );
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "2D", exact: true }),
    ).toBeFocused();
  }
});

test("keyboard traversal keeps graph nodes and outlines inside the scrollport", async ({
  page,
}, info) => {
  await page
    .getByRole("button", { name: "Computation graph", exact: true })
    .click();
  const nodes = page.locator(".graph-node");
  const count = await nodes.count();
  await nodes.first().focus();
  for (let i = 0; i < count; i++) {
    await expect(nodes.nth(i)).toBeFocused();
    const bounds = await nodes.nth(i).evaluate((node) => {
      const item = node.getBoundingClientRect();
      const parent = node.closest(".graph-canvas")!.getBoundingClientRect();
      return {
        left: item.left - parent.left,
        top: item.top - parent.top,
        right: parent.right - item.right,
        bottom: parent.bottom - item.bottom,
      };
    });
    for (const margin of Object.values(bounds))
      expect(margin).toBeGreaterThanOrEqual(6);
    if (i < count - 1) await page.keyboard.press("Tab");
  }
  await page.screenshot({
    path: info.outputPath("graph-keyboard.png"),
    fullPage: true,
  });
});

test("learning architecture levels retain the graph-selected operation under every model", async ({
  page,
}, info) => {
  for (const model of ["scalar", "simd", "simt"]) {
    await page
      .getByLabel("Execution model", { exact: true })
      .selectOption(model);
    await page
      .getByRole("button", { name: "Computation graph", exact: true })
      .click();
    await page
      .getByRole("button", { name: "t3-op4: ADD R4, R1, R3", exact: true })
      .click();
    await page
      .getByRole("button", { name: "View source event", exact: true })
      .click();
    const architecture = page.getByRole("region", {
      name: "Selected operation architecture",
      exact: true,
    });
    const levels = architecture.getByRole("group", {
      name: "Architecture level",
      exact: true,
    });
    const operation = await architecture.getAttribute("data-operation-id");
    const commit = await architecture.getAttribute("data-event-id");
    const frame = await page
      .getByRole("slider", { name: "Trace position", exact: true })
      .inputValue();
    for (const level of [
      "Cores",
      "Pipeline",
      "Registers",
      "Gates",
      "Machine",
    ]) {
      await levels.getByRole("button", { name: level, exact: true }).click();
      await expect(architecture).toHaveAttribute(
        "data-operation-id",
        operation!,
      );
      await expect(architecture).toHaveAttribute("data-event-id", commit!);
      await expect(architecture).toHaveAttribute("data-thread-id", "3");
      await expect(
        page.getByRole("slider", { name: "Trace position", exact: true }),
      ).toHaveValue(frame);
      if (level === "Registers")
        await expect(
          architecture.locator(".classic-registers .committed"),
        ).toContainText("R4");
      if (level === "Gates")
        await expect(
          architecture.locator(".classic-equation strong"),
        ).toHaveText("9");
    }
    await levels.getByRole("button", { name: "Pipeline", exact: true }).click();
    await architecture.getByRole("button", { name: /^Fetch/ }).click();
    await expect(architecture).toHaveAttribute("data-operation-id", operation!);
    await expect(page.locator(".event-stage")).toHaveText("Fetch");
    await levels
      .getByRole("button", { name: "Registers", exact: true })
      .click();
    await expect(
      architecture.locator(".classic-registers .committed"),
    ).toHaveCount(0);
    await architecture
      .getByRole("button", { name: "Inspect register commit", exact: true })
      .click();
    await expect(architecture).toHaveAttribute("data-event-id", commit!);
    await expect(
      architecture.locator(".classic-registers .committed strong"),
    ).toHaveText("9");
    await page.getByRole("button", { name: "Compare", exact: true }).click();
    await page
      .getByRole("button", { name: "Learning lab", exact: true })
      .click();
    await expect(
      levels.getByRole("button", { name: "Registers", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(architecture).toHaveAttribute("data-event-id", commit!);
    if (model === "simt") {
      await levels.getByRole("button", { name: "Gates", exact: true }).click();
      await architecture.screenshot({
        path: info.outputPath("learning-trace-gates.png"),
      });
    }
  }
});

test("learning and studio architecture panels fit narrow, tablet and desktop workspaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Explicit viewport matrix");
  for (const studio of [false, true]) {
    if (studio) {
      await page
        .getByRole("button", { name: "Program studio", exact: true })
        .click();
      await expect(page.locator(".studio-models")).toContainText(
        "4/4 expectations match",
      );
      await page
        .getByRole("button", { name: "Trace program output 131", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "Computation graph", exact: true })
        .click();
    }
    await page
      .getByRole("button", { name: "t3-op4: ADD R4, R1, R3", exact: true })
      .click();
    await page
      .getByRole("button", { name: "View source event", exact: true })
      .click();
    const architecture = page.getByRole("region", {
      name: "Selected operation architecture",
      exact: true,
    });
    const levels = architecture.getByRole("group", {
      name: "Architecture level",
      exact: true,
    });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const level of ["Cores", "Pipeline", "Registers", "Gates"]) {
        await levels.getByRole("button", { name: level, exact: true }).click();
        await architecture.scrollIntoViewIfNeeded();
        const bounds = await architecture.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return {
            left: rect.left,
            right: innerWidth - rect.right,
            overflow: node.scrollWidth - node.clientWidth,
          };
        });
        expect(
          bounds.left,
          `${studio} ${width} ${level} left`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          bounds.right,
          `${studio} ${width} ${level} right`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          bounds.overflow,
          `${studio} ${width} ${level} overflow`,
        ).toBeLessThanOrEqual(1);
        if (level === "Pipeline") {
          const labelLines = await architecture
            .locator(".classic-pipeline strong")
            .evaluateAll((labels) =>
              labels.map((label) => {
                const range = document.createRange();
                range.selectNodeContents(label);
                return range.getClientRects().length;
              }),
            );
          expect(labelLines, `${studio} ${width} pipeline labels`).toEqual([
            1, 1, 1, 1, 1,
          ]);
        }
        if (width === 320 || width === 768) {
          await architecture.screenshot({
            path: info.outputPath(
              `${studio ? "studio" : "learning"}-${width}-${level}.png`,
            ),
          });
        }
      }
    }
  }
});

test("architecture inspection pauses learning and studio playback", async ({
  page,
}) => {
  for (const studio of [false, true]) {
    if (studio) {
      await page
        .getByRole("button", { name: "Program studio", exact: true })
        .click();
      await expect(page.locator(".studio-models")).toContainText(
        "4/4 expectations match",
      );
    }
    await page
      .getByRole("button", {
        name: studio ? "Play program" : "Play",
        exact: true,
      })
      .click();
    const architecture = page.getByRole("region", {
      name: "Selected operation architecture",
      exact: true,
    });
    await architecture
      .getByRole("button", { name: "Pipeline", exact: true })
      .click();
    const slider = page.getByRole("slider", {
      name: studio ? "Program trace position" : "Trace position",
      exact: true,
    });
    const stopped = await slider.inputValue();
    await page.waitForTimeout(600);
    await expect(slider).toHaveValue(stopped);
    await expect(
      page.getByRole("button", {
        name: studio ? "Play program" : "Play",
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("classic detail uses one operation, preserves registers and replay across tabs", async ({
  page,
}, info) => {
  await page
    .getByRole("button", { name: "Classic explorer", exact: true })
    .click();
  const comparison = page.getByRole("combobox", {
    name: "Comparison mode",
    exact: true,
  });
  await expect(comparison).toBeVisible();
  await comparison.selectOption("Different Scheduling Policies");
  const result = simulate(loadExampleProgram("vectorAdd"), {
    blockDim: 6,
    coreCount: 2,
  });
  const index = result.trace.findIndex(
    (e) =>
      e.threadId === 3 &&
      e.instruction === "ADD R7, R3, R6" &&
      e.stage === "Execute",
  );
  expect(index).toBeGreaterThanOrEqual(0);
  const source = result.trace[index];
  const scrubber = page.getByRole("slider", {
    name: "Jump To Event",
    exact: true,
  });
  await scrubber.fill(String(index));
  const abstraction = page.getByRole("complementary", {
    name: "Examples and views",
  });
  await abstraction
    .getByRole("button", { name: "Core View", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Core 0 lanes", exact: true }),
  ).toContainText("T3");
  await abstraction
    .getByRole("button", { name: "Pipeline View", exact: true })
    .click();
  await expect(
    page.locator(".classic-pipeline button[aria-current]"),
  ).toContainText("Execute");
  await page
    .locator(".classic-pipeline")
    .getByRole("button", { name: /^Writeback/ })
    .click();
  const commitIndex = result.trace.findIndex(
    (e) => e.operationId === source.operationId && e.stage === "Writeback",
  );
  await expect(scrubber).toHaveValue(String(commitIndex));
  await abstraction
    .getByRole("button", { name: "Register View", exact: true })
    .click();
  await expect(page.locator(".classic-registers .committed")).toContainText(
    "R7",
  );
  await expect(page.locator(".classic-registers .committed strong")).toHaveText(
    String(source.resultValue),
  );
  await abstraction
    .getByRole("button", { name: "Logic/Gate View", exact: true })
    .click();
  await expect(page.locator(".classic-equation strong")).toHaveText(
    String(source.resultValue),
  );
  await page
    .getByRole("button", { name: "Inspect adder bit 2", exact: true })
    .click();
  await expect(page.locator(".classic-detail .gate-detail")).toContainText(
    "FULL ADDER / BIT 2",
  );
  await expect(page.locator(".classic-detail-heading")).toContainText(
    "Thread 3 / Core 0 / PC 6",
  );
  await page.getByRole("button", { name: "Learning lab", exact: true }).click();
  await expect(page.locator(".legacy-container")).toBeHidden();
  await page
    .getByRole("button", { name: "Classic explorer", exact: true })
    .click();
  await expect(scrubber).toHaveValue(String(commitIndex));
  await expect(
    abstraction.getByRole("button", { name: "Logic/Gate View", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(comparison).toHaveValue("Different Scheduling Policies");
  await expect(page.locator(".classic-detail .gate-detail")).toContainText(
    "FULL ADDER / BIT 2",
  );
  await page.screenshot({
    path: info.outputPath("classic-gates.png"),
    fullPage: true,
  });
  await scrubber.fill("0");
  await expect(page.locator(".classic-detail")).toContainText(
    "No gate implementation for CONST",
  );
  await expect(page.locator(".classic-equation")).toHaveCount(0);
});

test("classic playback stops while hidden and does not resume on return", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Classic explorer", exact: true })
    .click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const scrubber = page.getByRole("slider", {
    name: "Jump To Event",
    exact: true,
    includeHidden: true,
  });
  await expect.poll(() => scrubber.inputValue()).not.toBe("18");
  await page.getByRole("button", { name: "Learning lab", exact: true }).click();
  const stopped = await scrubber.inputValue();
  await page.waitForTimeout(600);
  await expect(scrubber).toHaveValue(stopped);
  await page
    .getByRole("button", { name: "Classic explorer", exact: true })
    .click();
  await expect(scrubber).toHaveValue(stopped);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});
