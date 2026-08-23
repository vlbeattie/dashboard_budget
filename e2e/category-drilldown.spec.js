import { test, expect } from "@playwright/test";

test.describe("Category drill-down", () => {
  test("clicking a legend category shows its transaction detail table", async ({ page }) => {
    await page.goto("/index.html");

    const groceriesRow = page.locator("#category-legend li", { hasText: "Groceries" });
    await groceriesRow.locator("button").click();

    const detail = page.locator("#category-detail-section");
    await expect(detail).toBeVisible();
    await expect(page.locator("#category-detail-title")).toContainText("Groceries");
    await expect(page.locator("#category-detail-title")).toContainText("transaction");

    const rows = page.locator("#category-detail-rows tr");
    await expect(rows.first()).toBeVisible();

    // Rows should be sorted by date descending.
    const dates = await rows.locator("td:first-child").allTextContents();
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  test("clicking the same legend category again clears the selection", async ({ page }) => {
    await page.goto("/index.html");

    const groceriesRow = page.locator("#category-legend li", { hasText: "Groceries" });
    await groceriesRow.locator("button").click();
    await expect(page.locator("#category-detail-section")).toBeVisible();

    await groceriesRow.locator("button").click();
    await expect(page.locator("#category-detail-section")).toBeHidden();
  });

  test("'× Clear selection' button hides the detail table", async ({ page }) => {
    await page.goto("/index.html");

    const groceriesRow = page.locator("#category-legend li", { hasText: "Groceries" });
    await groceriesRow.locator("button").click();
    await expect(page.locator("#category-detail-section")).toBeVisible();

    await page.locator("#clear-category-selection").click();
    await expect(page.locator("#category-detail-section")).toBeHidden();
  });

  test("clicking an 'Other' breakdown row drills into that sub-category", async ({ page }) => {
    await page.goto("/index.html");

    const otherRow = page.locator("#other-breakdown-list li").first();
    const categoryName = (await otherRow.locator("span").first().textContent()).trim();

    await otherRow.locator("button").click();

    const detail = page.locator("#category-detail-section");
    await expect(detail).toBeVisible();
    await expect(page.locator("#category-detail-title")).toContainText(categoryName);
  });

  test("clicking the top-level 'Other' legend row highlights it without showing a detail table", async ({
    page,
  }) => {
    await page.goto("/index.html");

    const otherLegendRow = page.locator("#category-legend li", { hasText: "Other" });
    await otherLegendRow.locator("button").click();

    await expect(otherLegendRow.locator("button")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#category-detail-section")).toBeHidden();
  });

  test("changing the date range clears an active category selection", async ({ page }) => {
    await page.goto("/index.html");

    const groceriesRow = page.locator("#category-legend li", { hasText: "Groceries" });
    await groceriesRow.locator("button").click();
    await expect(page.locator("#category-detail-section")).toBeVisible();

    await page.locator('.preset-btn[data-preset="this-month"]').click();
    await expect(page.locator("#category-detail-section")).toBeHidden();
  });
});
