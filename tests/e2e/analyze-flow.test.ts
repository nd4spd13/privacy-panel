/**
 * E2E tests for the analyze flow.
 *
 * These tests verify the full UI flow from submitting a URL to seeing a
 * company profile, as well as core page rendering.
 *
 * Prerequisites:
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 *
 * Run: npx playwright test
 */

import { test, expect } from "@playwright/test";

// ── Home page ──────────────────────────────────────────────────────────────────

test("home page loads and shows hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Privacy labels for");
  await expect(page.getByPlaceholder(/search a company/i)).toBeVisible();
});

test("home page shows grade scale", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("The grading scale")).toBeVisible();
  for (const letter of ["A", "B", "C", "D", "F"]) {
    await expect(page.locator(`text=${letter}`).first()).toBeVisible();
  }
});

// ── Directory page ─────────────────────────────────────────────────────────────

test("directory page loads", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.getByRole("heading", { name: "Company Directory" })).toBeVisible();
});

test("directory search filters results", async ({ page }) => {
  await page.goto("/directory");
  const searchInput = page.getByPlaceholder("Filter companies…");
  await searchInput.fill("Signal");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=Signal/);
});

test("directory sorting works", async ({ page }) => {
  await page.goto("/directory");
  await page.getByText("Company").click();
  await expect(page).toHaveURL(/sort=name/);
});

// ── Company profile ────────────────────────────────────────────────────────────

test("company profile loads for seeded company", async ({ page }) => {
  // This test requires Signal to be seeded in the database
  // Run: npx tsx cli/index.ts analyze https://signal.org/legal/ --company Signal
  await page.goto("/directory");
  const signalLink = page.getByRole("link", { name: /signal/i }).first();

  // Only run if Signal is present in the DB
  const count = await signalLink.count();
  if (count === 0) {
    test.skip(true, "Signal not seeded in DB — run: npx tsx cli/index.ts analyze https://signal.org/legal/ --company Signal");
    return;
  }

  await signalLink.click();
  await expect(page).toHaveURL(/\/company\/signal/);
  await expect(page.getByRole("heading", { name: "Signal" })).toBeVisible();
  await expect(page.getByText("Score Breakdown")).toBeVisible();
  await expect(page.getByText("Source Evidence")).toBeVisible();
});

// ── Compare page ───────────────────────────────────────────────────────────────

test("compare page loads with empty state", async ({ page }) => {
  await page.goto("/compare");
  await expect(page.getByRole("heading", { name: "Compare Companies" })).toBeVisible();
  await expect(page.getByText("Add 2 more to compare")).toBeVisible();
});

test("compare page with pre-filled slugs in URL", async ({ page }) => {
  await page.goto("/compare?slugs=signal");
  await expect(page.getByRole("heading", { name: "Compare Companies" })).toBeVisible();
});

// ── Rubric page ────────────────────────────────────────────────────────────────

test("rubric page loads with simulator", async ({ page }) => {
  await page.goto("/rubric");
  await expect(page.getByRole("heading", { name: "Scoring Rubric v1" })).toBeVisible();
  await expect(page.getByText("Score Simulator")).toBeVisible();
  await expect(page.getByText("Live Score")).toBeVisible();
});

test("rubric simulator updates score when checkbox toggled", async ({ page }) => {
  await page.goto("/rubric");
  // Initial score should be 100
  await expect(page.getByText("100")).toBeVisible();

  // Toggle "Data sold to third parties" (-25 points)
  const checkbox = page.getByLabel("Data sold to third parties").or(
    page.locator("label").filter({ hasText: "Data sold to third parties" }).locator("input[type=checkbox]")
  );
  await checkbox.check();

  // Score should now show 75
  await expect(page.locator("text=75").first()).toBeVisible();
});

// ── About page ─────────────────────────────────────────────────────────────────

test("about page loads with all sections", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About Privacy Panel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mission" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Methodology" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Legal disclaimers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open source" })).toBeVisible();
});

// ── API routes ─────────────────────────────────────────────────────────────────

test("GET /api/v1/rubric returns rubric JSON", async ({ request }) => {
  const res = await request.get("/api/v1/rubric");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("version");
  expect(body).toHaveProperty("deductions");
  expect(body).toHaveProperty("grades");
});

test("GET /api/v1/search returns results", async ({ request }) => {
  const res = await request.get("/api/v1/search?q=signal");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("results");
  expect(Array.isArray(body.results)).toBe(true);
});

test("POST /api/v1/analyze rejects missing URL", async ({ request }) => {
  const res = await request.post("/api/v1/analyze", {
    data: { notAUrl: "foo" },
  });
  expect(res.status()).toBe(400);
});

test("GET /api/v1/company/:slug returns 404 for unknown slug", async ({ request }) => {
  const res = await request.get("/api/v1/company/this-company-does-not-exist-xyz");
  expect(res.status()).toBe(404);
});

test("GET /api/v1/jobs/:id returns 404 for unknown job", async ({ request }) => {
  const res = await request.get("/api/v1/jobs/00000000-0000-0000-0000-000000000000");
  expect(res.status()).toBe(404);
});

// ── Static files ───────────────────────────────────────────────────────────────

test("GET /rubric/v1.yaml returns YAML", async ({ request }) => {
  const res = await request.get("/rubric/v1.yaml");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("soldToThirdParties");
});

test("GET /schema/v1.json returns JSON Schema", async ({ request }) => {
  const res = await request.get("/schema/v1.json");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body["$schema"]).toContain("json-schema.org");
  expect(body.title).toBe("Privacy Panel");
});
