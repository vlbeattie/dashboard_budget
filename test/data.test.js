import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterByDateRange,
  getDataDateBounds,
  getPresetRange,
  aggregateByCategory,
  groupSmallCategories,
  getTransactionsForCategory,
} from "../js/data.js";

const fixture = [
  { date: "2026-01-05", category: "Groceries", amount: 100 },
  { date: "2026-01-15", category: "Groceries", amount: 50 },
  { date: "2026-02-01", category: "Rent", amount: 1500 },
  { date: "2026-02-10", category: "Entertainment", amount: 20 },
  { date: "2026-03-01", category: "Health", amount: 5 },
  { date: "2026-03-20", category: "Rent", amount: 1500 },
];

describe("filterByDateRange", () => {
  test("includes transactions within an inclusive range", () => {
    const result = filterByDateRange(fixture, "2026-02-01", "2026-02-28");
    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((t) => t.category),
      ["Rent", "Entertainment"]
    );
  });

  test("returns an empty array when nothing matches", () => {
    const result = filterByDateRange(fixture, "2025-01-01", "2025-12-31");
    assert.deepEqual(result, []);
  });

  test("boundary dates are inclusive", () => {
    const result = filterByDateRange(fixture, "2026-01-05", "2026-01-05");
    assert.equal(result.length, 1);
    assert.equal(result[0].amount, 100);
  });
});

describe("getDataDateBounds", () => {
  test("finds the min and max dates in the dataset", () => {
    const { min, max } = getDataDateBounds(fixture);
    assert.equal(min, "2026-01-05");
    assert.equal(max, "2026-03-20");
  });
});

describe("getPresetRange", () => {
  test("'all' spans the full dataset", () => {
    const range = getPresetRange("all", fixture);
    assert.deepEqual(range, { start: "2026-01-05", end: "2026-03-20" });
  });

  test("'this-month' is anchored on the dataset's latest date, not real today", () => {
    const range = getPresetRange("this-month", fixture);
    assert.deepEqual(range, { start: "2026-03-01", end: "2026-03-20" });
  });

  test("'last-month' covers the full prior calendar month", () => {
    const range = getPresetRange("last-month", fixture);
    assert.deepEqual(range, { start: "2026-02-01", end: "2026-02-28" });
  });

  test("'last-3-months' spans from two months back through the latest date", () => {
    const range = getPresetRange("last-3-months", fixture);
    assert.deepEqual(range, { start: "2026-01-01", end: "2026-03-20" });
  });

  test("throws on an unknown preset", () => {
    assert.throws(() => getPresetRange("nonexistent", fixture));
  });
});

describe("aggregateByCategory", () => {
  test("sums amounts per category, sorted descending by total", () => {
    const result = aggregateByCategory(fixture);
    assert.deepEqual(result, [
      { category: "Rent", total: 3000 },
      { category: "Groceries", total: 150 },
      { category: "Entertainment", total: 20 },
      { category: "Health", total: 5 },
    ]);
  });

  test("returns an empty array for no transactions", () => {
    assert.deepEqual(aggregateByCategory([]), []);
  });
});

describe("groupSmallCategories", () => {
  test("groups categories below the threshold into 'Other'", () => {
    const aggregated = aggregateByCategory(fixture);
    // grand total = 3175; threshold 0.02 (2%) => anything under ~63.5 is "Other"
    const { slices, otherBreakdown, grandTotal } = groupSmallCategories(aggregated, 0.02);

    assert.equal(grandTotal, 3175);
    assert.deepEqual(
      slices.map((s) => s.category),
      ["Rent", "Groceries", "Other"]
    );
    assert.deepEqual(
      otherBreakdown.map((s) => s.category).sort(),
      ["Entertainment", "Health"]
    );
    const otherSlice = slices.find((s) => s.category === "Other");
    assert.equal(otherSlice.total, 25);
  });

  test("omits the 'Other' slice entirely when nothing falls below threshold", () => {
    const aggregated = aggregateByCategory(fixture);
    const { slices, otherBreakdown } = groupSmallCategories(aggregated, 0);
    assert.equal(otherBreakdown.length, 0);
    assert.ok(!slices.some((s) => s.category === "Other"));
  });

  test("handles an empty input without dividing by zero", () => {
    const result = groupSmallCategories([]);
    assert.deepEqual(result, { slices: [], otherBreakdown: [], grandTotal: 0 });
  });
});

describe("getTransactionsForCategory", () => {
  test("returns only matching transactions, sorted by date descending", () => {
    const result = getTransactionsForCategory(fixture, "Rent");
    assert.deepEqual(
      result.map((t) => t.date),
      ["2026-03-20", "2026-02-01"]
    );
  });

  test("returns an empty array when the category has no transactions", () => {
    assert.deepEqual(getTransactionsForCategory(fixture, "Nonexistent"), []);
  });

  test("does not mutate the input array", () => {
    const copy = [...fixture];
    getTransactionsForCategory(fixture, "Groceries");
    assert.deepEqual(fixture, copy);
  });
});
