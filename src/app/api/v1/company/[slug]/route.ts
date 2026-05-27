import { NextRequest, NextResponse } from "next/server";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidPublicSlug } from "@/lib/slug";
import { scoresEnabled } from "@/lib/flags";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(req);
  const { allowed, remaining, resetAt } = checkRateLimit(ip);
  const rlHeaders = {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };

  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rlHeaders });
  }

  const { slug } = await params;
  if (!isValidPublicSlug(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400, headers: rlHeaders });
  }

  const company = getCompanyBySlug(slug);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404, headers: rlHeaders });
  }

  const extraction = getLatestExtractionForCompany(company.id);
  if (!extraction) {
    return NextResponse.json(
      { error: "No analysis available for this company yet" },
      { status: 404, headers: rlHeaders }
    );
  }

  const payload: Record<string, unknown> = {
    company: {
      slug: company.slug,
      name: company.name,
      domain: company.domain,
    },
    facts: extraction.facts,
    meta: {
      extractionId: extraction.id,
      model: extraction.model,
      inputTokens: extraction.input_tokens,
      outputTokens: extraction.output_tokens,
      latencyMs: extraction.latency_ms,
      analyzedAt: extraction.created_at,
    },
  };
  if (scoresEnabled()) {
    payload.grade = extraction.grade;
  }
  return NextResponse.json(payload, { headers: rlHeaders });
}
