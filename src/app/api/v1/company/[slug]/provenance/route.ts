import { NextRequest, NextResponse } from "next/server";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestPolicyForCompany } from "@/db/policies";
import { getLatestExtractionForCompany } from "@/db/extractions";

/**
 * GET /api/v1/company/[slug]/provenance
 *
 * Returns machine-readable provenance for a company's latest analysis.
 * DB-derived, public fields only. Never exposes snapshot_path, model,
 * tokens, or other pipeline internals.
 *
 * Replaces the removed static public/data/policy-provenance.json (CRS-186)
 * with a per-company, derived, non-drifting source.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const company = getCompanyBySlug(slug);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const extraction = getLatestExtractionForCompany(company.id);
  const policy = getLatestPolicyForCompany(company.id);

  if (!extraction || !policy) {
    return NextResponse.json({ error: "No analysis found" }, { status: 404 });
  }

  const body = {
    slug: company.slug,
    company_name: company.name,
    // Analysis metadata
    analyzed_at: extraction.created_at,
    // Policy source
    policy_url: policy.url,
    policy_fetched_at: policy.fetched_at,
    // Content integrity
    normalized_hash: policy.normalized_hash ?? null,
    normalizer: policy.normalizer ?? null,
    // Wayback archive
    archive_url: policy.archive_url ?? null,
    archive_captured_at: policy.archive_captured_at ?? null,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
