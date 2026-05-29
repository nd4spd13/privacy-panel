# Scripts

## seed-self-as-company.ts

Inserts Privacy Panel itself as a company entry in the directory with a handcrafted `PrivacyPanel` object (not AI-extracted). The script is idempotent — safe to re-run; it upserts rather than duplicating.

**When to run:** any time `SELF_DATA` in `src/app/privacy/page.tsx` changes (e.g. new data practice, updated retention period, corrected rights). Also run it after a fresh database reset.

```bash
npx tsx scripts/seed-self-as-company.ts
```

The script reads `SELF_DATA` from its own local copy (kept in sync with `privacy/page.tsx`) and scores it through the live rubric, so the grade shown in the directory reflects the current scoring engine.

## audit-quotes.ts

Quote-integrity audit (CRS-187). For every company's latest extraction, verifies each stored `sourceQuote` is verbatim from the policy text in the DB (exact or high fuzzy trigram-coverage match), collapses "policy is silent" notes to one canonical boilerplate, and flags fabricated / unlocated quotes for re-extraction.

```bash
npx tsx scripts/audit-quotes.ts            # dry-run report (read-only)
npx tsx scripts/audit-quotes.ts --apply    # rewrite silence quotes → boilerplate
npx tsx scripts/audit-quotes.ts --ci       # exit 1 if any flagged (pre-publish gate)
```

Writes a full JSON report to `results/quote-audit.json`. FLAGGED quotes are **never** auto-fixed — they indicate fabricated or paraphrased evidence and must be re-extracted (CRS-174).

## seed.sql

Raw SQL bootstrap for the database schema. Applied automatically on first start via `start.js`. Do not run manually unless rebuilding the database from scratch.

## start.js

Production entrypoint that applies `seed.sql` if needed, then starts the Next.js server. Used by the Railway deployment.
