# Security Policy

## Scope

This policy covers the Privacy Panel web application and CLI tool in this repository.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **security@privacypanel.org** with:
- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept code or screenshots are helpful)
- Any suggested mitigations you have in mind

You can expect an acknowledgement within 48 hours and a resolution timeline within 14 days for critical issues.

## What we consider in scope

- Authentication or authorization bypasses in the web API
- Server-side request forgery (SSRF) via URL inputs
- SQL injection or database access vulnerabilities
- Exposure of environment variables or API keys
- Cross-site scripting (XSS) in rendered labels or search results
- Rate-limiting bypasses that could enable abuse of the Claude API

## What is intentionally public

The following are **not** vulnerabilities:
- The scoring rubric and its weights (intentionally transparent)
- The system prompts used for extraction (`src/core/extraction/prompts.ts`) — these are deliberately open-source
- The Privacy Panel JSON schema (`public/schema/v1.json`)
- Company scores and extraction data (summaries of public privacy policies)

## Security design notes

- **API key isolation:** `ANTHROPIC_API_KEY` is a server-only environment variable. It has no `NEXT_PUBLIC_` prefix and is guarded by `import "server-only"` in `src/lib/anthropic.ts`. It cannot be accessed from client-side JavaScript.
- **No user-triggered extraction:** The `/api/v1/analyze` endpoint does not exist in this build. All analyses are pre-loaded by administrators using the CLI.
- **Content Security Policy:** The app sets `connect-src 'self'` to prevent any client-side JavaScript from making outbound fetch calls to external APIs.
- **Rate limiting:** All API routes enforce a sliding-window rate limit (100 req/hr per IP by default; the `/api/v1/analyze` endpoint, if ever re-enabled, enforces 10 req/hr).
- **SQL injection:** All database queries use `better-sqlite3` prepared statements with bound parameters. No raw string interpolation into SQL.

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` branch | ✅ Yes |
| Older tags | ❌ No — please update |
