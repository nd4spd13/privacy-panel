import { NextRequest, NextResponse } from "next/server";
import { searchCompanies, listCompanies } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
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

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);

  const companies = q ? searchCompanies(q, limit) : listCompanies(limit);

  const results = companies.map((c) => {
    const extraction = getLatestExtractionForCompany(c.id);
    return {
      slug: c.slug,
      name: c.name,
      domain: c.domain,
      grade: extraction
        ? { letter: extraction.grade.letter, score: extraction.grade.score, label: extraction.grade.label, color: extraction.grade.color }
        : null,
      analyzedAt: extraction?.created_at ?? null,
    };
  });

  return NextResponse.json({ results, count: results.length }, { headers: rlHeaders });
}
