import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(__dirname, "fixtures", name);

test.describe("CSV upload", () => {
  test("uploading a valid CSV replaces the chart data", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("valid-transactions.csv"));

    await expect(page.locator("#csv-upload-status")).toContainText("Loaded 3 transaction(s)");
    await expect(page.locator("#total-count")).toContainText("3 transactions");
    await expect(page.locator("#total-spend")).toContainText("$1,575.50");

    // "All Time" preset should be re-selected for the newly loaded dataset.
    await expect(page.locator('.preset-btn[data-preset="all"]')).toHaveClass(/bg-slate-900/);
  });

  test("uploading a CSV with some invalid rows loads the valid ones and warns", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("mixed-validity-transactions.csv"));

    const status = page.locator("#csv-upload-status");
    await expect(status).toContainText("Loaded 2 transaction(s)");
    await expect(status).toContainText("skipped 2 row(s)");
    await expect(page.locator("#total-count")).toContainText("2 transactions");
  });

  test("uploading a CSV missing a required column shows an error and keeps prior data", async ({ page }) => {
    await page.goto("/index.html");

    const totalBefore = await page.locator("#total-count").textContent();

    await page.locator("#csv-upload").setInputFiles(fixture("missing-column-transactions.csv"));

    const status = page.locator("#csv-upload-status");
    await expect(status).toContainText("missing required column");
    await expect(status).toContainText("date");
    await expect(page.locator("#total-count")).toContainText(totalBefore);
  });

  test("uploading a CSV with no category column shows a review table with suggestions", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("missing-category-transactions.csv"));

    const review = page.locator("#category-review-section");
    await expect(review).toBeVisible();
    await expect(page.locator("#category-review-summary")).toContainText("3 rows have no category");

    const rows = page.locator("#category-review-rows tr");
    await expect(rows).toHaveCount(3);

    // A recognized merchant should be pre-selected with its suggested category.
    await expect(rows.nth(0).locator("select")).toHaveValue("Groceries");
    await expect(rows.nth(1).locator("select")).toHaveValue("Transportation");
    // An unrecognized merchant should default to "Uncategorized".
    await expect(rows.nth(2).locator("select")).toHaveValue("Uncategorized");

    // The chart shouldn't be replaced until the user applies the review.
    await expect(page.locator("#total-count")).not.toContainText("3 transactions");
  });

  test("applying the category review loads the data with chosen categories", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("missing-category-transactions.csv"));

    const rows = page.locator("#category-review-rows tr");
    await rows.nth(2).locator("select").selectOption("Local/Misc");

    await page.locator("#apply-category-review").click();

    await expect(page.locator("#category-review-section")).toBeHidden();
    await expect(page.locator("#csv-upload-status")).toContainText("Loaded 3 transaction(s)");
    await expect(page.locator("#total-count")).toContainText("3 transactions");

    const legendCategories = await page.locator("#category-legend li span.truncate").allTextContents();
    expect(legendCategories).toContain("Local/Misc");
  });

  test("cancelling the category review discards the upload", async ({ page }) => {
    await page.goto("/index.html");

    const totalBefore = await page.locator("#total-count").textContent();

    await page.locator("#csv-upload").setInputFiles(fixture("missing-category-transactions.csv"));
    await expect(page.locator("#category-review-section")).toBeVisible();

    await page.locator("#cancel-category-review").click();

    await expect(page.locator("#category-review-section")).toBeHidden();
    await expect(page.locator("#csv-upload-status")).toContainText("cancelled");
    await expect(page.locator("#total-count")).toContainText(totalBefore);
  });
});
