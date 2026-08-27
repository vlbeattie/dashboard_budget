// Page logic for the "Spending by Category" pie chart page.
import {
  loadTransactions,
  filterByDateRange,
  getDataDateBounds,
  getPresetRange,
  aggregateByCategory,
  groupSmallCategories,
  getTransactionsForCategory,
} from "../data.js";
import { parseTransactionsCsv } from "../csv.js";
import { suggestCategoriesForReview, UNCATEGORIZED } from "../categorize.js";
import { CATEGORY_RULES } from "../category-rules.js";

const PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
  "#0d9488", "#c026d3",
];
const OTHER_COLOR = "#94a3b8";
const DIMMED_COLOR = "#e2e8f0";
const SELECTED_OFFSET = 18;

let allTransactions = [];
let chart = null;

// State for the currently filtered/aggregated view, kept so click handlers
// (fired later, asynchronously) can access it without recomputing.
let currentFiltered = [];
let currentSlices = [];
let currentOtherBreakdown = [];
let currentGrandTotal = 0;

// Category currently emphasized on the pie chart (a main category or "Other").
let selectedSliceCategory = null;
// Category whose transactions are shown in the detail table below (null when
// "Other" itself is selected, since it isn't a real category).
let selectedDetailCategory = null;

// Parsed transactions awaiting category review after a CSV upload (rows with
// blank categories still need a user-confirmed value before being applied).
let pendingReviewTransactions = null;
let pendingReviewFileName = "";
let pendingReviewWarnings = [];

function formatCurrency(value) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function colorForIndex(category, index) {
  return category === "Other" ? OTHER_COLOR : PALETTE[index % PALETTE.length];
}

/** Color used for a pie slice: the real category color, dimmed to gray if
 * another category is currently selected. */
function sliceColor(category, index) {
  if (selectedSliceCategory && category !== selectedSliceCategory) {
    return DIMMED_COLOR;
  }
  return colorForIndex(category, index);
}

function renderChart(slices) {
  const ctx = document.getElementById("category-pie-chart").getContext("2d");
  const labels = slices.map((s) => s.category);
  const data = slices.map((s) => s.total);
  const colors = slices.map((s, i) => sliceColor(s.category, i));
  const offsets = slices.map((s) => (s.category === selectedSliceCategory ? SELECTED_OFFSET : 0));

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        { data, backgroundColor: colors, offset: offsets, borderWidth: 1, borderColor: "#ffffff" },
      ],
    },
    options: {
      responsive: true,
      onClick: (_evt, elements) => {
        if (elements.length === 0) return;
        const clicked = currentSlices[elements[0].index];
        if (clicked) selectCategory(clicked.category);
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length > 0 ? "pointer" : "default";
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}`,
          },
        },
      },
    },
  });
}

function renderLegend(slices, grandTotal) {
  const legendEl = document.getElementById("category-legend");
  legendEl.innerHTML = "";

  slices.forEach((slice, i) => {
    const pct = grandTotal > 0 ? ((slice.total / grandTotal) * 100).toFixed(1) : "0.0";
    const isSelected = slice.category === selectedSliceCategory;
    const row = document.createElement("li");
    row.className = "py-0.5";
    row.innerHTML = `
      <button
        type="button"
        class="w-full flex items-center justify-between gap-3 py-1 px-1 -mx-1 rounded text-sm text-left hover:bg-slate-50 transition-colors ${isSelected ? "font-semibold bg-slate-50" : ""}"
        aria-pressed="${isSelected}"
      >
        <span class="flex items-center gap-2 min-w-0">
          <span class="legend-swatch" style="background-color: ${colorForIndex(slice.category, i)}"></span>
          <span class="truncate">${slice.category}</span>
        </span>
        <span class="text-slate-600 whitespace-nowrap">${formatCurrency(slice.total)} <span class="text-slate-500">(${pct}%)</span></span>
      </button>
    `;
    row.querySelector("button").addEventListener("click", () => selectCategory(slice.category));
    legendEl.appendChild(row);
  });
}

function renderOtherBreakdown(otherBreakdown, grandTotal) {
  const section = document.getElementById("other-breakdown-section");
  const list = document.getElementById("other-breakdown-list");

  if (otherBreakdown.length === 0) {
    section.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  section.classList.remove("hidden");
  list.innerHTML = "";
  otherBreakdown
    .slice()
    .sort((a, b) => b.total - a.total)
    .forEach((entry) => {
      const pct = grandTotal > 0 ? ((entry.total / grandTotal) * 100).toFixed(1) : "0.0";
      const isSelected = entry.category === selectedDetailCategory;
      const row = document.createElement("li");
      row.className = "py-0.5";
      row.innerHTML = `
        <button
          type="button"
          class="w-full flex items-center justify-between gap-3 py-1 px-1 -mx-1 rounded text-sm text-left text-slate-600 hover:bg-slate-50 transition-colors ${isSelected ? "font-semibold bg-slate-50 text-slate-900" : ""}"
          aria-pressed="${isSelected}"
        >
          <span class="truncate">${entry.category}</span>
          <span class="whitespace-nowrap">${formatCurrency(entry.total)} (${pct}%)</span>
        </button>
      `;
      row.querySelector("button").addEventListener("click", () => selectOtherChild(entry.category));
      list.appendChild(row);
    });
}

function renderTotal(grandTotal, count) {
  document.getElementById("total-spend").textContent = formatCurrency(grandTotal);
  document.getElementById("total-count").textContent =
    `${count} transaction${count === 1 ? "" : "s"}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function renderCategoryDetail() {
  const section = document.getElementById("category-detail-section");

  if (!selectedDetailCategory) {
    section.classList.add("hidden");
    document.getElementById("category-detail-rows").innerHTML = "";
    return;
  }

  const transactions = getTransactionsForCategory(currentFiltered, selectedDetailCategory);
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  document.getElementById("category-detail-title").textContent =
    `${selectedDetailCategory} — ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}, ${formatCurrency(total)} total`;

  const rowsEl = document.getElementById("category-detail-rows");
  rowsEl.innerHTML = transactions
    .map(
      (t) => `
        <tr>
          <td class="py-1.5 pr-4 whitespace-nowrap">${t.date}</td>
          <td class="py-1.5 pr-4">${t.description ? escapeHtml(t.description) : "—"}</td>
          <td class="py-1.5 text-right whitespace-nowrap">${formatCurrency(t.amount)}</td>
        </tr>
      `
    )
    .join("");

  section.classList.remove("hidden");
}

/** Selects (or, if already selected, deselects) a top-level pie slice's category. */
function selectCategory(category) {
  const alreadySelected = selectedSliceCategory === category && selectedDetailCategory === category;
  if (alreadySelected) {
    clearSelection();
    return;
  }

  selectedSliceCategory = category;
  selectedDetailCategory = category === "Other" ? null : category;
  rerenderSelectionDependentUI();
}

/** Selects (or deselects) a category grouped inside the "Other" slice. */
function selectOtherChild(category) {
  const alreadySelected = selectedDetailCategory === category;
  if (alreadySelected) {
    clearSelection();
    return;
  }

  selectedSliceCategory = "Other";
  selectedDetailCategory = category;
  rerenderSelectionDependentUI();
}

function clearSelection() {
  selectedSliceCategory = null;
  selectedDetailCategory = null;
  rerenderSelectionDependentUI();
}

/** Re-renders everything whose appearance depends on the current selection. */
function rerenderSelectionDependentUI() {
  renderChart(currentSlices);
  renderLegend(currentSlices, currentGrandTotal);
  renderOtherBreakdown(currentOtherBreakdown, currentGrandTotal);
  renderCategoryDetail();
}

function renderForRange(start, end) {
  currentFiltered = filterByDateRange(allTransactions, start, end);
  const aggregated = aggregateByCategory(currentFiltered);
  const grouped = groupSmallCategories(aggregated);
  currentSlices = grouped.slices;
  currentOtherBreakdown = grouped.otherBreakdown;
  currentGrandTotal = grouped.grandTotal;

  selectedSliceCategory = null;
  selectedDetailCategory = null;

  renderChart(currentSlices);
  renderLegend(currentSlices, currentGrandTotal);
  renderOtherBreakdown(currentOtherBreakdown, currentGrandTotal);
  renderCategoryDetail();
  renderTotal(currentGrandTotal, currentFiltered.length);
}

function setActivePreset(activeBtn) {
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    const isActive = btn === activeBtn;
    btn.classList.toggle("bg-slate-900", isActive);
    btn.classList.toggle("text-white", isActive);
    btn.classList.toggle("border-slate-900", isActive);
    btn.classList.toggle("bg-white", !isActive);
    btn.classList.toggle("text-slate-700", !isActive);
    // The active button keeps a dark hover state so its white text stays
    // readable; inactive buttons use the light hover state.
    btn.classList.toggle("hover:bg-slate-900", isActive);
    btn.classList.toggle("hover:bg-slate-100", !isActive);
  });
}

function applyPreset(preset, btn) {
  const { start, end } = getPresetRange(preset, allTransactions);
  document.getElementById("start-date").value = start;
  document.getElementById("end-date").value = end;
  setActivePreset(btn);
  renderForRange(start, end);
}

function clearActivePreset() {
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.remove("bg-slate-900", "text-white", "border-slate-900", "hover:bg-slate-900");
    btn.classList.add("bg-white", "text-slate-700", "hover:bg-slate-100");
  });
}

async function init() {
  allTransactions = await loadTransactions();
  attachEventListeners();
  resetDateControlsAndDefaultView();
}

/** Wires up all one-time event listeners (presets, date inputs, CSV upload). */
function attachEventListeners() {
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyPreset(btn.dataset.preset, btn));
  });

  const startInput = document.getElementById("start-date");
  const endInput = document.getElementById("end-date");
  const onCustomDateChange = () => {
    const { min, max } = getDataDateBounds(allTransactions);
    clearActivePreset();
    const start = startInput.value || min;
    const end = endInput.value || max;
    renderForRange(start, end);
  };
  startInput.addEventListener("change", onCustomDateChange);
  endInput.addEventListener("change", onCustomDateChange);

  document.getElementById("csv-upload").addEventListener("change", handleCsvUpload);
  document.getElementById("clear-category-selection").addEventListener("click", clearSelection);
  document.getElementById("apply-category-review").addEventListener("click", applyCategoryReview);
  document.getElementById("cancel-category-review").addEventListener("click", cancelCategoryReview);
}

/** (Re-)applies the current dataset's date bounds and shows the "All Time" view. */
function resetDateControlsAndDefaultView() {
  const { min, max } = getDataDateBounds(allTransactions);

  const startInput = document.getElementById("start-date");
  const endInput = document.getElementById("end-date");
  startInput.min = min;
  startInput.max = max;
  startInput.value = "";
  endInput.min = min;
  endInput.max = max;
  endInput.value = "";

  const defaultBtn = document.querySelector('.preset-btn[data-preset="all"]');
  applyPreset("all", defaultBtn);
}

function showCsvStatus(message, variant) {
  const el = document.getElementById("csv-upload-status");
  const variantClasses = {
    success: ["bg-green-50", "text-green-800", "border", "border-green-200"],
    warning: ["bg-amber-50", "text-amber-800", "border", "border-amber-200"],
    error: ["bg-red-50", "text-red-700", "border", "border-red-200"],
  };
  el.className = "text-sm rounded-md px-3 py-2";
  el.classList.add(...variantClasses[variant]);
  el.textContent = message;
  el.classList.remove("hidden");
}

function getKnownCategories(transactions) {
  const known = new Set(CATEGORY_RULES.map((rule) => rule.category));
  for (const t of transactions) {
    if (t.category) known.add(t.category);
  }
  known.delete(UNCATEGORIZED);
  return [...known].sort((a, b) => a.localeCompare(b)).concat(UNCATEGORIZED);
}

function renderCategoryReview(transactions, reviewRows) {
  const section = document.getElementById("category-review-section");
  const rowsEl = document.getElementById("category-review-rows");
  const summaryEl = document.getElementById("category-review-summary");

  const categories = getKnownCategories(transactions);
  const matchedCount = reviewRows.filter((r) => r.suggestion).length;

  summaryEl.textContent =
    `${reviewRows.length} row${reviewRows.length === 1 ? "" : "s"} have no category. ` +
    `${matchedCount} got an automatic suggestion based on the description — review and adjust as ` +
    `needed, then apply.`;

  rowsEl.innerHTML = reviewRows
    .map(({ index, transaction, suggestion }) => {
      const selected = suggestion ? suggestion.category : UNCATEGORIZED;
      const description = transaction.description ? escapeHtml(transaction.description) : "—";
      const options = categories
        .map(
          (cat) =>
            `<option value="${escapeHtml(cat)}" ${cat === selected ? "selected" : ""}>${escapeHtml(cat)}</option>`
        )
        .join("");

      return `
        <tr>
          <td class="py-1.5 pr-4 pl-3 whitespace-nowrap">${transaction.date}</td>
          <td class="py-1.5 pr-4">${description}</td>
          <td class="py-1.5 pr-4 text-right whitespace-nowrap">${formatCurrency(transaction.amount)}</td>
          <td class="py-1.5 pr-3">
            <select
              data-transaction-index="${index}"
              aria-label="Category for ${description} on ${transaction.date}"
              class="border border-slate-300 rounded-md px-2 py-1 text-sm"
            >
              ${options}
            </select>
          </td>
        </tr>
      `;
    })
    .join("");

  section.classList.remove("hidden");
}

function hideCategoryReview() {
  document.getElementById("category-review-section").classList.add("hidden");
  document.getElementById("category-review-rows").innerHTML = "";
  pendingReviewTransactions = null;
  pendingReviewFileName = "";
  pendingReviewWarnings = [];
}

function applyCategoryReview() {
  if (!pendingReviewTransactions) return;

  document.querySelectorAll("#category-review-rows select[data-transaction-index]").forEach((select) => {
    const index = Number(select.dataset.transactionIndex);
    pendingReviewTransactions[index].category = select.value;
  });

  finalizeCsvImport(pendingReviewTransactions, pendingReviewFileName, pendingReviewWarnings);
  hideCategoryReview();
}

function cancelCategoryReview() {
  hideCategoryReview();
  showCsvStatus("Upload cancelled — the previous data is unchanged.", "warning");
}

function finalizeCsvImport(transactions, fileName, warnings) {
  allTransactions = transactions;
  resetDateControlsAndDefaultView();

  if (warnings.length > 0) {
    showCsvStatus(
      `Loaded ${transactions.length} transaction(s) from "${fileName}", but skipped ${warnings.length} row(s): ${warnings.join(" ")}`,
      "warning"
    );
  } else {
    showCsvStatus(
      `Loaded ${transactions.length} transaction(s) from "${fileName}". This replaces the sample data until you reload the page.`,
      "success"
    );
  }
}

async function handleCsvUpload(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const { transactions, warnings, errors } = parseTransactionsCsv(text);

    if (errors.length > 0) {
      showCsvStatus(errors.join(" "), "error");
      return;
    }

    const reviewRows = suggestCategoriesForReview(transactions);
    if (reviewRows.length > 0) {
      pendingReviewTransactions = transactions;
      pendingReviewFileName = file.name;
      pendingReviewWarnings = warnings;
      renderCategoryReview(transactions, reviewRows);
      showCsvStatus(
        `Parsed "${file.name}" — ${reviewRows.length} row(s) need a category. Review the suggestions ` +
          `below, then click "Apply categories and load data".`,
        "warning"
      );
      return;
    }

    finalizeCsvImport(transactions, file.name, warnings);
  } catch (err) {
    console.error(err);
    showCsvStatus(`Could not read "${file.name}" as a CSV file. See console for details.`, "error");
  } finally {
    // Allow re-uploading the same file name again later.
    input.value = "";
  }
}

init().catch((err) => {
  console.error(err);
  document.getElementById("chart-error").textContent =
    "Could not load transaction data. See console for details.";
  document.getElementById("chart-error").classList.remove("hidden");
});
