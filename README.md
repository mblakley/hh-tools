# Hilton Heat Tools — RDYSL Callup Checker

A static site plus Vercel serverless functions that tracks RDYSL (Rochester District
Youth Soccer League) player callup compliance. Deployed at https://hhtools.vercel.app
via the GitHub integration: every push to `master` auto-deploys the Vercel project
`hh_tools`.

## Architecture

- **`public/`** — static frontend. `index.html` + `js/app.js` is the callup dashboard;
  `rdysl-callup-checker.html` is the standalone checker page. Both sit behind a cookie
  login gate (`middleware.js` + `api/auth.js`, redirects to `login.html`).
- **`api/`** — CommonJS serverless functions:
  | Endpoint | Purpose |
  |---|---|
  | `GET/POST /api/callups` | Scrape RDYSL game-fines data (POST or `?forceRefresh=true` bypasses the cache) |
  | `GET /api/health` | Liveness check |
  | `POST /api/auth` | Login gate |
  | `GET /api/debug` | Step-by-step scraper diagnostics |
  | `POST /api/scrimmage-request` | Emails scrimmage requests via SMTP (nodemailer) |
- The scraper (`api/scraper-serverless.js`) uses **puppeteer-core + @sparticuz/chromium**
  on Vercel and full **puppeteer** locally (branch on `process.env.VERCEL`). Results are
  cached in-memory for `CACHE_DURATION_MINUTES` (default 30).

## Environment variables (set in Vercel project settings)

`RDYSL_USERNAME`, `RDYSL_PASSWORD`, `CACHE_DURATION_MINUTES`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

## Local testing

There is no local server. To exercise the scraper locally (needs a `.env` with RDYSL
credentials):

```bash
node -e "
const fs = require('fs');
for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const S = require('./api/scraper-serverless.js');
new S().scrapeCallupData().then(d => console.log(d.success, (d.summary||[]).length, 'records'));
"
```

## Dependency constraints

- **Node 24** (`engines` field; matches the Vercel runtime).
- **Vercel's function loader cannot `require()` ESM-only packages** — it throws
  `ERR_REQUIRE_ESM` at invocation even though plain Node ≥22.12 allows it, so local
  tests pass and production crashes. This is why puppeteer is pinned to the 24.x line
  (`type: commonjs`) rather than the ESM-only 25.x. Before adding or upgrading any
  dependency, confirm nothing in the tree is `"type": "module"` without a `require`
  export condition.
- `@sparticuz/chromium`'s major version must match the Chrome version of the pinned
  puppeteer release (see https://pptr.dev/supported-browsers), so the two are updated
  together as an exact-pinned pair.
