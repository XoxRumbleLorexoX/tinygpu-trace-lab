import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("./");
  await page
    .getByRole("button", { name: "Program studio", exact: true })
    .click();
  await expect(page.locator(".studio-models")).toContainText(
    "4/4 expectations match",
  );
});

async function edit(page: Page) {
  if (!(await page.getByLabel("Assembly source", { exact: true }).isVisible()))
    await page.locator(".studio-editor-disclosure > summary").click();
}

function experiment(source: string, changes = {}) {
  return {
    format: "tinygpu-program-1",
    modelVersion: "teaching-1",
    name: "Counted loop",
    source,
    initialMemory: {},
    expectedMemory: { 200: 6 },
    blockDim: 1,
    blockCount: 1,
    laneWidth: 4,
    numberMode: "integer",
    ...changes,
  };
}

async function importDocument(page: Page, document: unknown) {
  await page.getByLabel("Program experiment file").setInputFiles({
    name: "program.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
  await expect(
    page.getByRole("button", { name: "Run experiment", exact: true }),
  ).toBeVisible();
}

test("editable program compares expected values, extracts provenance, links source", async ({
  page,
}, info) => {
  await edit(page);
  const original = await page
    .getByLabel("Assembly source", { exact: true })
    .inputValue();
  await page
    .getByLabel("Assembly source", { exact: true })
    .fill(original.replace("ADD R4, R1, R3", "MUL R4, R1, R3"));
  await expect(
    page.getByText("Draft changed.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Run experiment", exact: true })
    .click();
  await expect(page.locator(".studio-outputs .studio-fail")).toHaveCount(4);
  await expect(page.locator(".studio-outputs tbody tr").first()).toContainText(
    "8",
  );
  await edit(page);
  await page
    .getByLabel("Program expected memory")
    .fill('{"128":8,"129":5,"130":18,"131":14}');
  await page
    .getByRole("button", { name: "Run experiment", exact: true })
    .click();
  await expect(page.locator(".studio-outputs .studio-pass")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Trace program output 128", exact: true })
    .click();
  await expect(page.locator(".program-studio .graph-inspector")).toContainText(
    "memory[128] = 8",
  );
  await page.getByLabel("Graph processing units").selectOption("1");
  await expect(page.locator(".program-studio .graph-controls")).toContainText(
    "36",
  );
  await page.getByLabel("Graph processing units").selectOption("4");
  await page
    .getByLabel("Graph scheduling policy")
    .selectOption("critical-path");
  await expect(page.locator(".program-studio .graph-controls")).toContainText(
    "Same output",
  );
  await page.screenshot({
    path: info.outputPath("program-graph.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "View source event", exact: true })
    .click();
  await expect(page.locator(".studio-event")).toContainText(
    "Writeback / Thread 0 / PC 7",
  );
  await page
    .getByRole("button", { name: "Source line 8", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByLabel("Assembly source", { exact: true })
        .evaluate((input: HTMLTextAreaElement) =>
          input.value.slice(input.selectionStart, input.selectionEnd),
        ),
    )
    .toBe("STR R4, [R5]");
  await page.getByRole("button", { name: "Learning lab", exact: true }).click();
  await page
    .getByRole("button", { name: "Program studio", exact: true })
    .click();
  await expect(page.getByLabel("Assembly source", { exact: true })).toHaveValue(
    original.replace("ADD R4, R1, R3", "MUL R4, R1, R3"),
  );
  await expect(
    page.getByRole("button", { name: "Export trace", exact: true }),
  ).not.toBeVisible();
});

test("portable loops rerun imports, preserve line numbers, replay writes and export inputs only", async ({
  page,
}, info) => {
  const source =
    "; line-number fixture\n".repeat(20) +
    "; counted loop\nCONST R0, 3\nCONST R1, 0\n\nLOOP:\nADD R1, R1, 2\nSUB R0, R0, 1\nCMP R0, 0\nBRnzp p LOOP\nSTR R1, [200]\nRET";
  await importDocument(page, {
    ...experiment(source),
    runs: [{ result: { finalMemory: { 200: 999 } } }],
  });
  await expect(page.locator(".studio-result-heading")).toContainText(
    "Counted loop",
  );
  await expect(page.locator(".studio-outputs tbody tr")).toHaveText(
    /2006(?:\s*)6Match/,
  );
  await page
    .getByRole("button", { name: "Inspect SIMD program run", exact: true })
    .click();
  await expect(page.locator(".program-studio [role=alert]")).toContainText(
    "straight-line",
  );
  await page
    .getByRole("button", { name: "Inspect SIMT program run", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Trace program output 200", exact: true })
    .click();
  await expect(
    page
      .locator(".graph-node")
      .filter({ has: page.locator("text", { hasText: "ADD" }) }),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "View source event", exact: true })
    .click();
  await expect(page.locator(".studio-event")).toContainText("Source line 30");
  await page
    .getByRole("button", { name: "Source line 30", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .getByLabel("Assembly source", { exact: true })
        .evaluate((input: HTMLTextAreaElement) => ({
          selection: input.value.slice(
            input.selectionStart,
            input.selectionEnd,
          ),
          scrolled: input.scrollTop > 0,
        })),
    )
    .toEqual({ selection: "STR R1, [200]", scrolled: true });
  await page
    .getByRole("button", { name: "First program event", exact: true })
    .click();
  await expect(page.getByLabel("Program trace position")).toHaveValue("0");
  await page.getByRole("button", { name: "Play program", exact: true }).click();
  await expect
    .poll(() => page.getByLabel("Program trace position").inputValue())
    .not.toBe("0");
  await page
    .getByRole("button", { name: "Pause program", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Final program event", exact: true })
    .click();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(page.locator(".studio-state-values")).toContainText(
    "memory[200]6",
  );
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export program experiment", exact: true })
    .click();
  const path = await (await downloaded).path();
  const saved = JSON.parse(await readFile(path!, "utf8"));
  expect(saved).toEqual(experiment(source));
  await page.screenshot({
    path: info.outputPath("program-replay.png"),
    fullPage: true,
  });
});

test("invalid drafts preserve results; bounded loops cannot claim verification", async ({
  page,
}) => {
  await edit(page);
  await page
    .getByLabel("Assembly source", { exact: true })
    .fill("; broken\nADD R1, 2");
  await page
    .getByRole("button", { name: "Run experiment", exact: true })
    .click();
  await expect(page.locator(".program-studio [role=alert]")).toContainText(
    "line 2",
  );
  await expect(page.locator(".studio-outputs .studio-pass")).toHaveCount(4);
  await page
    .getByLabel("Assembly source", { exact: true })
    .fill("LOOP: BRnzp nzp LOOP");
  await page.getByLabel("Program threads per block").fill("1");
  await page.getByLabel("Program expected memory").fill("{}");
  await page
    .getByRole("button", { name: "Run experiment", exact: true })
    .click();
  await expect(
    page.getByText("Event limit reached before every thread returned.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Extracted graph", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".studio-outputs .studio-pass")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Final program event", exact: true })
    .click();
  await expect(page.getByLabel("Program trace position")).toHaveValue("2499");
});

test("model-order differences remain visible; program layouts stay bounded", async ({
  page,
}, info) => {
  await importDocument(
    page,
    experiment(
      "LDR R0, [0]\nADD R0, R0, 1\nADD R1, %threadIdx, 128\nSTR R0, [R1]\nSTR R0, [0]\nRET",
      {
        name: "Shared memory ordering",
        blockDim: 2,
        laneWidth: 1,
        initialMemory: { 0: 0 },
        expectedMemory: { 128: 1, 129: 2 },
      },
    ),
  );
  await expect(
    page.getByText("Final memory, registers, or flags differ", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".studio-outputs .studio-fail")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Inspect Sequential program run",
      exact: true,
    })
    .click();
  await expect(page.locator(".studio-outputs .studio-fail")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Trace program output 129", exact: true })
    .click();
  for (const width of [320, 768, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    expect(overflow, `page overflow at ${width}`).toBe(false);
    const labels = await page
      .locator(".program-studio button:visible")
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => button.scrollWidth > button.clientWidth + 2)
          .map((button) => button.textContent),
      );
    expect(labels, `button overflow at ${width}`).toEqual([]);
  }
  await page.screenshot({
    path: info.outputPath("program-wide.png"),
    fullPage: true,
  });
});
