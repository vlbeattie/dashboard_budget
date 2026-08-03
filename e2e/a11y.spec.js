import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  test("index.html has no automatically detectable WCAG2 A/AA violations", async ({ page }) => {
    await page.goto("/index.html");
    // Wait for the chart/legend to finish rendering, and for the preset
    // button's color transition to settle, before scanning.
    await expect(page.locator("#category-legend li").first()).toBeVisible();
    await page.waitForTimeout(350);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
