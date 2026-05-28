# SHOW_SCORES kill switch

Emergency operator runbook for the scoring layer gate.

## How it works

`scoresEnabled()` returns `true` **only** when `SHOW_SCORES` is explicitly set to the string
`"true"`. Absent, unset, or any other value → scores hidden (**fail-closed** default).

The sentinel file provides a belt-and-suspenders force-off:
- `SHOW_SCORES=true` + no sentinel file → scores **on**
- `SHOW_SCORES` absent/other → scores **off** (default)
- `SCORES_DISABLED` file exists → scores **off** (overrides even `SHOW_SCORES=true`)

Both signals are evaluated on every call — not memoized. A Railway env var change or
`touch /data/SCORES_DISABLED` takes effect on the next request, no redeploy required.

---

## When to flip

- Legal has flagged the scores/grades as a liability.
- You have received a cease-and-desist or legal hold related to the scoring methodology.
- A scoring bug is causing materially wrong grades and you need time to fix it.
- You want to enable scores for the first time after development is complete.

Flipping does **not** take the site down. The directory, company pages, privacy policy text,
and evidence cards all remain accessible. Only grades, scores, and the rubric page are affected.

---

## What goes away when scores are off

| Feature | Hidden |
|---------|--------|
| A–F grade badge | Yes |
| Numeric score | Yes |
| Grade breakdown panel | Yes |
| /rubric route | Yes (returns 404) |
| Label SVG/HTML downloads | Replaced by neutral label (no grade) |
| Directory sort-by-grade | Yes (column hidden) |
| API `grade` field | Omitted from responses |

## What stays when scores are off

- All company pages and privacy policy evidence
- Directory search and filter by data practices
- Privacy Panel label visual (without the grade section)
- All API endpoints (label endpoint returns neutral label)
- About, label explainer, and privacy policy pages

---

## How to enable scores (first launch or re-enable)

### Via Railway dashboard (recommended)

1. Open Railway → your project → the web service.
2. Go to **Variables**.
3. Add or update: `SHOW_SCORES` = `true`
4. Click **Deploy** — takes effect on the next request after deploy.

### Via sentinel file removal

If you previously created a `SCORES_DISABLED` file, remove it:

```bash
rm /data/SCORES_DISABLED
```

---

## How to disable scores (kill switch)

### Via Railway dashboard (recommended)

1. Open Railway → your project → the web service.
2. Go to **Variables**.
3. Delete `SHOW_SCORES` entirely (or set it to any value other than `"true"`).
4. Click **Deploy** — takes effect on the next request.

### Via sentinel file (no-redeploy, instant)

If Railway is unavailable or you need an immediate flip without waiting for a deploy:

```bash
# SSH into the Railway shell, or use a one-off container command:
touch /data/SCORES_DISABLED
```

The app checks for this file at call time. Effect is immediate on the next request.

To re-enable:

```bash
rm /data/SCORES_DISABLED
```

The sentinel file path is resolved from `DATABASE_URL`. If `DATABASE_URL=/data/privacypanel.db`,
the sentinel is `/data/SCORES_DISABLED`.

---

## When to use which mechanism

| Situation | Use |
|-----------|-----|
| First enabling scores | Railway dashboard `SHOW_SCORES=true` → deploy |
| Routine planned shutdown | Railway dashboard → remove/change var → deploy |
| Incident, Railway dashboard responsive | Railway dashboard → remove/change var → deploy |
| Incident, Railway dashboard slow/down | `railway shell` → `touch /data/SCORES_DISABLED` |
| Belt and suspenders | Do both |

---

## OR'd failure mode

Either signal alone is sufficient to disable scores:

- `SHOW_SCORES` absent → scores off (fail-closed default)
- `SHOW_SCORES=false` (or any value ≠ `"true"`) → scores off
- `/data/SCORES_DISABLED` file exists → scores off (overrides even `SHOW_SCORES=true`)
- Both set → scores off
- `SHOW_SCORES=true` + no sentinel → scores **on**

---

## Verifying the kill switch took effect

After flipping `SHOW_SCORES` or touching/removing `SCORES_DISABLED`, within **60 seconds** the
following should ALL be true. Run through this checklist in a **private/incognito window** before
declaring the operation complete.

### Browser walk-through (when scores are OFF)

- [ ] `/` — no grade scale block, no score text in hero, no score on company cards
- [ ] `/about` — no rubric mentions, no "A–F" / "0–100" copy
- [ ] `/label` — no "Label vs. Score" callout
- [ ] `/privacy` — no own-score self-disclosure; dogfooded label still renders
- [ ] `/directory` — no Score column, no grade badges, sorts work without grade option
- [ ] `/company/airbnb` — left column shows label; right Privacy Score column **GONE**; Source Evidence below
- [ ] `/company/privacy-panel` — same as above for our own entry
- [ ] `/rubric` — 404 page
- [ ] `/compare?slugs=signal,airbnb` — labels render without grades

### API checks (curl from terminal)

```bash
# Replace localhost:3000 with the live domain when checking production

# /rubric → 404 when off
curl -i http://localhost:3000/api/v1/rubric

# /company → no "grade" key when off
curl http://localhost:3000/api/v1/company/airbnb | jq 'has("grade")'
# expected: false

# /label → no grade header in SVG when off
curl http://localhost:3000/api/v1/company/airbnb/label | grep -ci 'grade\|rubric'
# expected: 0

# /label → Cache-Control: no-store when off
curl -I http://localhost:3000/api/v1/company/airbnb/label | grep Cache-Control
# expected: no-store

# /search → no "grade" key in results when off
curl "http://localhost:3000/api/v1/search?q=airbnb" | jq '.results[0] | has("grade")'
# expected: false
```

### When scores are ON (re-enable verification)

- [ ] Grade badges appear on home page company cards
- [ ] Directory shows Score column and allows sort-by-grade
- [ ] `/company/airbnb` shows right column with grade badge + breakdown
- [ ] `/rubric` returns 200 with full rubric JSON
- [ ] `curl http://localhost:3000/api/v1/company/airbnb | jq 'has("grade")'` → `true`

---

## No user-visible notice

When scores are off, the site is **silently** neutral. There is no "scores temporarily
unavailable" banner. Drawing attention to the kill switch defeats its purpose.

## DB columns are unchanged

`score`, `letter`, `grade_label`, `grade_color`, `rubric_version`, and `breakdown_json`
columns remain populated. The scoring engine code remains. Only the *rendering* of those
columns is gated. The switch is fully reversible at any time.
