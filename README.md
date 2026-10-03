# Budget Dashboard

A simple, static budget dashboard built with plain HTML5, Tailwind CSS (precompiled to
a static stylesheet), and Chart.js. No backend, no framework — just static files that
read data from a local JSON file in the browser. Chart.js, PapaParse, and Tailwind CSS
are npm dependencies built into committed files (`dist/bundle.js` and
`css/tailwind.css`; see "Building the JS bundle" and "Building the CSS" below) rather
than loaded from a CDN or referenced directly in `index.html`. This means the site runs
fully offline (no network access needed to view it, including in sandboxed
environments) once `node_modules` is installed and the build has been run at least
once. Designed to be deployed on GitHub Pages.

## Features

- **Spending by Category** (`index.html`): a pie chart showing spending broken down by
  category, with a color-coded legend.
  - Filter the chart by date range using presets (This Month, Last Month, Last 3
    Months, All Time) or custom start/end date inputs.
  - Categories that individually make up less than 2% of the total for the selected
    range are grouped into a single "Other" slice, with a breakdown table below the
    chart showing what's included.
  - Click a pie slice or a category name in the legend (or in the "Other" breakdown
    list) to see that category's individual transactions in a table below the chart.
    Click the same slice/row again, or use the "× Clear selection" link, to close it.
    Changing the date range clears any active selection.
  - You can upload your own CSV of transactions to replace the chart's data for the
    current browser session (see "Uploading your own data" below).

## Tech stack

| Layer     | Choice                                              |
|-----------|------------------------------------------------------|
| Markup    | Plain HTML5, multi-page site (no framework)          |
| Styling   | [Tailwind CSS](https://tailwindcss.com), compiled ahead of time via the `tailwindcss` CLI into a static `css/tailwind.css` (see "Building the CSS" below), plus a small shared `css/styles.css` for the few rules Tailwind's utility classes don't cover |
| Charts    | [Chart.js](https://www.chartjs.org), installed as an npm dependency and imported as an ES module (`chart.js/auto`) |
| CSV parsing | [PapaParse](https://www.papaparse.com), installed as an npm dependency and imported as an ES module, for the "upload your own data" feature |
| Data      | Static JSON (`data/transactions.json`), fetched directly in the browser — no database or API |

## Project structure

```
.
├── index.html                          # Spending by Category page
├── css/
│   ├── styles.css                      # Shared stylesheet
│   ├── tailwind-input.css              # Tailwind entry point (@tailwind base/components/utilities)
│   └── tailwind.css                    # Generated: static Tailwind build output (loaded by index.html)
├── js/
│   ├── data.js                         # Data loading, date filtering, and category aggregation helpers (ES module)
│   ├── csv.js                          # CSV parsing/validation for the "upload your own data" feature (ES module)
│   ├── categorize.js                   # Auto-categorization suggestion logic for uploaded CSVs (ES module)
│   ├── category-rules.js               # Generated keyword rules derived from data/transactions.json
│   ├── merchant-keywords.js            # Hand-curated fallback list of well-known merchant/brand names
│   └── pages/
│       └── spending-by-category.js     # Page-specific logic: wires up filters, CSV upload, and renders the chart (ES module)
├── dist/
│   └── bundle.js                       # Generated: esbuild bundle of spending-by-category.js + chart.js + papaparse (loaded by index.html)
├── data/
│   └── transactions.json               # Transaction data: [{ date, category, amount }, ...]
├── test/
│   ├── data.test.js                    # Unit tests for js/data.js
│   ├── csv.test.js                     # Unit tests for js/csv.js
│   └── categorize.test.js              # Unit tests for js/categorize.js
└── e2e/
    ├── spending-by-category.spec.js    # Playwright browser tests for the page
    ├── csv-upload.spec.js              # Playwright tests for the CSV upload feature
    ├── a11y.spec.js                    # Automated accessibility audit (axe-core)
    └── fixtures/                       # Sample CSV files used by csv-upload.spec.js
```

Each additional dashboard page (e.g. trends over time, a transaction list) can be
added as its own `*.html` file alongside `index.html`, reusing `css/styles.css` and
`js/data.js`, with its own script in `js/pages/`. `js/data.js` and page scripts are
loaded as native ES modules (`<script type="module">`), so no bundler is needed —
this also lets `js/data.js`'s functions be imported directly in unit tests.

## Running locally

Because the pages load `data/transactions.json` via `fetch()`, opening `index.html`
directly from disk (`file://`) will fail due to browser CORS restrictions — a local
static file server is required. **Python is intentionally not used**; use any
Node-based static server instead, for example:

```bash
npx serve .
```

or

```bash
npx http-server .
```

Then open the printed local URL (e.g. `http://localhost:3000`) in your browser.

## Deploying to GitHub Pages

This is a fully static site with no build step, so deployment is just publishing the
repository contents:

1. Push this repository to GitHub.
2. In the repo settings, go to **Pages** and set the source to the branch/root folder
   containing these files (e.g. `main` / `/`).
3. GitHub Pages will serve `index.html` at the published URL automatically.

## Updating the data

Replace or edit `data/transactions.json` with your own transaction records. Each entry
should have the shape:

```json
{ "date": "YYYY-MM-DD", "category": "Category Name", "amount": 12.34 }
```

No other code changes are required — the dashboard reads categories and date ranges
dynamically from whatever is in the file.

## Uploading your own data

Instead of (or in addition to) editing `data/transactions.json`, you can upload a CSV
file directly in the browser using the "Upload your own data" control on the page.

- **Required columns** (matched case-insensitively, in any order): `date`, `amount`.
- **`category` is optional.** See "Automatic categorization" below for what happens
  when it's missing or blank.
- **`description` is recognized case-insensitively too** (e.g. `Description` or
  `DESCRIPTION` both work) and normalized to a `description` field, since it's
  used by the automatic categorization feature below.
- **Other extra columns** (e.g. a bank's own `Spending Category` or a custom `memo`
  column) are allowed and are kept on each parsed transaction under their original
  header name, even though the dashboard doesn't use them yet — they won't be
  discarded.
- **Date formats accepted**: ISO `YYYY-MM-DD`, or `MM/DD/YYYY` (and `M/D/YYYY`);
  other formats are rejected.
- **Amount format**: a plain number, optionally with a `$` prefix and/or comma
  thousands separators (e.g. `$1,234.56`).
- **Invalid rows are skipped, not the whole file**: rows with a missing/invalid date
  or amount are skipped and reported in a warning message alongside a count of how
  many rows loaded successfully. If the file is missing a required column entirely,
  the upload is rejected with an error and the chart keeps showing its previous data.
- **This is in-memory only**: uploaded data is not saved anywhere — it replaces the
  chart's data for the current page view only. Reloading the page reverts to
  `data/transactions.json`.

### Automatic categorization

If an uploaded CSV has no `category` column at all, or leaves it blank on some rows,
the dashboard tries to guess a category for those rows from their `description`
using two layers of built-in, fully offline keyword dictionaries — **no AI model or
external service is used**, so you can always see exactly why a suggestion was made:

1. **`js/category-rules.js`** — generated from the app's own transaction history
   (`data/transactions.json`; see "Regenerating the category keyword rules" below).
   Tried first, since it reflects how *this* data has actually been categorized.
2. **`js/merchant-keywords.js`** — a hand-curated fallback list of well-known
   national merchant/brand names (grocery chains, gas stations, airlines, hotels,
   restaurants, etc.), used only when the first layer finds no match. Edit this
   file directly to add more brands — unlike `category-rules.js`, it's not
   generated, so no script needs to be re-run.

Both layers are plain substring matches; the longest/most specific match wins
overall (across both layers), so a specific phrase like "royal farms" or "credit
card payment" is preferred over an incidental shorter/generic match like "farm" or
"card".

When any rows need a category, a **review table** appears below the upload control
before anything is applied to the chart:

- Each row shows the transaction's date, description, and amount, plus a dropdown
  pre-filled with the suggested category (or "Uncategorized" if no keyword matched).
- Adjust any dropdown as needed, then click **"Apply categories and load data"** to
  finalize the import — only then does it replace the chart's data.
- Click **"Cancel upload"** to discard the parsed file and keep the previously
  loaded data.

### Regenerating the category keyword rules

`js/category-rules.js` is a generated file — regenerate it if you change the
descriptions in `data/transactions.json` in a way that should affect matching:

```bash
npm run generate:category-rules
```

This re-derives keywords from every `description`/`category` pair in
`data/transactions.json` and overwrites `js/category-rules.js`.

## Quality checks (linting, accessibility, tests)

This project uses Node-based dev tooling (installed via `npm`) for linting and
testing. These tools run at development/CI time only — they don't add a build step
to the deployed static site.

Install dev dependencies once:

```bash
npm install
npx playwright install chromium   # downloads the browser used for e2e/a11y tests
```

Available scripts:

| Command             | What it does                                                        |
|----------------------|----------------------------------------------------------------------|
| `npm run build`      | Runs `build:js` and `build:css` (see below)                          |
| `npm run build:js`   | Bundles `js/pages/spending-by-category.js` plus `chart.js` and `papaparse` from `node_modules` into `dist/bundle.js` via esbuild |
| `npm run build:css`  | Compiles `css/tailwind-input.css` into the static `css/tailwind.css` via the Tailwind CLI |
| `npm run lint`       | Runs all linters: ESLint (JS), Stylelint (CSS), html-validate (HTML) |
| `npm run lint:js`    | ESLint on `js/`, `test/`, `e2e/`, `scripts/`                         |
| `npm run lint:css`   | Stylelint on `css/**/*.css`                                          |
| `npm run lint:html`  | html-validate on `index.html`                                       |
| `npm run test:unit`  | Runs unit tests (`test/`) with Node's built-in `node:test` runner    |
| `npm run test:e2e`   | Runs Playwright browser tests (`e2e/`), including the accessibility audit |
| `npm test`           | Runs lint + unit tests + e2e/a11y tests, in that order                |
| `npm run generate:category-rules` | Regenerates `js/category-rules.js` from `data/transactions.json` |

**Linting**: ESLint catches JS bugs, Stylelint checks the shared stylesheet, and
html-validate checks HTML structure/semantics.

**Accessibility**: `e2e/a11y.spec.js` uses [axe-core](https://github.com/dequelabs/axe-core)
(via Playwright) to automatically scan the rendered page for WCAG2 A/AA violations
(e.g. color contrast, missing labels, ARIA misuse). The pie chart `<canvas>` also has
an `aria-label` since Chart.js canvases have no built-in text alternative — the
legend list below the chart serves as the accessible, screen-reader-friendly detail
view. The legend, "Other" breakdown, and clear-selection controls are real `<button>`
elements with `aria-pressed` state so the category drill-down feature is keyboard-
and screen-reader-accessible too. Automated checks don't catch everything, so it's
still worth manually verifying keyboard navigation (tab through preset buttons and
date inputs) and focus visibility when adding new UI.

**Tests**: `test/data.test.js` unit-tests the pure data functions in `js/data.js`
(date filtering, category aggregation, "Other" grouping, preset date ranges, and
per-category transaction lookup/sorting), `test/csv.test.js` unit-tests the CSV
parsing/validation logic in `js/csv.js` (date/amount normalization, missing-column
detection, invalid-row skipping, optional category handling), and
`test/categorize.test.js` unit-tests the keyword-matching logic in `js/categorize.js`
— all three use Node's built-in test runner.
`e2e/spending-by-category.spec.js`, `e2e/category-drilldown.spec.js`, and
`e2e/csv-upload.spec.js` use Playwright to drive a real browser against the page
(served locally via `http-server`, started automatically by the Playwright config)
and verify the chart, presets, custom date filtering, "Other" breakdown, clicking a
slice/legend row/"Other" row to view and clear a category's transaction detail, and
CSV upload (valid files, partially-invalid files, files missing required columns,
and the auto-categorization review/apply/cancel flow) all work end-to-end.

**CI**: `.github/workflows/ci.yml` runs `npm run lint`, `npm run test:unit`, and
`npm run test:e2e` on every push and pull request.

**Building the JS bundle**: `index.html` loads a single `<script src="dist/bundle.js">`
instead of referencing Chart.js/PapaParse CDN URLs or `js/pages/spending-by-category.js`
directly, so the browser never needs a `<script type="module">`/import-map setup for
third-party packages. `dist/bundle.js` is a generated file (like `js/category-rules.js`)
that's committed to the repo so GitHub Pages can serve it without a deploy-time build
step. Run `npm run build` after changing any file under `js/` or upgrading `chart.js`/
`papaparse`, and commit the regenerated `dist/bundle.js` along with your change. `npm
test` and `npm run test:e2e` also rebuild it automatically before running (see the
`pretest`/`pretest:e2e` scripts), so the e2e suite always exercises the latest code.

**Building the CSS**: `index.html` loads a static `<link rel="stylesheet"
href="css/tailwind.css">` instead of the Tailwind Play CDN `<script>`, so the page
renders correctly with no internet access (including in offline/sandboxed
environments) — no runtime JIT compilation or external request is involved.
`css/tailwind.css` is a generated file (like `dist/bundle.js`) that's committed to the
repo. `tailwind.config.js` scans `./*.html` and `./js/**/*.js` (including classes
built dynamically in `js/pages/spending-by-category.js`, e.g. via `classList.add`) to
determine which utility classes to include. Run `npm run build:css` (or `npm run
build`) after adding/removing any Tailwind utility class in the markup or JS, and
commit the regenerated `css/tailwind.css` along with your change. `npm test` and `npm
run test:e2e` also rebuild it automatically before running (see the
`pretest`/`pretest:e2e` scripts).
