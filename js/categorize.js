// Suggests a spending category for a transaction description using two
// layers of static, fully offline keyword dictionaries — no network calls,
// AI models, or external services are involved:
//   1. js/category-rules.js — derived from the app's own transaction history
//      (see scripts/generate-category-rules.mjs), tried first since it
//      reflects how *this* data has actually been categorized.
//   2. js/merchant-keywords.js — a hand-curated fallback list of well-known
//      national merchant/brand names (grocery chains, gas stations, airlines,
//      restaurants, etc.), tried only when the first layer finds no match.
// Both are plain, transparent substring matches that a user can inspect,
// review, and override before anything is applied.

import { CATEGORY_RULES } from "./category-rules.js";
import { MERCHANT_KEYWORDS } from "./merchant-keywords.js";

/**
 * Suggests a category for a free-text transaction description using a single
 * set of keyword rules.
 *
 * Matches the description (case-insensitively) against known keywords/merchant
 * phrases; the longest matching keyword wins, since longer phrases are more
 * specific (e.g. "amazon gift order" beats a generic single-word match).
 *
 * @param {string} description
 * @param {{category: string, keywords: string[]}[]} [rules]
 * @returns {{category: string, matchedKeyword: string} | null}
 */
export function suggestCategory(description, rules = CATEGORY_RULES) {
  if (!description || typeof description !== "string") return null;

  const normalized = description.toLowerCase().trim();
  if (!normalized) return null;

  let best = null;

  for (const { category, keywords } of rules) {
    for (const keyword of keywords) {
      if (!normalized.includes(keyword)) continue;
      if (!best || keyword.length > best.matchedKeyword.length) {
        best = { category, matchedKeyword: keyword };
      }
    }
  }

  return best;
}

/**
 * Suggests a category by matching against every rule set in `tiers`, keeping
 * whichever match has the longest (most specific) matched keyword overall —
 * since a longer, more specific phrase (e.g. "royal farms" or "credit card
 * payment") is far more likely to be correct than an incidental generic
 * single-word match (e.g. "farm" or "card"). Ties are broken in favor of the
 * earlier tier, so the app's own historical data (js/category-rules.js) is
 * preferred over the curated public merchant list when both match equally.
 *
 * @param {string} description
 * @param {{category: string, keywords: string[]}[][]} [tiers]
 * @returns {{category: string, matchedKeyword: string} | null}
 */
export function suggestCategoryTiered(description, tiers = [CATEGORY_RULES, MERCHANT_KEYWORDS]) {
  let best = null;

  tiers.forEach((rules, tierIndex) => {
    const match = suggestCategory(description, rules);
    if (!match) return;
    if (
      !best ||
      match.matchedKeyword.length > best.matchedKeyword.length ||
      (match.matchedKeyword.length === best.matchedKeyword.length && tierIndex < best.tierIndex)
    ) {
      best = { ...match, tierIndex };
    }
  });

  if (!best) return null;
  const { category, matchedKeyword } = best;
  return { category, matchedKeyword };
}

/**
 * Suggests categories for a batch of transactions, returning only the rows
 * that need review: those with a missing/blank category, paired with the
 * best available suggestion (or null if nothing matched).
 *
 * @param {{category?: string, description?: string}[]} transactions
 * @param {(description: string) => {category: string, matchedKeyword: string} | null} [suggester]
 * @returns {{index: number, transaction: object, suggestion: {category: string, matchedKeyword: string} | null}[]}
 */
export function suggestCategoriesForReview(transactions, suggester = suggestCategoryTiered) {
  const results = [];
  transactions.forEach((transaction, index) => {
    const hasCategory = typeof transaction.category === "string" && transaction.category.trim() !== "";
    if (hasCategory) return;
    results.push({
      index,
      transaction,
      suggestion: suggester(transaction.description),
    });
  });
  return results;
}

export const UNCATEGORIZED = "Uncategorized";
