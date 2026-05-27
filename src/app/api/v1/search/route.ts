import { NextRequest, NextResponse } from "next/server";
import { searchCompanies, listCompanies } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { scoresEnabled } from "@/lib/flags";

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

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);

  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 50)
      : 20;

  const companies = q ? searchCompanies(q, limit) : listCompanies(limit);

  const showGrades = scoresEnabled();
  const results = companies.map((c) => {
    const extraction = getLatestExtractionForCompany(c.id);
    return {
      slug: c.slug,
      name: c.name,
      domain: c.domain,
      grade: showGrades && extraction
        ? { letter: extraction.grade.letter, score: extraction.grade.score, label: extraction.grade.label, color: extraction.grade.color }
        : null,
      analyzedAt: extraction?.created_at ?? null,
    };
  });

  return NextResponse.json({ results, count: results.length }, { headers: rlHeaders });
}
