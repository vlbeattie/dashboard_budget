import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(__dirname, "fixtures", name);

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

  test("the category-review table has no automatically detectable WCAG2 A/AA violations", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("missing-category-transactions.csv"));
    await expect(page.locator("#category-review-section")).toBeVisible();
    // Let the preset button's color transition settle before scanning (same
    // as above) to avoid a false-positive contrast reading mid-transition.
    await page.waitForTimeout(350);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
