import { test, expect } from "@playwright/test";

test.describe("Spending by Category page", () => {
  test("renders the pie chart with a legend and total on load", async ({ page }) => {
    await page.goto("/index.html");

    await expect(page.locator("#category-pie-chart")).toBeVisible();
    await expect(page.locator("#category-legend li").first()).toBeVisible();
    await expect(page.locator("#total-spend")).toContainText("$");
    await expect(page.locator("#total-count")).toContainText("transactions");
  });

  test("'All Time' preset is selected by default and shows every transaction", async ({ page }) => {
    await page.goto("/index.html");

    const allTimeBtn = page.locator('.preset-btn[data-preset="all"]');
    await expect(allTimeBtn).toHaveClass(/bg-slate-900/);
    await expect(page.locator("#total-count")).toContainText("248 transactions");
  });

  test("switching presets updates the total and legend", async ({ page }) => {
    await page.goto("/index.html");

    const allTimeTotal = await page.locator("#total-spend").textContent();

    await page.locator('.preset-btn[data-preset="this-month"]').click();
    await expect(page.locator('.preset-btn[data-preset="this-month"]')).toHaveClass(/bg-slate-900/);

    const thisMonthTotal = await page.locator("#total-spend").textContent();
    expect(thisMonthTotal).not.toEqual(allTimeTotal);
  });

  test("custom date range filters the chart and clears preset selection", async ({ page }) => {
    await page.goto("/index.html");

    await page.locator("#start-date").fill("2026-04-25");
    await page.locator("#end-date").fill("2026-04-27");

    // Selecting a custom range should deselect all presets.
    for (const preset of ["this-month", "last-month", "last-3-months", "all"]) {
      await expect(page.locator(`.preset-btn[data-preset="${preset}"]`)).not.toHaveClass(/bg-slate-900/);
    }

    await expect(page.locator("#total-count")).not.toContainText("248 transactions");
  });

  test("'Other' breakdown section appears and lists grouped categories", async ({ page }) => {
    await page.goto("/index.html");

    const section = page.locator("#other-breakdown-section");
    await expect(section).toBeVisible();
    await expect(page.locator("#other-breakdown-list li").first()).toBeVisible();
  });
});
