# Privacy Panel

Open-source privacy policy analyzer. We parse company privacy policies, extract structured data with Claude, generate FDA Nutrition Facts-style "Privacy Panel" labels, and assign A–F letter grades using a published, deterministic rubric.

**Live site:** https://privacypanel.org
**Rubric:** [public/rubric/v1.yaml](public/rubric/v1.yaml)
**Schema:** [public/schema/v1.json](public/schema/v1.json)

---

## How it works

1. **Fetch** — We download a company's public privacy policy
2. **Extract** — Claude reads the policy and extracts structured facts (what's collected, shared, retained, and for how long) with source quotes
3. **Score** — A deterministic rubric converts the facts into a 0–100 score and A–F letter grade
4. **Label** — The score is rendered as a standardized "Privacy Panel" label

The three layers are architecturally separate: extraction is factual restatement; the grade is clearly labeled as opinion based on a published methodology.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 3. Create the database directory
mkdir -p data

# 4. Run the dev server
npm run dev

# 5. Analyze a privacy policy via CLI
npx tsx cli/index.ts analyze https://signal.org/legal/ --company Signal
```

---

## Populating the database

The database is not committed to this repo (it's a binary SQLite file). To populate it:

**Option A — CLI (one at a time):**
```bash
npx tsx cli/index.ts analyze https://example.com/privacy --company "Example Co"
```

**Option B — Batch from a CSV file (url,company per line):**
```bash
npx tsx cli/index.ts batch urls.csv --concurrency 3
```

**Option C — Ingest from pre-fetched PDF snapshots:**
```bash
# First fetch snapshots (requires Python 3.9+)
pip install requests html2text reportlab
python3 fetch_snapshots.py --delay 1.5

# Then extract + score them
npx tsx cli/index.ts ingest-snapshots \
  --provenance policy-provenance.json \
  --concurrency 3 \
  --skip-existing
```

A `urls.csv` with 100 major consumer-facing companies is included.

---

## CLI reference

```
npx tsx cli/index.ts analyze <url>          Fetch, extract, score, and print
  --company <name>                          Override company name
  --json                                    Output raw JSON
  --label                                   Output SVG label to stdout

npx tsx cli/index.ts score <json-file>      Score an existing extraction JSON
npx tsx cli/index.ts validate <json-file>   Validate a Privacy Panel JSON file
npx tsx cli/index.ts batch <csv-file>       Analyze multiple URLs from a CSV
npx tsx cli/index.ts ingest-snapshots       Extract from local PDF snapshots
```

---

## API

All endpoints are read-only (no user-submitted analysis).

| Endpoint | Description |
|---|---|
| `GET /api/v1/company/:slug` | Full facts + grade + metadata |
| `GET /api/v1/company/:slug/label` | SVG or HTML label (`?format=html`) |
| `GET /api/v1/search?q=` | Search companies by name |
| `GET /api/v1/compare?slugs=a,b,c` | Compare 2–3 companies |
| `GET /api/v1/rubric` | Current rubric JSON |

Rate limit: 100 requests/hour per IP.

---

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Database:** SQLite via `better-sqlite3`
- **AI extraction:** Anthropic Claude (`claude-sonnet-4-20250514`)
- **Styling:** Tailwind CSS
- **Testing:** Vitest (unit), Playwright (e2e)

---

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

The `ANTHROPIC_API_KEY` is a server-only environment variable — it is never bundled into client-side JavaScript and cannot be accessed from the browser. The website has no endpoint for users to trigger Claude API calls.

---

## License

MIT. See [LICENSE](LICENSE) for details.

The Privacy Panel label design, rubric, and methodology are open-source. You are free to use them, adapt them, or build on them — but please preserve attribution and do not misrepresent grades as official regulatory determinations.

---

## Legal

Privacy Panel grades are **opinion**, not legal determinations. The scoring rubric is publicly documented. We summarize what companies disclose in their own policies — we do not make factual claims beyond what is stated in those documents.

See [docs/privacy-panel-architecture.md](docs/privacy-panel-architecture.md) for full methodology and legal considerations.
