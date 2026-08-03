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
│   ├── data.js                         # Data loading, date filtering, and category aggregation helpers
│   └── pages/
│       └── spending-by-category.js     # Page-specific logic: wires up filters and renders the chart
└── data/
    └── transactions.json               # Transaction data: [{ date, category, amount }, ...]
```

Each additional dashboard page (e.g. trends over time, a transaction list) can be
added as its own `*.html` file alongside `index.html`, reusing `css/styles.css` and
`js/data.js`, with its own script in `js/pages/`.

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
