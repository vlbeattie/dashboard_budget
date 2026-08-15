import { test, describe } from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { parseTransactionsCsv, normalizeDate, normalizeAmount, findHeader } from "../js/csv.js";

describe("findHeader", () => {
  test("matches case-insensitively and trims whitespace", () => {
    assert.equal(findHeader([" Date ", "Category", "Amount"], "date"), " Date ");
    assert.equal(findHeader(["CATEGORY"], "category"), "CATEGORY");
  });

  test("returns null when not found", () => {
    assert.equal(findHeader(["foo", "bar"], "date"), null);
  });
});

describe("normalizeDate", () => {
  test("accepts ISO YYYY-MM-DD", () => {
    assert.equal(normalizeDate("2026-04-25"), "2026-04-25");
  });

  test("accepts MM/DD/YYYY and converts to ISO", () => {
    assert.equal(normalizeDate("4/25/2026"), "2026-04-25");
    assert.equal(normalizeDate("04/25/2026"), "2026-04-25");
    assert.equal(normalizeDate("12/1/2026"), "2026-12-01");
  });

  test("rejects invalid calendar dates", () => {
    assert.equal(normalizeDate("2026-02-30"), null);
    assert.equal(normalizeDate("13/01/2026"), null);
    assert.equal(normalizeDate("02/30/2026"), null);
  });

  test("rejects unparseable strings", () => {
    assert.equal(normalizeDate("not a date"), null);
    assert.equal(normalizeDate(""), null);
    assert.equal(normalizeDate(undefined), null);
  });
});

describe("normalizeAmount", () => {
  test("parses plain numeric strings", () => {
    assert.equal(normalizeAmount("42.61"), 42.61);
  });

  test("strips currency symbols and thousands separators", () => {
    assert.equal(normalizeAmount("$1,234.56"), 1234.56);
    assert.equal(normalizeAmount("1,234"), 1234);
  });

  test("accepts numbers directly", () => {
    assert.equal(normalizeAmount(42.5), 42.5);
  });

  test("rejects non-numeric or empty values", () => {
    assert.equal(normalizeAmount("abc"), null);
    assert.equal(normalizeAmount(""), null);
    assert.equal(normalizeAmount(undefined), null);
    assert.equal(normalizeAmount(NaN), null);
  });
});

describe("parseTransactionsCsv", () => {
  test("parses valid rows and preserves extra columns", () => {
    const csv = [
      "date,category,amount,description",
      "2026-01-01,Groceries,42.50,Trader Joes",
      "01/15/2026,Rent,1500,Feb rent",
    ].join("\n");

    const { transactions, warnings, errors } = parseTransactionsCsv(csv, Papa.parse);

    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    assert.equal(transactions.length, 2);
    assert.deepEqual(transactions[0], {
      date: "2026-01-01",
      category: "Groceries",
      amount: 42.5,
      description: "Trader Joes",
    });
    assert.deepEqual(transactions[1], {
      date: "2026-01-15",
      category: "Rent",
      amount: 1500,
      description: "Feb rent",
    });
  });

  test("matches required columns case-insensitively regardless of order", () => {
    const csv = ["Category,Amount,Date", "Groceries,10,2026-01-01"].join("\n");
    const { transactions, errors } = parseTransactionsCsv(csv, Papa.parse);
    assert.deepEqual(errors, []);
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].date, "2026-01-01");
  });

  test("errors when a required column is missing", () => {
    const csv = ["category,amount", "Groceries,10"].join("\n");
    const { transactions, errors } = parseTransactionsCsv(csv, Papa.parse);
    assert.equal(transactions.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /missing required column/i);
    assert.match(errors[0], /date/);
  });

  test("skips rows with an invalid date and warns, keeping valid rows", () => {
    const csv = [
      "date,category,amount",
      "2026-01-01,Groceries,10",
      "not-a-date,Rent,1500",
      "2026-01-03,Health,20",
    ].join("\n");

    const { transactions, warnings, errors } = parseTransactionsCsv(csv, Papa.parse);

    assert.deepEqual(errors, []);
    assert.equal(transactions.length, 2);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Row 3/);
    assert.match(warnings[0], /invalid or missing date/);
  });

  test("skips rows with an invalid amount and warns, keeping valid rows", () => {
    const csv = [
      "date,category,amount",
      "2026-01-01,Groceries,not-a-number",
      "2026-01-02,Rent,1500",
    ].join("\n");

    const { transactions, warnings } = parseTransactionsCsv(csv, Papa.parse);

    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].category, "Rent");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Row 2/);
    assert.match(warnings[0], /invalid or missing amount/);
  });

  test("skips rows with a missing category", () => {
    const csv = ["date,category,amount", "2026-01-01,,10"].join("\n");
    const { transactions, warnings } = parseTransactionsCsv(csv, Papa.parse);
    assert.equal(transactions.length, 0);
    assert.match(warnings[0], /missing category/);
  });

  test("reports an error when no valid rows remain", () => {
    const csv = ["date,category,amount", "not-a-date,Rent,not-a-number"].join("\n");
    const { transactions, errors } = parseTransactionsCsv(csv, Papa.parse);
    assert.equal(transactions.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /no valid transaction rows/i);
  });
});
