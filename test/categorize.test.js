import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  suggestCategory,
  suggestCategoryTiered,
  suggestCategoriesForReview,
} from "../js/categorize.js";
import { CATEGORY_RULES } from "../js/category-rules.js";
import { MERCHANT_KEYWORDS } from "../js/merchant-keywords.js";

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

describe("suggestCategoryTiered", () => {
  const tier1 = [{ category: "Insurance", keywords: ["farm"] }];
  const tier2 = [
    { category: "Groceries", keywords: ["royal farms"] },
    { category: "Shopping-General Merchandise", keywords: ["target"] },
  ];

  test("uses the first tier when it has the only match", () => {
    const result = suggestCategoryTiered("STATE FARM AUTO PAY", [tier1, tier2]);
    assert.deepEqual(result, { category: "Insurance", matchedKeyword: "farm" });
  });

  test("falls back to a later tier when the first tier has no match", () => {
    const result = suggestCategoryTiered("TARGET T-1234 ARLINGTON VA", [tier1, tier2]);
    assert.deepEqual(result, { category: "Shopping-General Merchandise", matchedKeyword: "target" });
  });

  test("prefers a longer/more specific match from a later tier over a shorter generic match from an earlier tier", () => {
    const result = suggestCategoryTiered("ROYAL FARMS #456", [tier1, tier2]);
    assert.deepEqual(result, { category: "Groceries", matchedKeyword: "royal farms" });
  });

  test("prefers the earlier tier on an exact-length tie", () => {
    const tierA = [{ category: "A", keywords: ["match"] }];
    const tierB = [{ category: "B", keywords: ["match"] }];
    const result = suggestCategoryTiered("this is a match", [tierA, tierB]);
    assert.equal(result.category, "A");
  });

  test("returns null when no tier matches", () => {
    assert.equal(suggestCategoryTiered("Some Unrecognized Merchant", [tier1, tier2]), null);
  });

  test("defaults to the app's real CATEGORY_RULES and MERCHANT_KEYWORDS tiers", () => {
    // "ExxonMobil" is only known via the curated merchant-keywords fallback,
    // not the app's own generated transaction history.
    const result = suggestCategoryTiered("ExxonMobil #1234");
    assert.equal(result.category, "Travel-Lodging/Booking");
  });
});

describe("MERCHANT_KEYWORDS data integrity", () => {
  test("has no duplicate keywords across categories", () => {
    const seen = new Map();
    for (const { category, keywords } of MERCHANT_KEYWORDS) {
      for (const keyword of keywords) {
        assert.ok(!seen.has(keyword), `duplicate keyword "${keyword}" in "${category}" (also in "${seen.get(keyword)}")`);
        seen.set(keyword, category);
      }
    }
  });

  test("has no conflicts with the generated CATEGORY_RULES tier", () => {
    const generatedKeywords = new Map();
    for (const { category, keywords } of CATEGORY_RULES) {
      for (const keyword of keywords) generatedKeywords.set(keyword, category);
    }
    for (const { category, keywords } of MERCHANT_KEYWORDS) {
      for (const keyword of keywords) {
        const existing = generatedKeywords.get(keyword);
        if (existing) {
          assert.equal(existing, category, `keyword "${keyword}" maps to "${existing}" in CATEGORY_RULES but "${category}" in MERCHANT_KEYWORDS`);
        }
      }
    }
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
