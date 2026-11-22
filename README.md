# NCD Election Hub

Independent voter information for the five National Capital District seats in
Papua New Guinea's 2027 general election.

The published site is plain static HTML with no runtime dependencies. A small
build (Node 22 built-ins only) fills the pages from sourced data files, so a
fact such as a polling date is written once and used everywhere.

| Path | Holds |
|---|---|
| `src/home.html` | Hub home: seats, key dates, tools → `/` |
| `src/count-lab/index.html` | Moresby Count Lab, the LPV count simulator → `/count-lab/` |
| `src/about.mjs` | The trust pages: charter, funding ledger, corrections, methodology, privacy → `/about/…` |
| `src/layout.mjs` | Shared page wrapper, footer (independence statement, trust links, theme switch) |
| `src/assets/site.css` | Shared stylesheet for content pages |
| `data/sources.json` | Every source: publisher, URL, archive copy, retrieval date, licence, official or not |
| `data/dates.json` | Election dates, each with a status (`unconfirmed`, `announced`, `gazetted`, `changed`) and a source |
| `data/seats.json` | The five seats, boundary status and sources |
| `data/funding.json` | The public funding ledger: date, payer, kind, amount in kina, purpose |
| `data/corrections.json` | The corrections log: date, page, what was wrong, what it says now |
| `data/config.json` | Site settings. `contact_email` (null for now) adds an email route for error reports once set |
| `build.mjs` | Builds `_site/` from `src/` and `data/` |
| `scripts/validate-data.mjs` | Checks the data: shapes, that every source id resolves, and that only officially sourced dates leave `unconfirmed` |
| `scripts/check-site.mjs` | Checks the built pages: `lang`, title, description, one `h1`, independence footer, internal links, no third-party resources, gzip budgets |
| `scripts/check-browser.mjs` | Loads each page in Chromium at 360 px, with and without JavaScript, and runs axe-core |
| `tests/` | `node:test` suites, including the Count Lab engine golden baseline |
| `tests/jobs.json` | The audience jobs from the plan. `live` jobs must have a page carrying `data-job="<id>"` within two links of home |

Pages use `{{@token}}` placeholders that the build fills from `data/`, for
example `{{@dates}}`, `{{@seats}}`, `{{@date:nominations.end}}` and
`{{@footer}}`. An unknown token fails the build.

## Working on it

```bash
npm run check          # validate data, run tests, build _site/, check pages (under a second)
npm run check:browser  # needs `npm ci` and a Playwright Chromium
python3 -m http.server -d _site 8765   # preview at http://localhost:8765/
```

To record a payment or a correction, add an entry to `data/funding.json` or
`data/corrections.json`; the ledger and log pages are rebuilt from them.

To change a date, edit `data/dates.json` and rebuild. A date can only move off
`unconfirmed` if its source is marked `"official": true`.

The Count Lab engine (`<script id="engine">`) is pinned by a golden test.
Any change to its simulated output fails `npm run check`.

## Deploying

`.github/workflows/pages.yml` runs both checks on every push and pull request.
On `main`, once they pass, it builds `_site/` and publishes it to GitHub Pages.
