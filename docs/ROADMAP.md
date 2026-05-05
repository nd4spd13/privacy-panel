# Privacy Panel — Roadmap

## Planned: Migrate from SQLite to Postgres

**Status:** Not started
**Priority:** Required before scaling beyond a single Railway instance

---

### Why migrate?

| Concern | SQLite (current) | Postgres (target) |
|---|---|---|
| **Concurrent writes** | Single writer — analysis jobs block reads during writes | Full concurrent reads + writes |
| **Horizontal scaling** | Database lives on one machine's disk — can't run multiple app replicas | Connection pooling; any instance connects to shared DB |
| **Managed backups** | Manual (copy the `.db` file) | Point-in-time recovery, automated snapshots via Railway / Neon / Supabase |
| **Full-text search** | `LIKE '%query%'` — table scan | `tsvector` / `pg_trgm` — indexed, fast |
| **JSON querying** | Stored as TEXT, parsed in app code | Native `jsonb` operators — query inside facts without deserializing |
| **Hosting flexibility** | Requires persistent disk — can't run on Vercel, Cloudflare, or serverless | Works everywhere via connection string |
| **Team access** | No shared access to production data | psql / DataGrip / Supabase Studio |

The SQLite setup is intentional for Phase 1 — it's zero-config and fast for a single-server deploy. Migrate when any of the following are true:

- Traffic warrants more than one app replica
- Analysis jobs are added back (write contention becomes a problem)
- We move to Vercel or another serverless host
- The team needs shared read access to the production database

---

### Migration plan

#### 1. Choose a Postgres provider

Recommended options (all have free tiers):
- **Neon** — serverless Postgres, branches like git, best for Vercel
- **Railway Postgres** — one-click add-on, same platform as the app
- **Supabase** — Postgres + REST API + Studio UI, good for team access

#### 2. Swap the DB client

Replace `better-sqlite3` with `postgres` (the `postgres` npm package) or `pg`.

```bash
npm remove better-sqlite3 @types/better-sqlite3
npm install postgres
# or: npm install pg @types/pg
```

#### 3. Translate the schema

`src/db/schema.sql` is already standard SQL — minor changes needed:

| SQLite | Postgres equivalent |
|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` |
| `TEXT` for JSON columns | `JSONB` |
| `strftime('%Y-%m-%dT%H:%M:%SZ','now')` | `NOW()` |
| `PRAGMA journal_mode=WAL` | (remove — not applicable) |
| `PRAGMA foreign_keys=ON` | (always on in Postgres) |

#### 4. Rewrite the DB layer

All queries are in `src/db/*.ts` using `better-sqlite3`'s synchronous API. Postgres clients are async — every query becomes `await`.

Files to update:
- `src/db/client.ts` — replace singleton with connection pool
- `src/db/companies.ts`
- `src/db/extractions.ts`
- `src/db/policies.ts`
- `src/db/disputes.ts`
- `src/db/jobs.ts`

All Next.js page and API route callers are already `async`, so the await changes propagate cleanly.

#### 5. Migrate existing data

```bash
# Export current SQLite data
npx tsx scripts/export-db.ts > seed.sql

# Import into Postgres
psql $DATABASE_URL < seed.sql
```

(Write `scripts/export-db.ts` at migration time — reads all tables and emits INSERT statements.)

#### 6. Update environment variables

```bash
# Before (SQLite)
DATABASE_URL=./data/privacypanel.db

# After (Postgres)
DATABASE_URL=postgresql://user:password@host:5432/privacypanel
```

The `src/db/client.ts` factory function already reads from `DATABASE_URL` — update it to detect the protocol and instantiate the right client, or just replace it outright.

#### 7. Remove Railway persistent volume

Once Postgres is live, the `data/` volume and `scripts/start.js` directory-creation logic can be removed. Update `railway.json` start command back to `next start`.

---

### Effort estimate

| Task | Size |
|---|---|
| Schema translation | Small |
| DB client rewrite (7 files) | Medium |
| Making all callers async | Medium (mechanical) |
| Data migration script | Small |
| Testing | Medium |
| **Total** | **~1–2 days** |

---

## Other planned work

- **Rubric v2** — add data broker opt-out, dark pattern detection, children's data handling
- **Dispute system UI** — `src/db/disputes.ts` is built; the form and admin review flow are not
- **Embeddable widget** — `src/core/rendering/embed.ts` is built; needs a CDN-served JS snippet
- **Weekly re-analysis** — cron job to detect policy changes via content hash diff
- **API authentication** — optional API keys for higher rate limits (10k req/hr)
