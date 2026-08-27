// Suggests a spending category for a transaction description using a static
// keyword dictionary derived from the app's own sample data (see
// scripts/generate-category-rules.mjs and js/category-rules.js). No network
// calls, AI models, or external services are involved — this is a simple,
// fully transparent substring match that a user can inspect or edit.

import { CATEGORY_RULES } from "./category-rules.js";

/**
 * Suggests a category for a free-text transaction description.
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
      // Keywords within a category are pre-sorted longest-first, so the
      // first hit in this inner loop is already that category's best match.
      break;
    }
  }

  return best;
}

/**
 * Suggests categories for a batch of transactions, returning only the rows
 * that need review: those with a missing/blank category, paired with the
 * best available suggestion (or null if nothing matched).
 *
 * @param {{category?: string, description?: string}[]} transactions
 * @returns {{index: number, transaction: object, suggestion: {category: string, matchedKeyword: string} | null}[]}
 */
export function suggestCategoriesForReview(transactions) {
  const results = [];
  transactions.forEach((transaction, index) => {
    const hasCategory = typeof transaction.category === "string" && transaction.category.trim() !== "";
    if (hasCategory) return;
    results.push({
      index,
      transaction,
      suggestion: suggestCategory(transaction.description),
    });
  });
  return results;
}

export const UNCATEGORIZED = "Uncategorized";
