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
});
