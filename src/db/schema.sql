PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Companies ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  domain         TEXT,
  parent_company TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_slug   ON companies (slug);
CREATE INDEX IF NOT EXISTS idx_companies_name   ON companies (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies (domain);

-- ─── Policies ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  url          TEXT    NOT NULL,
  content_hash TEXT    NOT NULL,   -- SHA-256 of raw policy text
  raw_text     TEXT,               -- Full extracted policy text (added v2)
  fetched_at   TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  -- Provenance (added v4 / CRS-199 / CRS-190)
  normalized_hash     TEXT,        -- SHA-256 of norm-v1(raw_text); distinct from content_hash
  normalizer          TEXT,        -- e.g. "norm-v1"
  archive_url         TEXT,        -- Wayback capture (CRS-200)
  archive_captured_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_policies_company   ON policies (company_id);
CREATE INDEX IF NOT EXISTS idx_policies_hash      ON policies (content_hash);

-- ─── Extractions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extractions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id       INTEGER NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
  company_id      INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  -- Full Privacy Panel JSON stored as text
  facts_json      TEXT    NOT NULL,
  -- Scoring output
  score           INTEGER NOT NULL,
  letter          TEXT    NOT NULL,
  grade_label     TEXT    NOT NULL,
  grade_color     TEXT    NOT NULL,
  rubric_version  TEXT    NOT NULL,
  breakdown_json  TEXT    NOT NULL,
  -- Extraction metadata
  model           TEXT    NOT NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  latency_ms      INTEGER,
  chunked         INTEGER NOT NULL DEFAULT 0,  -- boolean
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_extractions_company  ON extractions (company_id);
CREATE INDEX IF NOT EXISTS idx_extractions_policy   ON extractions (policy_id);
CREATE INDEX IF NOT EXISTS idx_extractions_score    ON extractions (score);
CREATE INDEX IF NOT EXISTS idx_extractions_letter   ON extractions (letter);

-- ─── Jobs (async analysis queue) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT    PRIMARY KEY,   -- UUID
  url         TEXT    NOT NULL,
  company_id  INTEGER REFERENCES companies (id),
  status      TEXT    NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
  error       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);

-- ─── Disputes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  extraction_id INTEGER NOT NULL REFERENCES extractions (id) ON DELETE CASCADE,
  company_id    INTEGER NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  field         TEXT    NOT NULL,   -- e.g. "soldToThirdParties"
  claimed_value TEXT    NOT NULL,   -- what the company claims is correct
  evidence_url  TEXT,
  contact_email TEXT,
  status        TEXT    NOT NULL DEFAULT 'open',  -- open | reviewing | resolved | rejected
  resolution    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_disputes_company    ON disputes (company_id);
CREATE INDEX IF NOT EXISTS idx_disputes_extraction ON disputes (extraction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status     ON disputes (status);
