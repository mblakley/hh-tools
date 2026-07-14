# Project: Hilton Heat Tools — RDYSL Callup Checker

## What this is (2026-07 reality)

A static site + Vercel serverless functions. **The callup checker is the only feature in
active use.** The old Express/sqlite/TeamSnap management app, Docker setup, season-scraper
scripts, Playwright E2E suite, and their docs were removed in the 2026-07 cleanup — do not
recreate them or consult git history as if they were current.

- `public/` — static UI (`index.html` + `js/app.js` = callup dashboard,
  `rdysl-callup-checker.html`), behind a cookie login gate (`middleware.js` + `api/auth.js`).
- `api/` — CommonJS functions: `callups` (scraper + 30-min in-memory cache), `health`,
  `auth`, `debug` (scraper diagnostics), `scrimmage-request` (nodemailer email; kept
  deployed even though no page in the repo calls it — something external may post to it).
- `api/scraper-serverless.js` — the scraper class. On Vercel it uses puppeteer-core +
  @sparticuz/chromium; locally it uses full puppeteer (branch on `process.env.VERCEL`).

## Deployment

- GitHub integration: push `master` → auto-deploy Vercel project `hh_tools` →
  https://hhtools.vercel.app. No CLI deploys needed.
- Build logs: `https://api.vercel.com/v3/deployments/<url>/events?builds=1`.
  Runtime logs: `vercel logs <deployment-url> --json` WITHOUT piping (pipes buffer),
  trigger the failing request while it follows.
- Rollback on the hobby plan only reaches the immediately-previous production deployment;
  if that is also broken, fix forward.
- **Verify after every deploy**: `GET /api/health` → 200 and `GET /api/callups` → 200 with
  data (cold start triggers a real scrape, exercising the whole chromium path).

## Critical dependency rules

1. **Vercel's function loader cannot `require()` ESM-only packages** (`ERR_REQUIRE_ESM`,
   `FUNCTION_INVOCATION_FAILED`). Local Node ≥22.12 permits require-of-ESM, so local tests
   pass and production crashes — local success is NOT proof. Before any dep change, scan
   the tree: flag any package with `"type": "module"` and no `require` condition in its
   `exports`. This is why puppeteer is pinned to the CJS 24.x line, not ESM-only 25.x,
   and why cheerio's `encoding-sniffer` must stay on 0.2.x (1.x is ESM-only).
2. **puppeteer/puppeteer-core and @sparticuz/chromium are an exact-pinned matched pair**
   (chromium major = the Chrome version of the puppeteer release, per
   https://pptr.dev/supported-browsers and puppeteer's versions.json). Update together.
3. Node **24.x** (`engines`; matches Vercel runtime setting).

## Local testing

No local server exists. Test the scraper inline (needs `.env` with RDYSL creds — parse it
in node; do NOT `source .env` in a shell):

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

## Shell environment

Windows 11; use Git-Bash/Unix syntax (forward slashes, `/c/Users/...` paths, `/dev/null`).
No PowerShell-specific syntax.

## Local-only files (never commit, never delete without asking)

- `data/` (~7 GB local media + CSV exports), `screenshots/`, `*.xlsx`, `eng.traineddata`,
  OCR scripts in `scripts/` — Mark's local working data; gitignored/untracked by design.
- `.vercel/`, `.env`, `.env.local` — local Vercel link + secrets.
