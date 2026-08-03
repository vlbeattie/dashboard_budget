// Page logic for the "Spending by Category" pie chart page.
import {
  loadTransactions,
  filterByDateRange,
  getDataDateBounds,
  getPresetRange,
  aggregateByCategory,
  groupSmallCategories,
} from "../data.js";

const PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
  "#0d9488", "#c026d3",
];
const OTHER_COLOR = "#94a3b8";

let allTransactions = [];
let chart = null;

function formatCurrency(value) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function colorForIndex(category, index) {
  return category === "Other" ? OTHER_COLOR : PALETTE[index % PALETTE.length];
}

function renderChart(slices) {
  const ctx = document.getElementById("category-pie-chart").getContext("2d");
  const labels = slices.map((s) => s.category);
  const data = slices.map((s) => s.total);
  const colors = slices.map((s, i) => colorForIndex(s.category, i));

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 1, borderColor: "#ffffff" }],
    },
    options: {
      responsive: true,
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
    const row = document.createElement("li");
    row.className = "flex items-center justify-between gap-3 py-1.5 text-sm";
    row.innerHTML = `
      <span class="flex items-center gap-2 min-w-0">
        <span class="legend-swatch" style="background-color: ${colorForIndex(slice.category, i)}"></span>
        <span class="truncate">${slice.category}</span>
      </span>
      <span class="text-slate-600 whitespace-nowrap">${formatCurrency(slice.total)} <span class="text-slate-500">(${pct}%)</span></span>
    `;
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
      const row = document.createElement("li");
      row.className = "flex items-center justify-between gap-3 py-1 text-sm text-slate-600";
      row.innerHTML = `<span class="truncate">${entry.category}</span><span class="whitespace-nowrap">${formatCurrency(entry.total)} (${pct}%)</span>`;
      list.appendChild(row);
    });
}

function renderTotal(grandTotal, count) {
  document.getElementById("total-spend").textContent = formatCurrency(grandTotal);
  document.getElementById("total-count").textContent =
    `${count} transaction${count === 1 ? "" : "s"}`;
}

function renderForRange(start, end) {
  const filtered = filterByDateRange(allTransactions, start, end);
  const aggregated = aggregateByCategory(filtered);
  const { slices, otherBreakdown, grandTotal } = groupSmallCategories(aggregated);

  renderChart(slices);
  renderLegend(slices, grandTotal);
  renderOtherBreakdown(otherBreakdown, grandTotal);
  renderTotal(grandTotal, filtered.length);
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
  const { min, max } = getDataDateBounds(allTransactions);

  const startInput = document.getElementById("start-date");
  const endInput = document.getElementById("end-date");
  startInput.min = min;
  startInput.max = max;
  endInput.min = min;
  endInput.max = max;

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyPreset(btn.dataset.preset, btn));
  });

  const onCustomDateChange = () => {
    clearActivePreset();
    const start = startInput.value || min;
    const end = endInput.value || max;
    renderForRange(start, end);
  };
  startInput.addEventListener("change", onCustomDateChange);
  endInput.addEventListener("change", onCustomDateChange);

  // Default view: All Time.
  const defaultBtn = document.querySelector('.preset-btn[data-preset="all"]');
  applyPreset("all", defaultBtn);
}

init().catch((err) => {
  console.error(err);
  document.getElementById("chart-error").textContent =
    "Could not load transaction data. See console for details.";
  document.getElementById("chart-error").classList.remove("hidden");
});
