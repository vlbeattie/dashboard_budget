// CSV parsing and validation for the "upload your own data" feature.
// Uses PapaParse (installed as an npm dependency, see package.json) to parse
// the raw CSV text, then validates/normalizes rows into the same shape used
// by data.js: { date: "YYYY-MM-DD", category: string, amount: number, ...rest }.
// "date", "category", "amount", and "description" columns are recognized
// case-insensitively and normalized to those canonical (lowercase) keys.
// Any other extra columns are kept on each transaction object unchanged,
// under their original header name, even though they aren't used yet.
// "category" is optional: rows with a missing/blank category are kept with
// category set to "" so the caller can offer auto-suggested categories (see
// js/categorize.js) for review instead of discarding the row.

import Papa from "papaparse";

/** The canonical transaction fields the app recognizes, in display order. */
export const CANONICAL_COLUMNS = ["date", "amount", "description", "category"];
/** Canonical fields that every CSV must resolve to a column (no substitute allowed to skip them). */
export const REQUIRED_CANONICAL_COLUMNS = ["date", "amount"];

/** Case-insensitively finds the actual header name matching `target`, or null. */
export function findHeader(headers, target) {
  return headers.find((h) => h.trim().toLowerCase() === target) ?? null;
}

/**
 * Parses just the header row of a CSV (cheap — only reads the first row),
 * returning the list of column names as found in the file.
 * @param {string} csvText
 * @param {(csv: string, options: object) => object} [papaParse]
 * @returns {string[]}
 */
export function parseCsvHeaders(csvText, papaParse = Papa.parse.bind(Papa)) {
  const parsed = papaParse(csvText, { header: true, skipEmptyLines: true, preview: 1 });
  return parsed.meta?.fields ?? [];
}

/**
 * Determines whether the user needs to pick substitute columns before this
 * CSV can be imported, based on which of the 4 canonical columns
 * (date/amount/description/category) are auto-detectable (case-insensitive
 * exact match) in `headers`.
 *
 * - "date" and "amount" are always required: if either is missing, the user
 *   must substitute another column for it (or cancel the import).
 * - "description" and "category" are each optional individually, but at
 *   least one of the two is needed to produce meaningful expense
 *   breakdowns — so a substitute is only required for them when *both* are
 *   missing.
 *
 * @param {string[]} headers
 * @returns {{
 *   needsMapping: boolean,
 *   missingRequired: string[],
 *   missingDescriptive: boolean,
 *   detected: Record<string, string|null>,
 * }}
 */
export function getColumnMappingNeeds(headers) {
  const detected = {};
  for (const field of CANONICAL_COLUMNS) {
    detected[field] = findHeader(headers, field);
  }

  const missingRequired = REQUIRED_CANONICAL_COLUMNS.filter((field) => !detected[field]);
  const missingDescriptive = !detected.description && !detected.category;

  return {
    needsMapping: missingRequired.length > 0 || missingDescriptive,
    missingRequired,
    missingDescriptive,
    detected,
  };
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
 * @param {(csv: string, options: object) => object} [papaParse] Defaults to
 *   PapaParse's `Papa.parse`. A parser can be injected here for unit testing.
 * @param {Record<string, string>} [columnMapping] Optional explicit mapping
 *   from canonical field name ("date"/"amount"/"description"/"category") to
 *   the actual CSV header to use for it, letting a caller substitute a
 *   differently-named column (e.g. a bank's "Transaction Date" column mapped
 *   to "date"). Takes precedence over auto-detection for any field it sets;
 *   see `getColumnMappingNeeds` for determining when this is needed.
 * @returns {{ transactions: Array<object>, warnings: string[], errors: string[] }}
 */
export function parseTransactionsCsv(csvText, papaParse = Papa.parse.bind(Papa), columnMapping = {}) {
  const parsed = papaParse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const errors = [];
  const warnings = [];

  const headers = parsed.meta?.fields ?? [];
  const resolveHeader = (field) => columnMapping[field] || findHeader(headers, field);
  const dateHeader = resolveHeader("date");
  const categoryHeader = resolveHeader("category");
  const amountHeader = resolveHeader("amount");
  // "description" is recognized case-insensitively (like the required columns
  // above) and normalized to a lowercase "description" key, so it works
  // regardless of how the source file capitalizes it (e.g. "Description").
  const descriptionHeader = resolveHeader("description");

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

    // Preserve any extra columns (e.g. a custom "memo" column) unchanged, but
    // normalize recognized ones (date/category/amount/description) to their
    // canonical lowercase keys regardless of the source column's casing. A
    // columnMapping can point a canonical field at a differently-named
    // header (e.g. "amount" -> "Debit Amount"), potentially leaving an
    // unrelated column literally named "amount"/"date"/etc. in `extra` — so
    // `extra` is spread first and the canonical fields are applied after it,
    // guaranteeing the canonical values always win over any same-named extra
    // column.
    const extra = { ...row };
    delete extra[dateHeader];
    if (categoryHeader) delete extra[categoryHeader];
    delete extra[amountHeader];

    let description;
    if (descriptionHeader) {
      description = (row[descriptionHeader] ?? "").toString().trim();
      delete extra[descriptionHeader];
    }

    transactions.push({ ...extra, date, category, amount, ...(description !== undefined && { description }) });
  });

  if (transactions.length === 0) {
    errors.push("No valid transaction rows were found in the uploaded CSV.");
  }

  return { transactions, warnings, errors };
}
