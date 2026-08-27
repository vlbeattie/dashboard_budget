import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { suggestCategory, suggestCategoriesForReview } from "../js/categorize.js";

const testRules = [
  { category: "Groceries", keywords: ["whole foods market", "trader joe's", "safeway", "trader"] },
  { category: "Shopping-General Merchandise", keywords: ["amazon.com", "best buy"] },
  { category: "Gifts & Donations", keywords: ["amazon gift order"] },
];

describe("suggestCategory", () => {
  test("matches a full keyword phrase case-insensitively", () => {
    const result = suggestCategory("SAFEWAY #123 ARLINGTON VA", testRules);
    assert.deepEqual(result, { category: "Groceries", matchedKeyword: "safeway" });
  });

  test("prefers the longest/most specific matching keyword", () => {
    const result = suggestCategory("amazon gift order confirmation", testRules);
    assert.equal(result.category, "Gifts & Donations");
    assert.equal(result.matchedKeyword, "amazon gift order");
  });

  test("falls back to a shorter keyword when only that matches", () => {
    const result = suggestCategory("AMAZON.COM*AB123", testRules);
    assert.equal(result.category, "Shopping-General Merchandise");
  });

  test("returns null when nothing matches", () => {
    assert.equal(suggestCategory("Some Unrecognized Merchant", testRules), null);
  });

  test("returns null for empty, missing, or non-string descriptions", () => {
    assert.equal(suggestCategory("", testRules), null);
    assert.equal(suggestCategory(undefined, testRules), null);
    assert.equal(suggestCategory("   ", testRules), null);
  });
});

describe("suggestCategoriesForReview", () => {
  test("only returns rows with a missing or blank category", () => {
    const transactions = [
      { date: "2026-01-01", category: "Groceries", description: "Safeway", amount: 10 },
      { date: "2026-01-02", category: "", description: "Trader Joe's", amount: 20 },
      { date: "2026-01-03", description: "Amazon.com", amount: 30 },
    ];
    const result = suggestCategoriesForReview(transactions);
    assert.equal(result.length, 2);
    assert.equal(result[0].index, 1);
    assert.equal(result[0].suggestion.category, "Groceries");
    assert.equal(result[1].index, 2);
    assert.equal(result[1].suggestion.category, "Shopping-General Merchandise");
  });

  test("includes rows with no keyword match, with a null suggestion", () => {
    const transactions = [{ date: "2026-01-01", description: "Mystery Merchant", amount: 5 }];
    const result = suggestCategoriesForReview(transactions);
    assert.equal(result.length, 1);
    assert.equal(result[0].suggestion, null);
  });

  test("returns an empty array when every row already has a category", () => {
    const transactions = [{ date: "2026-01-01", category: "Health", description: "CVS", amount: 5 }];
    assert.deepEqual(suggestCategoriesForReview(transactions), []);
  });
});
