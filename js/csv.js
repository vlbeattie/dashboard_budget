// CSV parsing and validation for the "upload your own data" feature.
// Uses PapaParse (loaded globally via CDN script in index.html) to parse the
// raw CSV text, then validates/normalizes rows into the same shape used by
// data.js: { date: "YYYY-MM-DD", category: string, amount: number, ...rest }.
// Extra columns beyond date/category/amount (e.g. "description") are kept
// on each transaction object unchanged, even though they aren't used yet.
// "category" is optional: rows with a missing/blank category are kept with
// category set to "" so the caller can offer auto-suggested categories (see
// js/categorize.js) for review instead of discarding the row.

/** Case-insensitively finds the actual header name matching `target`, or null. */
export function findHeader(headers, target) {
  return headers.find((h) => h.trim().toLowerCase() === target) ?? null;
}

/**
 * Parses a "YYYY-MM-DD", "MM/DD/YYYY", or "M/D/YYYY" date string into ISO
 * "YYYY-MM-DD" form. Returns null if the string doesn't match a supported
 * format or isn't a real calendar date.
 */
export function normalizeDate(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return isValidCalendarDate(+year, +month, +day) ? value : null;
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    if (!isValidCalendarDate(+year, +month, +day)) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function isValidCalendarDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Parses an amount string like "$1,234.56" or "42.61" into a finite number, or null. */
export function normalizeAmount(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/[$,]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses and validates CSV text into transaction objects.
 * @param {string} csvText
 * @param {(csv: string, options: object) => object} [papaParse] Defaults to the
 *   global `Papa.parse` (loaded via CDN in the browser). A parser can be
 *   injected here for unit testing in Node.
 * @returns {{ transactions: Array<object>, warnings: string[], errors: string[] }}
 */
export function parseTransactionsCsv(
  csvText,
  papaParse = typeof Papa !== "undefined" ? Papa.parse.bind(Papa) : undefined
) {
  if (!papaParse) {
    throw new Error("No CSV parser available: Papa Parse was not found.");
  }
  const parsed = papaParse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const errors = [];
  const warnings = [];

  const headers = parsed.meta?.fields ?? [];
  const dateHeader = findHeader(headers, "date");
  const categoryHeader = findHeader(headers, "category");
  const amountHeader = findHeader(headers, "amount");

  // "category" is optional: rows with a missing/blank category are kept (with
  // category set to "") so the caller can offer auto-suggested categories for
  // review, rather than silently discarding those rows.
  const missing = [!dateHeader && "date", !amountHeader && "amount"].filter(Boolean);

  if (missing.length > 0) {
    errors.push(
      `CSV is missing required column(s): ${missing.join(", ")}. Found columns: ${
        headers.length > 0 ? headers.join(", ") : "(none)"
      }.`
    );
    return { transactions: [], warnings, errors };
  }

  if (parsed.errors && parsed.errors.length > 0) {
    for (const e of parsed.errors) {
      warnings.push(`Row ${e.row + 2}: ${e.message}`);
    }
  }

  const transactions = [];
  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for 0-index, +1 for the header row
    const date = normalizeDate(row[dateHeader]);
    const category = categoryHeader ? (row[categoryHeader] ?? "").toString().trim() : "";
    const amount = normalizeAmount(row[amountHeader]);

    if (!date) {
      warnings.push(`Row ${rowNumber}: skipped — invalid or missing date "${row[dateHeader] ?? ""}".`);
      return;
    }
    if (amount === null) {
      warnings.push(`Row ${rowNumber}: skipped — invalid or missing amount "${row[amountHeader] ?? ""}".`);
      return;
    }

    // Preserve any extra columns (e.g. "description") unchanged.
    const extra = { ...row };
    delete extra[dateHeader];
    if (categoryHeader) delete extra[categoryHeader];
    delete extra[amountHeader];

    transactions.push({ date, category, amount, ...extra });
  });

  if (transactions.length === 0) {
    errors.push("No valid transaction rows were found in the uploaded CSV.");
  }

  return { transactions, warnings, errors };
}
