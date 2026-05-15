# Contributing to Privacy Panel

Thanks for your interest in contributing. Privacy Panel is a small public-interest project, and outside contributions are welcome — especially around label readability, rubric clarity, and dispute handling.

## What this repository is (and isn't)

This repository holds the **public-facing web app and label renderer**. It is a read-only presentation layer that serves pre-computed extractions from a SQLite database. The Anthropic API ingestion pipeline (the part that actually reads policies and produces extractions) lives in a separate, non-public repository.

That means contributions to **scoring rules, label design, schema fields, the directory UI, the public API, accessibility, and documentation** are great fits here. Contributions to the **extraction prompts or pipeline** are not actionable in this repo.

## Before you start work

Open an issue first for anything larger than a small fix. This avoids the situation where you build something thoughtful and we have to redirect it.

For routine fixes (typos, broken links, small UI bugs, accessibility wins), feel free to skip the issue and open a PR directly.

## Local setup

```bash
git clone https://github.com/nd4spd13/privacy-panel.git
cd privacy-panel
npm install
npm run dev
```

The database is created and seeded automatically on first boot from `scripts/seed.sql`. No API keys are required.

## Workflow

1. Create a branch off `main`.
2. Make your change. Keep PRs focused — one concern per PR.
3. Run the checks before pushing:
   ```bash
   npm run typecheck
   npm test
   npm run lint
   ```
4. Open a PR. Describe **what** changed and **why**. Screenshots are great for any UI change.

## Disputing an extraction (this is not a code contribution)

If a specific extraction looks wrong (the source quote doesn't match the policy text, or a YES/no is misread), use the **"Dispute this finding"** link on the relevant company page, or open an issue with the *Dispute a finding* template. These are routed to the people who maintain the extraction pipeline.

Disputes are about **findings**, not grades. The grade is opinion based on a [published rubric](src/core/scoring/rubric.v2.yaml) — if you disagree with the methodology, that's a separate kind of issue, and welcome too.

## Coding conventions

- TypeScript strict mode. No `any` without justification.
- Server components by default; only mark `"use client"` when state or browser APIs are needed.
- Database access goes through `src/db/`. Always use prepared statements with bound parameters.
- Inline styles are OK in label-rendering code (the label is rendered server-side and embeds via SVG `foreignObject`); Tailwind for everything else.
- No comments that just describe what the code does — only when the *why* is non-obvious.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be kind.

## Security

Don't open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).
