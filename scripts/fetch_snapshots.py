#!/usr/bin/env python3
"""
fetch_snapshots.py — Privacy Facts Label: live policy snapshot fetcher
=======================================================================
Run this locally (outside the Cowork VM) to fetch, PDF, and hash the
privacy policies for all 100 companies in companies.json.

REQUIREMENTS
    pip install requests html2text reportlab          # always needed
    pip install playwright && playwright install chromium  # for --playwright

USAGE
    # Fetch all companies missing a snapshot (requests only):
    python3 fetch_snapshots.py

    # Same, but fall back to headless Chrome for JS-heavy pages:
    python3 fetch_snapshots.py --playwright

    # Re-fetch a single slug (overwrites existing snapshot):
    python3 fetch_snapshots.py --slug meta --playwright --force

    # Preview what would be fetched without touching any files:
    python3 fetch_snapshots.py --dry-run

    # Limit to N companies (useful for a quick smoke-test):
    python3 fetch_snapshots.py --limit 5 --playwright

    # Slower, more polite crawl:
    python3 fetch_snapshots.py --playwright --delay 4

    # Register a PDF you saved manually (e.g. via browser Print → Save as PDF):
    #   1. Save the PDF to:  policies/snapshots/meta-2026-03.pdf
    #   2. Run:
    python3 fetch_snapshots.py --slug meta --use-local-pdf

    # Register ALL manually-placed PDFs in snapshots/ at once:
    python3 fetch_snapshots.py --use-local-pdf

HOW FETCHING WORKS
    1. requests (fast, no overhead) — tried first for every company.
    2. Playwright (headless Chromium) — used automatically when:
         a. --playwright is set AND requests returned < MIN_WORD_COUNT words, OR
         b. the slug is in PLAYWRIGHT_FIRST (known JS-heavy sites) and
            --playwright is set.
       The fetch_method field in provenance records which path was taken.
    3. --use-local-pdf — skips all fetching. Reads a pre-placed PDF from
       policies/snapshots/<slug>-YYYY-MM.pdf, computes its SHA-256, and
       writes the result to provenance. Useful for sites that require a
       logged-in session (Meta, LinkedIn) where you save the PDF manually
       via your browser's Print → Save as PDF.

OUTPUT
    policies/snapshots/<slug>-YYYY-MM.pdf   — one PDF per company
    policy-provenance.json                  — updated with snapshot_path,
                                              snapshot_hash, snapshot_size_bytes,
                                              fetch_method

RESUME SAFETY
    Already-captured slugs are skipped automatically. Safe to re-run after
    a partial failure — it picks up where it left off.
"""

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------

def _check(package: str, import_as: Optional[str] = None) -> bool:
    """Return True if importable, False otherwise."""
    import importlib
    try:
        importlib.import_module(import_as or package)
        return True
    except ImportError:
        return False


def _require(package: str, import_as: Optional[str] = None) -> None:
    if not _check(package, import_as):
        sys.exit(
            f"\nMissing dependency: {package}\n"
            f"  Fix: pip install {package}\n"
        )


_require("requests")
_require("html2text")
_require("reportlab")

import html2text
import requests
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HERE            = Path(__file__).parent
COMPANIES_FILE  = HERE / "companies.json"
PROVENANCE_FILE = HERE / "policy-provenance.json"
SNAPSHOTS_DIR   = HERE / "policies" / "snapshots"
FETCH_DATE      = datetime.now(timezone.utc).strftime("%Y-%m-%d")
FETCH_MONTH     = datetime.now(timezone.utc).strftime("%Y-%m")
MIN_WORD_COUNT  = 150   # fewer words → treat plain fetch as failed

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Slugs that are known to JS-render their policy pages or block plain requests.
# When --playwright is active these go straight to Playwright, skipping requests.
PLAYWRIGHT_FIRST = {
    "meta", "instagram", "whatsapp",
    "amazon", "amazon-alexa",
    "linkedin",
    "coinbase", "robinhood",
    "openai",
    "disney-plus",
    "notion",
}


# ---------------------------------------------------------------------------
# HTML → text converter (shared instance)
# ---------------------------------------------------------------------------

_h2t = html2text.HTML2Text()
_h2t.ignore_links    = True
_h2t.ignore_images   = True
_h2t.ignore_emphasis = False
_h2t.body_width      = 0   # no wrapping — let the PDF handle it


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------

def fetch_with_requests(url: str, timeout: int = 20) -> tuple[str, str]:
    """
    Plain HTTP fetch. Returns (plain_text, final_url).
    Raises requests.RequestException on any HTTP error.
    """
    resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
    resp.raise_for_status()
    ct = resp.headers.get("content-type", "")
    text = _h2t.handle(resp.text) if "html" in ct else resp.text
    return text.strip(), resp.url


def fetch_with_playwright(url: str, timeout: int = 30) -> tuple[str, str]:
    """
    Headless Chromium fetch via Playwright. Handles JS-rendered pages,
    cookie banners, and lazy-loaded content. Returns (plain_text, final_url).
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    except ImportError:
        raise RuntimeError(
            "Playwright not installed.\n"
            "  Fix: pip install playwright && playwright install chromium"
        )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="en-US",
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.new_page()

        # Block images/fonts/media to speed up load
        page.route(
            "**/*",
            lambda route: route.abort()
            if route.request.resource_type in ("image", "media", "font")
            else route.continue_(),
        )

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=timeout * 1000)
            # Give JS a moment to render content
            page.wait_for_timeout(2500)
            # Scroll to trigger any lazy-loaded sections
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1000)
        except PWTimeout:
            # Page loaded partially — still try to grab what's there
            pass

        final_url = page.url
        html = page.content()
        browser.close()

    text = _h2t.handle(html).strip()
    return text, final_url


# ---------------------------------------------------------------------------
# PDF renderer
# ---------------------------------------------------------------------------

def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render_pdf(
    slug: str,
    company: str,
    app_or_service: str,
    policy_url: str,
    fetch_date: str,
    fetch_method: str,
    text: str,
    out_dir: Path,
) -> dict:
    """
    Render *text* into a stamped PDF snapshot.
    Returns {"path": relative_str, "hash": sha256_hex, "size_bytes": int}.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    filename  = f"{slug}-{FETCH_MONTH}.pdf"
    out_path  = out_dir / filename

    doc = SimpleDocTemplate(
        str(out_path), pagesize=LETTER,
        rightMargin=0.75 * inch, leftMargin=0.75 * inch,
        topMargin=0.75 * inch,   bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()

    title_sty = ParagraphStyle(
        "PFTitle", parent=styles["Heading1"],
        fontSize=15, spaceAfter=5, textColor=colors.HexColor("#1a1a2e"),
    )
    meta_sty = ParagraphStyle(
        "PFMeta", parent=styles["Normal"],
        fontSize=8.5, textColor=colors.HexColor("#555555"), spaceAfter=3,
    )
    body_sty = ParagraphStyle(
        "PFBody", parent=styles["Normal"],
        fontSize=8.5, leading=13, spaceAfter=5, wordWrap="CJK",
    )
    wm_sty = ParagraphStyle(
        "PFWatermark", parent=styles["Normal"],
        fontSize=7.5, textColor=colors.HexColor("#aaaaaa"),
        alignment=TA_CENTER, spaceBefore=14,
    )

    story = [
        Paragraph("Privacy Policy Snapshot", title_sty),
        Paragraph(f"<b>Company:</b> {_esc(company)} — {_esc(app_or_service)}", meta_sty),
        Paragraph(f"<b>Policy URL:</b> {_esc(policy_url)}", meta_sty),
        Paragraph(f"<b>Snapshot date:</b> {fetch_date}", meta_sty),
        Paragraph(f"<b>Fetch method:</b> {fetch_method}", meta_sty),
        Paragraph(f"<b>Slug (FK → companies.json):</b> {slug}", meta_sty),
        HRFlowable(width="100%", thickness=0.75,
                   color=colors.HexColor("#cccccc"), spaceAfter=10),
    ]

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            story.append(Spacer(1, 3))
        elif len(line) < 90 and (line.isupper() or line.endswith(":")):
            story.append(Paragraph(f"<b>{_esc(line)}</b>", body_sty))
        else:
            story.append(Paragraph(_esc(line), body_sty))

    story += [
        Spacer(1, 18),
        Paragraph(
            f"Captured by Privacy Facts Label · {fetch_date} · privacyfactslabel.org",
            wm_sty,
        ),
    ]

    doc.build(story)

    raw = out_path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    return {"path": f"policies/snapshots/{filename}", "hash": sha, "size_bytes": len(raw)}


# ---------------------------------------------------------------------------
# Provenance helpers
# ---------------------------------------------------------------------------

def load_provenance(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {"records": []}


def save_provenance(data: dict, path: Path) -> None:
    path.write_text(json.dumps(data, indent=2))


def get_record(provenance: dict, slug: str) -> Optional[dict]:
    for r in provenance.get("records", []):
        if r.get("company_slug") == slug:
            return r
    return None


def patch_record(provenance: dict, slug: str, **kwargs) -> None:
    for r in provenance.get("records", []):
        if r.get("company_slug") == slug:
            r.update(kwargs)
            return
    provenance.setdefault("records", []).append({"company_slug": slug, **kwargs})


# ---------------------------------------------------------------------------
# Local-PDF registration
# ---------------------------------------------------------------------------

def register_local_pdf(
    slug: str,
    company: str,
    app_or_service: str,
    policy_url: str,
    provenance: dict,
    force: bool = False,
) -> dict:
    """
    Hash a manually-placed PDF and update provenance.
    Returns a result dict with status, path, hash, size_bytes.
    """
    expected = SNAPSHOTS_DIR / f"{slug}-{FETCH_MONTH}.pdf"

    # Also accept a PDF from a previous month if the current month isn't there
    if not expected.exists():
        candidates = sorted(SNAPSHOTS_DIR.glob(f"{slug}-*.pdf"), reverse=True)
        if candidates:
            expected = candidates[0]

    if not expected.exists():
        return {
            "status": "missing",
            "msg": (
                f"No PDF found. Place the file at:\n"
                f"  {SNAPSHOTS_DIR / f'{slug}-{FETCH_MONTH}.pdf'}\n"
                f"then re-run with --slug {slug} --use-local-pdf"
            ),
        }

    rec = get_record(provenance, slug)
    already_done = rec and rec.get("snapshot_hash") and expected.exists()
    if already_done and not force:
        return {"status": "skip", "msg": "already registered (use --force to re-hash)"}

    raw  = expected.read_bytes()
    sha  = hashlib.sha256(raw).hexdigest()
    rel  = f"policies/snapshots/{expected.name}"

    patch_record(provenance, slug,
                 policy_url=policy_url,
                 snapshot_path=rel,
                 snapshot_hash=sha,
                 snapshot_size_bytes=len(raw),
                 source_method="live_fetch",
                 fetch_method="manual_pdf",
                 snapshot_note=f"Manually saved PDF registered {FETCH_DATE}",
                 recorded_at=datetime.now(timezone.utc).isoformat())

    return {"status": "ok", "path": rel, "hash": sha, "size_bytes": len(raw)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Fetch privacy policy snapshots for all companies.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--slug",          help="Only process this one slug.")
    p.add_argument("--playwright",    action="store_true",
                   help="Enable Playwright fallback for JS-heavy pages. "
                        "Requires: pip install playwright && playwright install chromium")
    p.add_argument("--use-local-pdf", action="store_true",
                   help="Skip fetching entirely. Hash and register a PDF you "
                        "already placed at policies/snapshots/<slug>-YYYY-MM.pdf. "
                        "Use with --slug for one company, or omit --slug to scan "
                        "all unregistered PDFs in the snapshots directory.")
    p.add_argument("--dry-run",       action="store_true",
                   help="Print what would be fetched; create no files.")
    p.add_argument("--limit",         type=int, default=0,
                   help="Stop after N successful fetches (0 = no limit).")
    p.add_argument("--delay",         type=float, default=2.0,
                   help="Seconds to wait between requests (default 2).")
    p.add_argument("--force",         action="store_true",
                   help="Re-fetch / re-register even if a snapshot already exists.")
    p.add_argument("--timeout",       type=int, default=20,
                   help="HTTP timeout in seconds for requests (default 20). "
                        "Playwright uses 2× this value.")
    return p.parse_args()


def _fetch(slug: str, url: str, use_playwright: bool,
           timeout: int) -> tuple[str, str, str]:
    """
    Fetch policy text using the best available method.
    Returns (text, final_url, fetch_method_label).

    Strategy:
      - If slug is in PLAYWRIGHT_FIRST and use_playwright → go straight to Playwright.
      - Otherwise try requests first; fall back to Playwright if content is thin.
    """
    go_playwright_first = use_playwright and slug in PLAYWRIGHT_FIRST

    if not go_playwright_first:
        try:
            text, final_url = fetch_with_requests(url, timeout=timeout)
            if len(text.split()) >= MIN_WORD_COUNT:
                return text, final_url, "requests"
            # Too thin — fall back if Playwright is available
            if not use_playwright:
                return text, final_url, "requests"   # caller will handle thin result
            print("thin→pw  ", end="", flush=True)
        except Exception:
            if not use_playwright:
                raise
            print("err→pw  ", end="", flush=True)

    # Playwright path
    text, final_url = fetch_with_playwright(url, timeout=timeout * 2)
    return text, final_url, "playwright"


def main() -> None:
    args = parse_args()

    # Validate Playwright availability early when requested
    if args.playwright and not args.dry_run:
        if not _check("playwright"):
            sys.exit(
                "\nPlaywright is not installed.\n"
                "  Fix: pip install playwright && playwright install chromium\n"
            )

    if not COMPANIES_FILE.exists():
        sys.exit(f"companies.json not found at {COMPANIES_FILE}")

    companies  = json.loads(COMPANIES_FILE.read_text())
    provenance = load_provenance(PROVENANCE_FILE)

    if args.slug:
        companies = [c for c in companies if c["slug"] == args.slug]
        if not companies:
            sys.exit(f"Slug '{args.slug}' not found in companies.json")

    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------------
    # --use-local-pdf mode: hash pre-placed PDFs, skip all network fetching
    # -----------------------------------------------------------------------
    if args.use_local_pdf:
        # Build a lookup of slug → company metadata
        co_by_slug = {c["slug"]: c for c in json.loads(COMPANIES_FILE.read_text())}

        # Determine which slugs to process
        if args.slug:
            targets = [args.slug]
        else:
            # Scan snapshots dir for any PDF whose slug isn't yet registered
            # (or needs --force re-registration)
            registered = {
                r["company_slug"]
                for r in provenance.get("records", [])
                if r.get("snapshot_hash") and not args.force
            }
            targets = []
            for pdf in sorted(SNAPSHOTS_DIR.glob("*.pdf")):
                # stem = "cash-app-2026-03" → rsplit 2 → ["cash-app","2026","03"]
                slug = "-".join(pdf.stem.rsplit("-", 2)[:-2])  # strip -YYYY-MM
                if slug not in registered:
                    targets.append(slug)
            if not targets:
                print("Nothing to register — all PDFs in snapshots/ are already recorded.")
                print("Use --force to re-hash existing entries.")
                return

        print(f"\n--use-local-pdf mode  ({len(targets)} PDF(s) to register)")
        print(f"{'─' * 55}")
        registered_count = skipped = failed = 0
        for slug in targets:
            co = co_by_slug.get(slug)
            if not co:
                print(f"  {slug:32s} SKIP  (not in companies.json)")
                skipped += 1
                continue
            if args.dry_run:
                expected = SNAPSHOTS_DIR / f"{slug}-{FETCH_MONTH}.pdf"
                print(f"  {slug:32s} WOULD register  {expected}")
                registered_count += 1
                continue
            result = register_local_pdf(
                slug=slug,
                company=co["company"],
                app_or_service=co["app_or_service"],
                policy_url=co["policy_url"],
                provenance=provenance,
                force=args.force,
            )
            if result["status"] == "ok":
                kb = result["size_bytes"] / 1024
                print(f"  {slug:32s} OK    {result['hash'][:12]}…  {kb:.0f} KB")
                registered_count += 1
                save_provenance(provenance, PROVENANCE_FILE)
            elif result["status"] == "skip":
                print(f"  {slug:32s} SKIP  {result['msg']}")
                skipped += 1
            else:
                print(f"  {slug:32s} MISS  {result['msg']}")
                failed += 1

        print(f"\n{'─' * 55}")
        print(f"Done.  registered={registered_count}  skipped={skipped}  missing={failed}")
        print(f"Provenance: {PROVENANCE_FILE}")
        return

    fetched = skipped = failed = 0
    total   = len(companies)
    pw_note = " + Playwright fallback" if args.playwright else ""

    print(f"\n{'DRY RUN — ' if args.dry_run else ''}Privacy Facts Label snapshot fetcher")
    print(f"{'─' * 60}")
    print(f"Companies to process  : {total}")
    print(f"Fetch mode            : requests{pw_note}")
    print(f"Snapshots directory   : {SNAPSHOTS_DIR}")
    print(f"Delay between requests: {args.delay}s")
    if args.playwright:
        first_slugs = sorted(PLAYWRIGHT_FIRST)
        print(f"Playwright-first slugs: {', '.join(first_slugs)}")
    print(f"{'─' * 60}\n")

    for i, co in enumerate(companies, 1):
        slug         = co["slug"]
        company      = co["company"]
        app          = co["app_or_service"]
        url          = co["policy_url"]
        expected_pdf = SNAPSHOTS_DIR / f"{slug}-{FETCH_MONTH}.pdf"

        # Skip if already captured (unless --force)
        rec          = get_record(provenance, slug)
        already_done = rec and rec.get("snapshot_hash") and expected_pdf.exists()
        if already_done and not args.force:
            print(f"[{i:3}/{total}]  SKIP    {slug:32s}(snapshot exists)")
            skipped += 1
            continue

        if args.dry_run:
            mode = "PW-first" if (args.playwright and slug in PLAYWRIGHT_FIRST) else "requests"
            print(f"[{i:3}/{total}]  WOULD   {slug:32s}{url}  [{mode}]")
            fetched += 1
            continue

        # --- Fetch ---
        print(f"[{i:3}/{total}]  FETCH   {slug:32s}", end="", flush=True)
        try:
            text, final_url, method = _fetch(slug, url, args.playwright, args.timeout)
        except Exception as exc:
            print(f"FAIL  ({type(exc).__name__}: {exc})")
            patch_record(provenance, slug,
                         snapshot_path=None, snapshot_hash=None, snapshot_size_bytes=None,
                         fetch_method=None,
                         snapshot_note=f"Fetch failed: {type(exc).__name__}: {exc}",
                         recorded_at=datetime.now(timezone.utc).isoformat())
            save_provenance(provenance, PROVENANCE_FILE)
            failed += 1
            if args.delay:
                time.sleep(args.delay)
            continue

        word_count = len(text.split())
        if word_count < MIN_WORD_COUNT:
            print(f"THIN    ({word_count} words — login wall or heavy JS; try --playwright)")
            patch_record(provenance, slug,
                         snapshot_path=None, snapshot_hash=None, snapshot_size_bytes=None,
                         fetch_method=method,
                         snapshot_note=(
                             f"Returned only {word_count} words via {method}. "
                             "Likely requires login or unsupported JS rendering."
                         ),
                         recorded_at=datetime.now(timezone.utc).isoformat())
            save_provenance(provenance, PROVENANCE_FILE)
            failed += 1
            if args.delay:
                time.sleep(args.delay)
            continue

        # --- Render PDF ---
        try:
            result = render_pdf(
                slug=slug, company=company, app_or_service=app,
                policy_url=final_url, fetch_date=FETCH_DATE,
                fetch_method=method, text=text, out_dir=SNAPSHOTS_DIR,
            )
        except Exception as exc:
            print(f"PDF ERR  ({exc})")
            failed += 1
            if args.delay:
                time.sleep(args.delay)
            continue

        # --- Update provenance ---
        patch_record(provenance, slug,
                     policy_url=final_url,
                     snapshot_path=result["path"],
                     snapshot_hash=result["hash"],
                     snapshot_size_bytes=result["size_bytes"],
                     source_method="live_fetch",
                     fetch_method=method,
                     snapshot_note=f"Live PDF snapshot — {method} — {FETCH_DATE}",
                     recorded_at=datetime.now(timezone.utc).isoformat())
        save_provenance(provenance, PROVENANCE_FILE)

        kb = result["size_bytes"] / 1024
        print(f"OK  [{method:18s}]  {result['hash'][:12]}…  {kb:.0f} KB  ({word_count:,} words)")
        fetched += 1

        if args.limit and fetched >= args.limit:
            print(f"\nReached --limit {args.limit}. Stopping.")
            break

        if args.delay and i < total:
            time.sleep(args.delay)

    # --- Summary ---
    print(f"\n{'─' * 60}")
    print(f"Done.   fetched={fetched}   skipped={skipped}   failed={failed}")
    print(f"Provenance: {PROVENANCE_FILE}")
    if failed:
        print()
        print("Tips for failed companies:")
        print("  • Add --playwright to handle JS-rendered pages")
        print("  • Add --delay 5 for sites that throttle aggressively")
        print("  • Use --slug <name> --force to retry one company")
        print("  • A few sites (e.g. Meta, LinkedIn) may need a logged-in")
        print("    session — those can't be automated without credentials")


if __name__ == "__main__":
    main()
