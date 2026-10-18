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

  test("uploading a CSV missing a required column prompts for a column mapping", async ({ page }) => {
    await page.goto("/index.html");

    const totalBefore = await page.locator("#total-count").textContent();

    await page.locator("#csv-upload").setInputFiles(fixture("missing-column-transactions.csv"));

    const mapping = page.locator("#column-mapping-section");
    await expect(mapping).toBeVisible();
    await expect(page.locator("#csv-upload-status")).toContainText("expected column names");

    // The chart shouldn't change until the mapping is confirmed.
    await expect(page.locator("#total-count")).toContainText(totalBefore);

    // The only missing canonical column here is "date" — substitute "Txn Date".
    await mapping.locator('select[data-mapping-field="date"]').selectOption("Txn Date");
    await page.locator("#confirm-column-mapping").click();

    await expect(mapping).toBeHidden();
    await expect(page.locator("#csv-upload-status")).toContainText("Loaded 1 transaction(s)");
    await expect(page.locator("#total-count")).toContainText("1 transaction");
  });

  test("confirming a column mapping without picking a required column shows an error", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("missing-column-transactions.csv"));
    await page.locator("#confirm-column-mapping").click();

    await expect(page.locator("#column-mapping-error")).toBeVisible();
    await expect(page.locator("#column-mapping-error")).toContainText("Date");
    await expect(page.locator("#column-mapping-section")).toBeVisible();
  });

  test("cancelling the column mapping discards the upload", async ({ page }) => {
    await page.goto("/index.html");

    const totalBefore = await page.locator("#total-count").textContent();

    await page.locator("#csv-upload").setInputFiles(fixture("missing-column-transactions.csv"));
    await expect(page.locator("#column-mapping-section")).toBeVisible();

    await page.locator("#cancel-column-mapping").click();

    await expect(page.locator("#column-mapping-section")).toBeHidden();
    await expect(page.locator("#csv-upload-status")).toContainText("cancelled");
    await expect(page.locator("#total-count")).toContainText(totalBefore);
  });

  test("uploading a CSV with no recognizable date/amount/description/category columns requires mapping all of them", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("alternate-column-names-transactions.csv"));

    const mapping = page.locator("#column-mapping-section");
    await expect(mapping).toBeVisible();
    await expect(mapping.locator('select[data-mapping-field="date"]')).toBeVisible();
    await expect(mapping.locator('select[data-mapping-field="amount"]')).toBeVisible();
    // Neither description nor category was auto-detected, so both show up
    // as optional substitutes (at least one is required).
    await expect(mapping.locator('select[data-mapping-field="description"]')).toBeVisible();
    await expect(mapping.locator('select[data-mapping-field="category"]')).toBeVisible();

    // Leaving both description and category unmapped should be rejected.
    await mapping.locator('select[data-mapping-field="date"]').selectOption("Transaction Date");
    await mapping.locator('select[data-mapping-field="amount"]').selectOption("Debit Amount");
    await page.locator("#confirm-column-mapping").click();
    await expect(page.locator("#column-mapping-error")).toContainText("Description or Category");

    await mapping.locator('select[data-mapping-field="description"]').selectOption("Transaction Memo");
    await page.locator("#confirm-column-mapping").click();

    await expect(mapping).toBeHidden();
    // Both rows have unrecognized-by-category descriptions that *are*
    // recognized merchants, so they should land in the category review step.
    await expect(page.locator("#category-review-section")).toBeVisible();
    const rows = page.locator("#category-review-rows tr");
    await expect(rows.nth(0).locator("select")).toHaveValue("Groceries");
    await expect(rows.nth(1).locator("select")).toHaveValue("Transportation");

    await page.locator("#apply-category-review").click();
    await expect(page.locator("#total-count")).toContainText("2 transactions");
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

  test("creating a new category during review adds it and makes it reusable for other rows", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#csv-upload").setInputFiles(fixture("missing-category-transactions.csv"));

    const rows = page.locator("#category-review-rows tr");
    const thirdRowSelect = rows.nth(2).locator("select");
    await thirdRowSelect.selectOption("__new_category__");

    const newCategoryCell = rows.nth(2).locator("[data-category-cell]");
    await newCategoryCell.locator("[data-new-category-input]").fill("Hobbies");
    await newCategoryCell.locator("[data-new-category-confirm]").click();

    // The select should now show the newly created category...
    await expect(thirdRowSelect).toHaveValue("Hobbies");
    // ...and it should be available as an option on other rows too.
    await expect(rows.nth(0).locator("select option", { hasText: "Hobbies" })).toHaveCount(1);

    await page.locator("#apply-category-review").click();

    await expect(page.locator("#total-count")).toContainText("3 transactions");
    const legendCategories = await page.locator("#category-legend li span.truncate").allTextContents();
    expect(legendCategories).toContain("Hobbies");
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
