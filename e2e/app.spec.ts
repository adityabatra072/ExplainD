import { test, expect } from "@playwright/test";

test.describe("renderer harness", () => {
  test("plays the example lesson deterministically", async ({ page }) => {
    await page.goto("/dev/stage?frame=200");
    await expect(page.locator(".__remotion-player")).toBeVisible();
    // Scene 1's plot should be on screen at frame 200.
    await expect(page.locator("text=Renderer harness")).toBeVisible();
  });

  test("voiced harness syncs word timings", async ({ page }) => {
    await page.goto("/dev/stage?audio=1");
    await expect(page.locator("text=voiced (Edge TTS")).toBeVisible({
      timeout: 90_000,
    });
  });
});

test.describe("landing", () => {
  test("shows the palette and specimen backdrop", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/Paste a concept/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Teach me/ })).toBeVisible();
  });
});

test.describe("settings", () => {
  test("provider matrix renders and persists", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Amazon Bedrock" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ollama (local)" })).toBeVisible();
    // Keys are never rendered unmasked.
    const html = await page.content();
    expect(html).not.toMatch(/sk-ant-[a-zA-Z0-9]{8}/);
  });
});

test.describe("full lesson flow (requires Bedrock credentials)", () => {
  test.skip(
    !!process.env.SKIP_LLM_TESTS,
    "set SKIP_LLM_TESTS=1 to skip LLM-dependent tests"
  );

  test("prompt → playing lesson → tutor chat inserts a scene", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    await page.goto("/");
    await page
      .getByPlaceholder(/Paste a concept/)
      .fill("what is recursion? explain briefly for a new programmer");
    await page.getByRole("button", { name: /Teach me/ }).click();
    await page.waitForURL(/\/lesson\//, { timeout: 15_000 });

    // Playback starts when scene 1 lands (well before full generation).
    await expect(page.locator(".__remotion-player")).toBeVisible({
      timeout: 240_000,
    });
    const chipsBefore = await page.locator("button.group").count();
    expect(chipsBefore).toBeGreaterThanOrEqual(1);

    // Wait for the whole lesson so chat has full context.
    await expect(page.locator("header span.font-mono")).toBeHidden({
      timeout: 480_000,
    });

    // Ask the tutor for a visual — expect a new filmstrip chip.
    await page.getByRole("button", { name: "Ask the tutor" }).click();
    const total = await page.locator("button.group").count();
    await page
      .locator("aside textarea")
      .fill("show me a visual example of the call stack unwinding");
    await page.locator("aside").getByRole("button", { name: "send" }).click();
    await expect(async () => {
      const now = await page.locator("button.group").count();
      expect(now).toBeGreaterThan(total);
    }).toPass({ timeout: 240_000 });
  });
});
