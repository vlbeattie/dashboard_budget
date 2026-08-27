#!/usr/bin/env node
// Derives a keyword -> category lookup from the descriptions already present
// in data/transactions.json, and writes it out as a committed ES module
// (js/category-rules.js) that the browser can import directly (no build step).
//
// Re-run this whenever data/transactions.json's descriptions change
// meaningfully:
//   node scripts/generate-category-rules.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "transactions.json");
const OUTPUT_PATH = path.join(__dirname, "..", "js", "category-rules.js");

// Short/generic words that appear across many merchants and categories, so
// they aren't reliable signals on their own (e.g. "fee", "service", "co").
const STOPWORDS = new Set([
  "the", "and", "for", "inc", "llc", "co", "com", "of", "to", "payment",
  "charge", "charges", "fee", "fees", "center", "service", "services",
  "store", "auto", "care", "local", "renewal", "premium", "policy",
]);

function tokenize(description) {
  return description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

function generateRules(transactions) {
  // phrase -> category (full lowercased description; already verified 1:1)
  const phraseToCategory = new Map();
  // token -> Set(category) (used to detect ambiguous tokens across categories)
  const tokenToCategories = new Map();

  for (const { description, category } of transactions) {
    if (!description) continue;
    const phrase = description.toLowerCase().trim();
    phraseToCategory.set(phrase, category);

    for (const token of tokenize(phrase)) {
      if (!tokenToCategories.has(token)) tokenToCategories.set(token, new Set());
      tokenToCategories.get(token).add(category);
    }
  }

  const rulesByCategory = new Map();
  const addKeyword = (category, keyword) => {
    if (!rulesByCategory.has(category)) rulesByCategory.set(category, new Set());
    rulesByCategory.get(category).add(keyword);
  };

  for (const [phrase, category] of phraseToCategory) {
    addKeyword(category, phrase);
  }
  for (const [token, categories] of tokenToCategories) {
    // Only keep tokens that unambiguously point to a single category.
    if (categories.size === 1) {
      addKeyword([...categories][0], token);
    }
  }

  return [...rulesByCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, keywords]) => ({
      category,
      keywords: [...keywords].sort((a, b) => b.length - a.length || a.localeCompare(b)),
    }));
}

const transactions = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const rules = generateRules(transactions);

const banner = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-category-rules.mjs
// (derives keyword -> category rules from data/transactions.json descriptions)
`;

const body = `${banner}
export const CATEGORY_RULES = ${JSON.stringify(rules, null, 2)};
`;

writeFileSync(OUTPUT_PATH, body);
console.log(`Wrote ${rules.length} category rule sets to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
