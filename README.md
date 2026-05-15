# Privacy Panel

[![Tests](https://github.com/nd4spd13/privacy-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/nd4spd13/privacy-panel/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Open-source privacy policy analyzer. Privacy policies are parsed offline by Claude into a standardized JSON schema, rendered as FDA Nutrition Facts-style "Privacy Panel" labels, and graded A–F using a published, deterministic rubric.

**Live site:** https://privacypanel.org
**Rubric:** [src/core/scoring/rubric.v2.yaml](src/core/scoring/rubric.v2.yaml)
**Schema:** [src/core/schema/types.ts](src/core/schema/types.ts)

---

## How it works

1. **Fetch** — A company's public privacy policy is downloaded
2. **Extract** — Claude reads the policy and extracts structured facts (what's collected, shared, retained, and for how long) along with source quotes
3. **Score** — A deterministic rubric converts the facts into a 0–100 score and A–F letter grade
4. **Label** — The score is rendered as a standardized "Privacy Panel" panel

The three layers are architecturally separate: extraction is factual restatement; the grade is clearly labeled as opinion based on a published methodology.

> **Note:** This repository contains the public-facing web app and label renderer only. It is a read-only presentation layer that serves pre-computed extractions from a SQLite database. The Anthropic-API ingestion pipeline that produces those extractions lives in a separate repository and is not part of this codebase. The web app makes no Claude API calls at runtime.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure environment
cp .env.example .env.local
# Defaults work out of the box; only NEXT_PUBLIC_BASE_URL needs editing for production

# 3. Run the dev server
npm run dev
```

The database is created and seeded automatically on first boot from [`scripts/seed.sql`](scripts/seed.sql), which contains the canonical set of analyzed companies. No API keys are required to run the site locally.

To re-seed the "Privacy Panel" self-entry after editing `SELF_DATA` in `src/app/privacy/page.tsx`:

```bash
DATABASE_URL=./data/privacyfacts.db npx tsx scripts/seed-self-as-company.ts
```

---

## Public API

All endpoints are read-only.

| Endpoint | Description |
|---|---|
| `GET /api/v1/company/:slug` | Full facts + grade + metadata |
| `GET /api/v1/company/:slug/label` | SVG or HTML label (`?format=html`, optional `?width=`) |
| `GET /api/v1/search?q=` | Search companies by name |
| `GET /api/v1/compare?slugs=a,b,c` | Compare 2–3 companies |
| `GET /api/v1/rubric` | Current rubric JSON |

Rate limit: 100 requests / hour / IP.

---

## Tech stack

- **Framework:** Next.js 15 (App Router)
- **Database:** SQLite via `better-sqlite3`
- **Styling:** Tailwind CSS
- **Testing:** Vitest (unit), Playwright (e2e)
- **Hosting:** Railway

---

## Contributing

Issues and pull requests welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.

If you spot a problem with a specific extraction (the source quote doesn't match the policy, or a YES/no looks wrong), use the **"Dispute this finding"** link on any company page or open an issue with the *Dispute a finding* template.

---

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

The web app holds no Anthropic API key at runtime. The presentation layer reads pre-computed extractions from SQLite; there is no endpoint that triggers Claude API calls from a browser request.

---

## License

[MIT](LICENSE).

The Privacy Panel label design, rubric, and methodology are open. You are free to use, adapt, or build on them — please preserve attribution and do not misrepresent grades as official regulatory determinations.

---

## Legal

Privacy Panel grades are **opinion**, not legal determinations. The scoring rubric is publicly documented. Companies' disclosures are summarized as stated in their own policies — no factual claims are made beyond what is in those documents.

See [docs/privacy-panel-architecture.md](docs/privacy-panel-architecture.md) for full methodology.
