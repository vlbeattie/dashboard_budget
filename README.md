# Budget Dashboard

A simple, static budget dashboard built with plain HTML5, Tailwind CSS (via CDN), and
Chart.js. No backend, no build step, no framework — just static files that read data
from a local JSON file in the browser. Designed to be deployed on GitHub Pages.

## Features

- **Spending by Category** (`index.html`): a pie chart showing spending broken down by
  category, with a color-coded legend.
  - Filter the chart by date range using presets (This Month, Last Month, Last 3
    Months, All Time) or custom start/end date inputs.
  - Categories that individually make up less than 2% of the total for the selected
    range are grouped into a single "Other" slice, with a breakdown table below the
    chart showing what's included.

## Tech stack

| Layer     | Choice                                              |
|-----------|------------------------------------------------------|
| Markup    | Plain HTML5, multi-page site (no framework)          |
| Styling   | [Tailwind CSS](https://tailwindcss.com) via CDN script, plus a small shared `css/styles.css` for the few rules Tailwind's utility classes don't cover |
| Charts    | [Chart.js](https://www.chartjs.org) via CDN          |
| Data      | Static JSON (`data/transactions.json`), fetched directly in the browser — no database or API |

## Project structure

```
.
├── index.html                          # Spending by Category page
├── css/
│   └── styles.css                      # Shared stylesheet
├── js/
│   ├── data.js                         # Data loading, date filtering, and category aggregation helpers (ES module)
│   └── pages/
│       └── spending-by-category.js     # Page-specific logic: wires up filters and renders the chart (ES module)
├── data/
│   └── transactions.json               # Transaction data: [{ date, category, amount }, ...]
├── test/
│   └── data.test.js                    # Unit tests for js/data.js
└── e2e/
    ├── spending-by-category.spec.js    # Playwright browser tests for the page
    └── a11y.spec.js                    # Automated accessibility audit (axe-core)
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
| `npm run lint`       | Runs all linters: ESLint (JS), Stylelint (CSS), html-validate (HTML) |
| `npm run lint:js`    | ESLint on `js/`, `test/`, `e2e/`                                     |
| `npm run lint:css`   | Stylelint on `css/**/*.css`                                          |
| `npm run lint:html`  | html-validate on `index.html`                                       |
| `npm run test:unit`  | Runs unit tests (`test/`) with Node's built-in `node:test` runner    |
| `npm run test:e2e`   | Runs Playwright browser tests (`e2e/`), including the accessibility audit |
| `npm test`           | Runs lint + unit tests + e2e/a11y tests, in that order                |

**Linting**: ESLint catches JS bugs, Stylelint checks the shared stylesheet, and
html-validate checks HTML structure/semantics.

**Accessibility**: `e2e/a11y.spec.js` uses [axe-core](https://github.com/dequelabs/axe-core)
(via Playwright) to automatically scan the rendered page for WCAG2 A/AA violations
(e.g. color contrast, missing labels, ARIA misuse). The pie chart `<canvas>` also has
an `aria-label` since Chart.js canvases have no built-in text alternative — the
legend list below the chart serves as the accessible, screen-reader-friendly detail
view. Automated checks don't catch everything, so it's still worth manually verifying
keyboard navigation (tab through preset buttons and date inputs) and focus visibility
when adding new UI.

**Tests**: `test/data.test.js` unit-tests the pure data functions in `js/data.js`
(date filtering, category aggregation, "Other" grouping, preset date ranges) using
Node's built-in test runner — no extra dependency required. `e2e/spending-by-category.spec.js`
uses Playwright to drive a real browser against the page (served locally via
`http-server`, started automatically by the Playwright config) and verifies the
chart, presets, custom date filtering, and "Other" breakdown all work end-to-end.

**CI**: `.github/workflows/ci.yml` runs `npm run lint`, `npm run test:unit`, and
`npm run test:e2e` on every push and pull request.
