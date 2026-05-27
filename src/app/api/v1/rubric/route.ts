import { NextRequest, NextResponse } from "next/server";
import { loadRubricOrThrow } from "@/core/scoring/rubric";
import { checkRateLimit, getRateLimitHeaders, getClientIp } from "@/lib/rate-limit";
import { scoresEnabled } from "@/lib/flags";
import { join } from "path";

const rubric = loadRubricOrThrow(join(process.cwd(), "src/core/scoring/rubric.v1.yaml"));

export async function GET(req: NextRequest) {
  if (!scoresEnabled()) {
    return NextResponse.json({ error: "Scoring is currently disabled" }, { status: 404 });
  }

  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: getRateLimitHeaders(ip) });
  }

  return NextResponse.json({
    version: rubric.version,
    rubric,
    description: "Privacy Panel scoring rubric. Scores start at 100, deductions are applied for harmful practices, bonuses for consumer-friendly ones.",
    methodology: "https://privacypanel.org/rubric",
  });
}
