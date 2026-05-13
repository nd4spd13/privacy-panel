import { NextRequest, NextResponse } from "next/server";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { isValidPublicSlug } from "@/lib/slug";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
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

  // Accept ?slugs=signal,typicalsaas,aggressive (2-3 slugs)
  const slugsParam = (req.nextUrl.searchParams.get("slugs") ?? "").slice(0, 500);
  const slugs = slugsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);

  if (slugs.length < 2) {
    return NextResponse.json(
      { error: "Provide 2–3 company slugs via ?slugs=slug1,slug2[,slug3]" },
      { status: 400, headers: rlHeaders }
    );
  }

  if (slugs.some((s) => !isValidPublicSlug(s))) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400, headers: rlHeaders });
  }

  const results = slugs.map((slug) => {
    const company = getCompanyBySlug(slug);
    if (!company) return { slug, error: "Not found" };
    const extraction = getLatestExtractionForCompany(company.id);
    if (!extraction) return { slug, error: "No analysis available" };
    return {
      slug,
      name: company.name,
      domain: company.domain,
      facts: extraction.facts,
      grade: extraction.grade,
      analyzedAt: extraction.created_at,
    };
  });

  const errors = results.filter((r) => "error" in r);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: "One or more companies not found", details: errors },
      { status: 404, headers: rlHeaders }
    );
  }

  return NextResponse.json({ companies: results }, { headers: rlHeaders });
}
