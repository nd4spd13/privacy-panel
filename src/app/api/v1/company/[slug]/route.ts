import { NextRequest, NextResponse } from "next/server";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { allowed, remaining, resetAt } = checkRateLimit(ip);
  const rlHeaders = {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };

  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rlHeaders });
  }

  const company = getCompanyBySlug(params.slug);
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

  return NextResponse.json(
    {
      company: {
        slug: company.slug,
        name: company.name,
        domain: company.domain,
      },
      facts: extraction.facts,
      grade: extraction.grade,
      meta: {
        extractionId: extraction.id,
        model: extraction.model,
        inputTokens: extraction.input_tokens,
        outputTokens: extraction.output_tokens,
        latencyMs: extraction.latency_ms,
        analyzedAt: extraction.created_at,
      },
    },
    { headers: rlHeaders }
  );
}
