# SHOW_SCORES kill switch

Emergency operator runbook for hiding the entire scoring layer without a redeploy.

## When to flip

- Legal has flagged the scores/grades as a liability.
- You have received a cease-and-desist or legal hold related to the scoring methodology.
- A scoring bug is causing materially wrong grades and you need time to fix it.

Flipping does **not** take the site down. The directory, company pages, privacy policy text, and evidence cards all remain accessible. Only grades, scores, and the rubric page are hidden.

## What goes away when scores are off

| Feature | Hidden |
|---------|--------|
| A–F grade badge | Yes |
| Numeric score | Yes |
| Grade breakdown panel | Yes |
| /rubric route | Yes (returns 404) |
| Label SVG/HTML downloads | Replaced by neutral label (no grade) |
| Directory sort-by-grade | Yes (column hidden) |

## What stays when scores are off

- All company pages and privacy policy evidence
- Directory search and filter by data practices
- Privacy Panel label visual (without the grade section)
- All API endpoints (label endpoint returns neutral label)

---

## How to flip via Railway dashboard (recommended)

1. Open Railway → your project → the web service.
2. Go to **Variables**.
3. Add or update: `SHOW_SCORES` = `false`
4. Click **Deploy** — the new env var takes effect on the next request, no container rebuild needed.

To re-enable: set `SHOW_SCORES` = `true` (or delete the variable entirely) and redeploy.

## How to flip via sentinel file (no-redeploy, instant)

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

The sentinel file path is resolved from `DATABASE_URL`. If `DATABASE_URL=/data/privacyfacts.db`, the sentinel is `/data/SCORES_DISABLED`.

## OR'd failure mode

Either signal alone is sufficient to disable scores:

- `SHOW_SCORES=false` → scores off
- `/data/SCORES_DISABLED` file exists → scores off
- Both set → scores off
- Neither set → scores on (default)

## Post-flip verification checklist

After flipping, verify in a private/incognito window:

- [ ] Home page: no grade badges on company cards
- [ ] Directory: no Score column, no grade shown
- [ ] Company page `/company/airbnb`: no grade badge, no breakdown panel
- [ ] Company page evidence section: still visible
- [ ] `/rubric`: returns 404
- [ ] API `/api/v1/company/airbnb/label?format=svg`: renders neutral label (no grade section)
- [ ] API `/api/v1/company/airbnb/score`: returns `{"error":"scores disabled"}` with status 404

## Rollback

To restore scores:

1. Delete `SHOW_SCORES` env var from Railway (or set it to `true`).
2. Remove `/data/SCORES_DISABLED` if present.
3. Trigger a redeploy if you changed the env var.
4. Verify grade badges reappear on the home page.
