// Shared data loading and aggregation utilities for the budget dashboard.
// Categories below OTHER_THRESHOLD (as a fraction of total spend) are grouped
// into a single "Other" slice to keep the pie chart readable.
const OTHER_THRESHOLD = 0.02;

/**
 * Fetches and parses the transactions JSON file.
 * @returns {Promise<Array<{date: string, category: string, amount: number}>>}
 */
async function loadTransactions() {
  const response = await fetch("data/transactions.json");
  if (!response.ok) {
    throw new Error(`Failed to load transactions.json: ${response.status}`);
  }
  return response.json();
}

/**
 * Returns only the transactions with date in [start, end] (inclusive),
 * comparing as ISO date strings ("YYYY-MM-DD").
 */
function filterByDateRange(transactions, start, end) {
  return transactions.filter((t) => t.date >= start && t.date <= end);
}

/** Returns the earliest and latest transaction dates ("YYYY-MM-DD") in the dataset. */
function getDataDateBounds(transactions) {
  const dates = transactions.map((t) => t.date).sort();
  return { min: dates[0], max: dates[dates.length - 1] };
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Computes a { start, end } date range (ISO strings) for a named preset,
 * anchored on the most recent transaction date in the dataset (rather than
 * the real "today") since this sample data is dated in the future.
 */
function getPresetRange(preset, transactions) {
  const { min, max } = getDataDateBounds(transactions);
  const anchor = new Date(`${max}T00:00:00`);

  if (preset === "all") {
    return { start: min, end: max };
  }

  if (preset === "this-month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { start: toISODate(start), end: max };
  }

  if (preset === "last-month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth(), 0);
    return { start: toISODate(start), end: toISODate(end) };
  }

  if (preset === "last-3-months") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1);
    return { start: toISODate(start), end: max };
  }

  throw new Error(`Unknown preset: ${preset}`);
}

/**
 * Aggregates transactions by category, returning entries sorted by total
 * amount descending: [{ category, total }, ...]
 */
function aggregateByCategory(transactions) {
  const totals = new Map();
  for (const t of transactions) {
    totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
  }
  return Array.from(totals, ([category, total]) => ({ category, total })).sort(
    (a, b) => b.total - a.total
  );
}

/**
 * Groups categories that individually make up less than OTHER_THRESHOLD of
 * the grand total into a single "Other" entry.
 * @returns {{ slices: Array<{category, total}>, otherBreakdown: Array<{category, total}>, grandTotal: number }}
 */
function groupSmallCategories(aggregated, threshold = OTHER_THRESHOLD) {
  const grandTotal = aggregated.reduce((sum, e) => sum + e.total, 0);
  if (grandTotal === 0) {
    return { slices: [], otherBreakdown: [], grandTotal: 0 };
  }

  const main = [];
  const otherBreakdown = [];
  for (const entry of aggregated) {
    if (entry.total / grandTotal < threshold) {
      otherBreakdown.push(entry);
    } else {
      main.push(entry);
    }
  }

  const slices = [...main];
  if (otherBreakdown.length > 0) {
    const otherTotal = otherBreakdown.reduce((sum, e) => sum + e.total, 0);
    slices.push({ category: "Other", total: otherTotal });
  }

  return { slices, otherBreakdown, grandTotal };
}
