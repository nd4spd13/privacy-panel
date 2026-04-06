# CLAUDE.md — Privacy Facts

## Project Overview

Privacy Facts is an open-source tool that parses company privacy policies, extracts structured data into a standardized JSON schema, generates a consumer-facing "Privacy Facts" label (modeled on FDA Nutrition Facts), and applies a transparent, versioned rubric to produce a letter grade (A–F).

The project has three layers:
1. **Factual extraction** — AI-powered parsing of privacy policies into structured data
2. **Neutral label** — A standardized visual disclosure (the "Privacy Facts" panel)
3. **Evaluative grade** — A letter grade derived from a published, deterministic rubric

These layers are architecturally separate. The factual layer is legally defensible as restatement of public disclosures. The grade is clearly labeled as opinion based on a transparent methodology.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Framework:** Next.js 14+ with App Router
- **Database:** SQLite via better-sqlite3 (Phase 1), migration path to Postgres
- **AI extraction:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Styling:** Tailwind CSS
- **Label rendering:** React components (SVG + HTML), server-side rendering for PNG/PDF
- **Package manager:** pnpm
- **Testing:** Vitest for unit tests, Playwright for e2e

## Project Structure

```
privacy-facts/
├── CLAUDE.md                          # This file
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
│
├── src/
│   ├── app/                           # Next.js App Router pages
│   │   ├── page.tsx                   # Home — search bar + hero
│   │   ├── layout.tsx                 # Root layout
│   │   ├── company/
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Company profile — label + grade + details
│   │   ├── compare/
│   │   │   └── page.tsx               # Side-by-side comparison
│   │   ├── directory/
│   │   │   └── page.tsx               # Browseable index of analyzed companies
│   │   ├── rubric/
│   │   │   └── page.tsx               # Full rubric explanation, interactive
│   │   ├── about/
│   │   │   └── page.tsx               # Mission, legal disclaimers, methodology
│   │   └── api/
│   │       └── v1/
│   │           ├── analyze/
│   │           │   └── route.ts       # POST: submit URL for analysis
│   │           ├── company/
│   │           │   └── [slug]/
│   │           │       ├── route.ts   # GET: label data + grade
│   │           │       └── label/
│   │           │           └── route.ts  # GET: rendered label (SVG/PNG)
│   │           ├── compare/
│   │           │   └── route.ts       # GET: comparison data
│   │           ├── rubric/
│   │           │   └── route.ts       # GET: current rubric
│   │           └── search/
│   │               └── route.ts       # GET: company search
│   │
│   ├── core/                          # Core business logic (framework-agnostic)
│   │   ├── schema/
│   │   │   ├── privacy-facts.schema.ts    # Zod schema for the Privacy Facts JSON
│   │   │   └── types.ts                   # TypeScript types derived from schema
│   │   ├── extraction/
│   │   │   ├── extractor.ts               # Main extraction orchestrator
│   │   │   ├── prompts.ts                 # Claude system prompts for extraction
│   │   │   ├── chunker.ts                 # Policy text chunking for long documents
│   │   │   └── validator.ts               # Post-extraction schema validation
│   │   ├── ingestion/
│   │   │   ├── fetcher.ts                 # Fetch policy from URL (readability extraction)
│   │   │   ├── pdf-parser.ts              # PDF text extraction
│   │   │   └── wellknown.ts               # Check for .well-known/privacy-facts.json
│   │   ├── scoring/
│   │   │   ├── engine.ts                  # Deterministic scoring function (pure)
│   │   │   ├── rubric.ts                  # Rubric loader + validator
│   │   │   └── rubric.v1.yaml             # The rubric config (versioned)
│   │   └── rendering/
│   │       ├── PrivacyFactsLabel.tsx      # Neutral label React component
│   │       ├── GradedLabel.tsx            # Label with letter grade header
│   │       ├── ComparisonView.tsx         # Side-by-side comparison component
│   │       └── embed.ts                   # Generate embeddable SVG/HTML snippet
│   │
│   ├── db/
│   │   ├── schema.sql                     # SQLite schema
│   │   ├── client.ts                      # Database client wrapper
│   │   ├── companies.ts                   # Company CRUD
│   │   ├── policies.ts                    # Policy storage
│   │   ├── extractions.ts                 # Extraction results
│   │   └── disputes.ts                    # Dispute tracking
│   │
│   ├── components/                    # Shared UI components
│   │   ├── SearchBar.tsx
│   │   ├── CompanyCard.tsx
│   │   ├── GradeBadge.tsx
│   │   ├── RubricExplainer.tsx
│   │   ├── DisputeForm.tsx
│   │   └── Header.tsx
│   │
│   └── lib/
│       ├── anthropic.ts                   # Claude API client wrapper
│       ├── slugify.ts                     # Company name → URL slug
│       └── utils.ts                       # Shared utilities
│
├── cli/
│   └── index.ts                       # CLI entry: `privacyfacts analyze <url>`
│
├── tests/
│   ├── core/
│   │   ├── extraction.test.ts
│   │   ├── scoring.test.ts
│   │   └── schema.test.ts
│   ├── fixtures/
│   │   ├── policies/                  # Sample privacy policy texts
│   │   │   ├── minimal.txt
│   │   │   ├── typical-saas.txt
│   │   │   └── aggressive.txt
│   │   └── extractions/               # Expected extraction outputs
│   │       ├── minimal.json
│   │       ├── typical-saas.json
│   │       └── aggressive.json
│   └── e2e/
│       └── analyze-flow.test.ts
│
├── public/
│   ├── rubric/
│   │   └── v1.yaml                    # Published rubric (served statically)
│   └── schema/
│       └── v1.json                    # Published JSON schema
│
└── docs/
    ├── RUBRIC.md                      # Human-readable rubric explanation
    ├── SCHEMA.md                      # Schema documentation
    ├── LEGAL.md                       # Legal disclaimers and defensibility notes
    ├── CONTRIBUTING.md                # How to contribute
    └── DISPUTES.md                    # How the dispute process works
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Run CLI
pnpm cli analyze https://example.com/privacy

# Run tests
pnpm test

# Run specific test suite
pnpm test:scoring
pnpm test:extraction

# Build for production
pnpm build

# Lint + type check
pnpm lint && pnpm typecheck
```

## Implementation Order

Build the project in this exact sequence. Each step should be fully functional and tested before moving to the next.

### Step 1: Schema & Types

Create the Privacy Facts JSON schema using Zod. This is the contract that everything else depends on.

**Files:** `src/core/schema/privacy-facts.schema.ts`, `src/core/schema/types.ts`

**Requirements:**
- Define the full PrivacyFacts Zod schema matching the spec below
- Every boolean practice field includes: `value` (boolean), `confidence` (number 0-1), `sourceQuote` (string, the excerpt from the policy that supports the determination)
- `dataCollected` is an array of `{ name: string, sensitive: boolean, sourceQuote: string }`
- Export inferred TypeScript types via `z.infer<>`
- Include a `validate()` function that returns typed errors
- Schema version is a constant exported from the module: `SCHEMA_VERSION = "1.0.0"`

**Test:** Write tests that validate sample fixtures against the schema.

### Step 2: Scoring Engine & Rubric

Build the deterministic scoring engine. This must be a pure function with zero side effects.

**Files:** `src/core/scoring/engine.ts`, `src/core/scoring/rubric.ts`, `src/core/scoring/rubric.v1.yaml`

**Requirements:**
- Rubric is loaded from YAML config file, validated on load
- `score(extraction: PrivacyFacts, rubric: Rubric): GradeResult`
- `GradeResult` includes: `score` (0-100), `letter` (A-F), `label` (string), `color` (hex), `breakdown` (object showing each deduction/bonus applied)
- The breakdown must be human-readable — for each deduction, show what triggered it and the point impact
- Function is pure: same extraction + same rubric = same score, always
- Rubric version is stamped in the output

**Rubric v1 scoring rules:**
```
Start at 100

DEDUCTIONS:
  Sold to third parties:            -25
  Shared for advertising:           -10
  Cross-site tracking:              -10
  Used for profiling/AI decisions:  -8
  Used to train AI models:          -8
  Collects precise geolocation:     -8
  Collects biometric data:          -8
  Collects health data:             -5
  Collects financial data:          -3
  Does not honor GPC:               -5
  Does not honor DNT:               -2
  Third parties > 10:               -10
  Third parties 6-10:               -5
  Retention indefinite:             -10
  Retention > 3 years:              -8
  Retention > 1 year:               -3

BONUSES:
  Per consumer right available:     +2  (max 6 rights = +12)
  Per security measure:             +2  (max 5 measures = +10)

CLAMP: min 0, max 100

GRADES:
  A: 85-100 (Excellent)
  B: 70-84  (Good)
  C: 55-69  (Fair)
  D: 40-54  (Poor)
  F: 0-39   (Failing)
```

**Test:** Write tests with the three fixture profiles (minimal/privacy-first, typical SaaS, aggressive collector) and verify expected grades. Test edge cases (all zeros, all maxed, boundary scores).

### Step 3: Extraction Pipeline

Build the AI-powered extraction that converts raw privacy policy text into the structured schema.

**Files:** `src/core/extraction/extractor.ts`, `src/core/extraction/prompts.ts`, `src/core/extraction/chunker.ts`, `src/core/extraction/validator.ts`

**Requirements:**
- `extract(policyText: string, companyName?: string): Promise<PrivacyFacts>`
- Uses Claude API (claude-sonnet-4-20250514) with a carefully engineered system prompt
- System prompt instructs Claude to:
  - Return ONLY valid JSON matching the schema (no markdown, no preamble)
  - For each boolean determination, include the `sourceQuote` from the policy
  - Assign a `confidence` score (0-1) to each field
  - When the policy is ambiguous or silent on a topic, set confidence low and explain in sourceQuote
  - Default to the consumer-unfavorable interpretation when ambiguous (assume they DO collect/share unless explicitly stated otherwise) — this is the conservative choice for consumer protection
- Chunker splits policies > 150K chars (very rare but handle it)
- Validator runs the schema check on Claude's output and retries once on validation failure
- Include retry logic with exponential backoff for API errors
- Log extraction metadata: model used, token counts, latency

**System prompt design principles:**
- Be extremely specific about the JSON structure expected
- Include 2-3 examples of correct extraction from sample policy snippets
- Instruct the model to look for specific legal phrases that indicate each practice (e.g., "sell," "share for advertising purposes," "cross-context behavioral advertising," "automated decision-making," "train our models")
- Handle the common ambiguity: "share with partners" might or might not mean "sold to third parties" depending on context

**Test:** Use the three fixture policy texts. Verify extractions match expected outputs within tolerance (confidence scores will vary but boolean values should be deterministic for clear-cut policies).

### Step 4: Ingestion Layer

Build the URL-to-text pipeline.

**Files:** `src/core/ingestion/fetcher.ts`, `src/core/ingestion/pdf-parser.ts`, `src/core/ingestion/wellknown.ts`

**Requirements:**
- `fetchPolicy(url: string): Promise<{ text: string, metadata: FetchMetadata }>`
- Use `@mozilla/readability` + `jsdom` for web page extraction (strip nav, headers, footers — get the policy text)
- Handle common patterns: privacy policies behind JavaScript rendering (fallback to raw fetch), PDF links, redirects
- Check for `.well-known/privacy-facts.json` at the domain root first (if it exists and validates, use it directly — skip AI extraction)
- Content hash the extracted text (SHA-256) for change detection
- Respect robots.txt (important for legal defensibility — we're not scraping, we're reading public disclosures)
- User-Agent: `PrivacyFacts/1.0 (+https://privacyfacts.org/bot)`

### Step 5: Label Rendering Components

Build the React components for the Privacy Facts label.

**Files:** `src/core/rendering/PrivacyFactsLabel.tsx`, `src/core/rendering/GradedLabel.tsx`, `src/core/rendering/ComparisonView.tsx`

**Requirements:**
- Port the label design from the existing React artifact (the FDA-style Nutrition Facts label)
- `PrivacyFactsLabel` accepts a `PrivacyFacts` object and renders the neutral label
- `GradedLabel` accepts `PrivacyFacts` + `GradeResult` and renders with the grade header
- Both components work in light and dark mode
- Components are self-contained (no external CSS dependencies beyond Tailwind)
- `ComparisonView` renders 2-3 labels side by side with differences highlighted
- Export a `renderToSVG()` function for static rendering (embeddable widget)

**Design spec (FDA Nutrition Facts style):**
- Outer border: 2.5px solid black
- Title: "Privacy Facts" in 32pt+ bold Helvetica/Arial
- Section dividers: thick (7px), medium (3px), thin (0.5px) rules
- Sensitive data flagged in red (#b91c1c) with filled circle
- Practice badges: black "YES" pill on black bg for standard, red bg for critical (sold to third parties)
- Rights/security: checkbox grid, two columns
- GPC/DNT: green for honored, red for not
- Footer: small gray text with disclaimer and link to full policy
- Width: 380px fixed

### Step 6: CLI Tool

Build a command-line interface for local analysis.

**Files:** `cli/index.ts`

**Requirements:**
- `privacyfacts analyze <url>` — fetch, extract, score, print results
- `privacyfacts analyze <url> --json` — output raw JSON
- `privacyfacts analyze <url> --label` — output SVG label to stdout
- `privacyfacts score <json-file>` — score an existing extraction
- `privacyfacts validate <json-file>` — validate a Privacy Facts JSON file
- Use `commander` for CLI parsing
- Pretty-print the grade with color (chalk) in terminal output
- Show the breakdown: each deduction/bonus with points

### Step 7: Database & API

Build the persistence layer and REST API.

**Files:** `src/db/*`, `src/app/api/v1/*`

**Requirements:**
- SQLite database with tables: companies, policies, extractions, grades, disputes
- API routes as specified in the architecture doc
- `GET /api/v1/company/:slug` returns full label data + grade + extraction metadata
- `POST /api/v1/analyze` accepts `{ url: string }`, returns job ID, processes async
- `GET /api/v1/rubric` returns current rubric version + full rules
- `GET /api/v1/search?q=` searches company names
- Rate limiting: 100 requests/hour per IP for unauthenticated

### Step 8: Web Application Pages

Build the consumer-facing Next.js pages.

**Requirements:**
- **Home:** Search bar (prominent), recent analyses, hero explaining the concept
- **Company profile:** Label + grade + full breakdown + source quotes + dispute link
- **Compare:** Select 2-3 companies, see labels side by side
- **Directory:** Sortable/filterable table of all analyzed companies (grade, data types count, third parties, etc.)
- **Rubric:** Interactive explanation — show how changing a practice affects the score
- **About:** Mission, methodology, legal disclaimers, team, open source links

**Design:** Clean, professional, trust-building. Think Consumer Reports or EFF, not a startup landing page. The design should communicate credibility and neutrality.

## Key Conventions

### Code Style
- Strict TypeScript (no `any`, no `as` casts except where unavoidable with third-party libs)
- Functional style: pure functions in `core/`, React hooks in components
- All business logic lives in `src/core/` and is framework-agnostic (testable without Next.js)
- Named exports, no default exports (except Next.js pages)
- Error handling: use discriminated unions (`{ success: true, data } | { success: false, error }`) not thrown exceptions for business logic

### Testing
- Every module in `src/core/` must have corresponding tests
- Scoring engine tests are the most critical — the rubric is a legal document
- Use fixture files for policy texts and expected extractions
- Extraction tests should use mocked Claude API responses (don't hit the API in CI)

## Error Handling Philosophy: Fail Loud, Never Fake
Prefer a visible failure over a silent fallback.
- Never silently swallow errors to keep things "working."
  Surface the error. Don't substitute placeholder data.
- Fallbacks are acceptable only when disclosed. Show a
  banner, log a warning, annotate the output.
- Design for debuggability, not cosmetic stability.
Priority order:
1. Works correctly with real data
2. Falls back visibly — clearly signals degraded mode
3. Fails with a clear error message
4. Silently degrades to look "fine" — never do this


### Legal Disclaimers
Every rendered label must include:
- "This label summarizes privacy practices as disclosed in the company's privacy policy."
- "The grade reflects Privacy Facts' assessment based on our published rubric (v{version}). It is our opinion."
- "This is not legal advice."
- Link to full rubric and methodology

### Environment Variables
```
ANTHROPIC_API_KEY=          # Required for extraction
DATABASE_URL=               # SQLite path (default: ./data/privacyfacts.db)
NEXT_PUBLIC_BASE_URL=       # For canonical URLs
```

## First Session Goal

In the first Claude Code session, build Steps 1-3: the schema, the scoring engine, and the extraction pipeline. These are the core engine that everything else depends on. By the end of the session, `pnpm cli analyze https://signal.org/legal/privacy-policy/` should produce a valid Privacy Facts JSON and a letter grade.
