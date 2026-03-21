# Privacy Facts — Product Architecture & Claude Code Bootstrap

## Product Vision

**Privacy Facts** is an open-source tool that parses company privacy policies, extracts structured data into a standardized format, generates a consumer-facing "Privacy Facts" label (neutral disclosure), and applies a transparent rubric to produce a letter grade (A–F). Think of it as "Nutrition Facts + Energy Star rating for privacy policies."

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     PRIVACY FACTS                        │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │   Ingestion  │──▶│   Extraction  │──▶│   Scoring    │  │
│  │   Layer      │   │   Pipeline    │   │   Engine     │  │
│  └─────────────┘   └──────────────┘   └──────────────┘  │
│        │                   │                  │           │
│        ▼                   ▼                  ▼           │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Policy      │   │  Structured   │   │  Label       │  │
│  │  Store       │   │  Schema       │   │  Renderer    │  │
│  │  (raw text)  │   │  (JSON)       │   │  (SVG/HTML)  │  │
│  └─────────────┘   └──────────────┘   └──────────────┘  │
│                                              │           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                    Web App / API                     │ │
│  │  - Lookup by company    - Compare side-by-side      │ │
│  │  - Submit URL           - Browse directory           │ │
│  │  - Dispute / correct    - Embed widget              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Browser Extension (future)              │ │
│  │  - Show label on any site    - Inline warnings      │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Ingestion Layer

**Purpose:** Accept privacy policy input from multiple sources.

**Input methods:**
- URL → fetch and extract page text (readability extraction)
- Raw text paste
- PDF upload → text extraction
- `.well-known/privacy-facts.json` (if company publishes structured data)

**Output:** Raw policy text stored with metadata (company name, URL, fetch timestamp, content hash for change detection).

**Tech:** Node.js/TypeScript. Use `mozilla/readability` for web extraction, `pdf-parse` for PDFs.

### 2. Extraction Pipeline (AI-powered)

**Purpose:** Parse unstructured privacy policy text into the Privacy Facts JSON schema.

**Approach:** Use Claude API to extract structured data from the raw policy text. This is the core AI agent — a single-purpose extraction agent that maps natural language to a fixed schema.

**Why Claude, not regex/NLP:** Privacy policies are written in wildly varying legal language. "We may share your information with select partners" and "Your data is made available to third-party advertising networks" mean the same thing but look completely different. LLM extraction handles this naturally.

**Pipeline steps:**
1. **Chunk** the policy if it exceeds context limits
2. **Extract** structured fields via Claude with a strict system prompt and JSON output schema
3. **Validate** the extracted JSON against the Privacy Facts schema
4. **Confidence score** each field (Claude returns confidence alongside each extraction)
5. **Human review queue** for low-confidence extractions

**Key extraction fields:**
```json
{
  "companyName": "string",
  "policyUrl": "string",
  "lastUpdated": "ISO date",
  "dataCollected": [
    { "name": "string", "sensitive": boolean, "sourceQuote": "string" }
  ],
  "dataPurposes": ["string"],
  "practices": {
    "soldToThirdParties": { "value": boolean, "confidence": number, "sourceQuote": "string" },
    "sharedForAdvertising": { "value": boolean, "confidence": number, "sourceQuote": "string" },
    "crossSiteTracking": { "value": boolean, "confidence": number, "sourceQuote": "string" },
    "usedForProfiling": { "value": boolean, "confidence": number, "sourceQuote": "string" },
    "usedToTrainAI": { "value": boolean, "confidence": number, "sourceQuote": "string" }
  },
  "thirdPartyRecipients": { "count": number, "categories": ["string"] },
  "retentionPeriod": "string",
  "rights": {
    "access": boolean,
    "delete": boolean,
    "correct": boolean,
    "optOut": boolean,
    "portability": boolean,
    "appeal": boolean
  },
  "security": {
    "encryptionInTransit": boolean,
    "encryptionAtRest": boolean,
    "mfa": boolean,
    "breachNotification": boolean,
    "independentAudits": boolean
  },
  "honorsGPC": boolean,
  "honorsDNT": boolean,
  "childrenPolicy": "string",
  "coppaCompliant": boolean,
  "extractionMetadata": {
    "modelUsed": "string",
    "extractedAt": "ISO datetime",
    "overallConfidence": number,
    "policyWordCount": number,
    "lowConfidenceFields": ["string"]
  }
}
```

**Critical design choice:** Every boolean extraction includes a `sourceQuote` — the specific text from the policy that the AI identified as supporting the determination. This is the legal shield. If a company disputes a finding, you can point to their own language.

### 3. Scoring Engine

**Purpose:** Apply the transparent rubric to produce a letter grade (A–F).

**Design principles:**
- Rubric is a standalone, versioned JSON/YAML config file
- Scoring function is pure (same inputs → same output, always)
- No AI in the scoring step — deterministic math only
- Rubric version is stamped on every generated label

**Rubric structure (v1):**
```yaml
rubric_version: "1.0.0"
max_score: 100

# Deductions (from 100)
deductions:
  practices:
    soldToThirdParties: -25
    sharedForAdvertising: -10
    crossSiteTracking: -10
    usedForProfiling: -8
    usedToTrainAI: -8
  
  sensitive_data:
    preciseLocation: -8
    biometricData: -8
    healthData: -5
    financialData: -3
  
  signals:
    gpc_not_honored: -5
    dnt_not_honored: -2
  
  third_parties:
    count_over_10: -10
    count_over_5: -5
  
  retention:
    indefinite: -10
    over_3_years: -8
    over_1_year: -3

# Bonuses (added back)
bonuses:
  rights:
    per_right_available: +2  # max 6 rights × 2 = +12
  security:
    per_measure_implemented: +2  # max 5 measures × 2 = +10

# Grade thresholds
grades:
  A: { min: 85, label: "Excellent" }
  B: { min: 70, label: "Good" }
  C: { min: 55, label: "Fair" }
  D: { min: 40, label: "Poor" }
  F: { min: 0,  label: "Failing" }
```

**Why separate rubric from extraction:** The factual label (Privacy Facts) is defensible regardless of the rubric. The grade is opinion. Keeping them architecturally separate means you can iterate the rubric, version it, accept community input on weightings, and even let users apply their own rubric — all without touching the factual extraction layer.

### 4. Label Renderer

**Purpose:** Generate the visual Privacy Facts label and optional grade badge.

**Output formats:**
- **SVG** — for web embedding, pixel-perfect at any size
- **HTML** — for interactive web display with hover states
- **PNG** — for sharing on social media, screenshots
- **PDF** — for print, formal reports
- **JSON** — machine-readable (the raw schema output)

**Two rendering modes:**
1. **Neutral label** (Privacy Facts) — black and white, no grade, just facts
2. **Graded label** — includes the letter grade header with color

**Tech:** React component (reuse what we already built) for HTML/interactive. Server-side rendering via Puppeteer or `@react-pdf/renderer` for PDF/PNG. Pure SVG template for the embeddable widget.

### 5. Web Application

**Purpose:** Consumer-facing site where anyone can look up a company or submit a policy URL.

**Pages:**
- **Home / Search** — search by company name or paste a URL
- **Company Profile** — the label, grade, source quotes, extraction metadata, rubric breakdown
- **Compare** — side-by-side comparison of 2–3 companies
- **Directory** — browseable index of all analyzed companies, filterable/sortable
- **Rubric** — full explanation of scoring methodology with interactive examples
- **About** — mission, legal disclaimers, methodology, team
- **Dispute** — form for companies to submit corrections

**Tech:** Next.js (React + API routes). SQLite or Postgres for storage. Deployed on Vercel or similar.

### 6. API

**Purpose:** Enable third-party integrations (browser extensions, other apps).

**Endpoints:**
```
GET  /api/v1/company/:slug          → label data + grade
GET  /api/v1/company/:slug/label    → rendered label (SVG/PNG)
POST /api/v1/analyze                → submit URL for analysis
GET  /api/v1/compare?companies=a,b  → comparison data
GET  /api/v1/rubric                 → current rubric version + rules
GET  /api/v1/search?q=              → company search
```

**Rate limiting:** Generous free tier (1000 req/day) to encourage adoption. API key for higher volume.

### 7. Dispute & Correction System

**Purpose:** Allow companies to contest label findings. Critical for legal defensibility.

**Flow:**
1. Company submits dispute via web form (identified by email domain matching company)
2. Dispute includes: field contested, correct value (per company), supporting evidence
3. Dispute is publicly visible on the company's profile page
4. Maintainers review and either update the extraction or note the disagreement
5. All disputes and resolutions are logged in a public changelog

**Why this matters legally:** Demonstrates good faith, eliminates "reckless disregard" arguments, and mirrors how Consumer Reports handles manufacturer rebuttals.

---

## Data Model (simplified)

```
companies
  - id, slug, name, domain, logo_url
  - created_at, updated_at

policies
  - id, company_id, url, raw_text, content_hash
  - fetched_at, word_count

extractions
  - id, policy_id, schema_version, rubric_version
  - extracted_data (JSONB — the full Privacy Facts schema)
  - overall_confidence, model_used
  - extracted_at, reviewed_by, reviewed_at

grades
  - id, extraction_id, rubric_version
  - score, letter, breakdown (JSONB)
  - graded_at

disputes
  - id, company_id, extraction_id
  - field_disputed, claimed_value, evidence
  - submitter_email, submitter_verified
  - status (pending | accepted | rejected | noted)
  - resolution_notes, resolved_at
```

---

## Development Phases

### Phase 1: Core Engine (MVP)
- Privacy Facts JSON schema + validation
- Claude-powered extraction pipeline (URL → structured JSON)
- Deterministic scoring engine + rubric v1
- React label renderer (neutral + graded)
- Simple CLI: `privacyfacts analyze https://example.com/privacy`

### Phase 2: Web App
- Next.js app with search, company profiles, comparison
- SQLite database for analyzed policies
- Basic API endpoints
- Rubric explanation page
- Dispute submission form

### Phase 3: Scale & Trust
- Directory of pre-analyzed top 500 companies
- Change detection (re-fetch policies periodically, flag changes)
- Community rubric proposals (GitHub PRs to rubric.yaml)
- Browser extension (show grade badge on sites)
- Embeddable widget for blogs/journalism

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript | Type safety for the schema, full-stack consistency |
| Framework | Next.js 14+ (App Router) | SSR for SEO, API routes, React components |
| Database | SQLite (Phase 1) → Postgres (Phase 2+) | Simple start, easy migration |
| AI | Claude API (Sonnet for extraction) | Best at structured extraction from legal text |
| Styling | Tailwind CSS | Fast iteration, matches existing label components |
| Label rendering | React + SVG | Already prototyped in artifact |
| PDF generation | @react-pdf/renderer or Puppeteer | Server-side label rendering |
| Deployment | Vercel | Zero-config Next.js hosting |
| Package manager | pnpm | Fast, disk-efficient |

---

## Legal Safeguards (built into the product)

1. **Source quotes on every extraction** — traceable to the company's own language
2. **Rubric published and versioned** — anyone can reproduce the score
3. **Grade clearly labeled as opinion** — "This grade represents Privacy Facts' assessment..."
4. **Dispute mechanism** — companies can contest and corrections are logged
5. **Open source** — community can audit methodology
6. **No false statements of fact** — factual layer is derived from company disclosures
7. **Prominent disclaimers** — not legal advice, not regulatory compliance assessment
