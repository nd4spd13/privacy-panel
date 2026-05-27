import { NextRequest, NextResponse } from "next/server";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { checkRateLimit, getRateLimitHeaders, getClientIp } from "@/lib/rate-limit";
import { isValidPublicSlug } from "@/lib/slug";
import { scoresEnabled } from "@/lib/flags";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(req);
  const { allowed } = checkRateLimit(ip);
  const rlHeaders = getRateLimitHeaders(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rlHeaders });
  }

  const { slug } = await params;
  if (!isValidPublicSlug(slug)) {
    return new NextResponse("Invalid slug", { status: 400, headers: rlHeaders });
  }

  const company = getCompanyBySlug(slug);
  if (!company) {
    return new NextResponse("Company not found", { status: 404, headers: rlHeaders });
  }

  const extraction = getLatestExtractionForCompany(company.id);
  if (!extraction) {
    return new NextResponse("No analysis available", { status: 404, headers: rlHeaders });
  }

  const showScores = scoresEnabled();
  const format = req.nextUrl.searchParams.get("format") ?? "svg";
  const widthParam = parseInt(req.nextUrl.searchParams.get("width") ?? "380", 10);
  const width = Number.isFinite(widthParam) && widthParam >= 200 && widthParam <= 1200 ? widthParam : 380;
  const { renderToSVG, renderToHTML, renderNeutralToSVG, renderNeutralToHTML } = await import("@/core/rendering/embed");

  if (format === "html") {
    const html = showScores
      ? renderToHTML(extraction.facts, extraction.grade, width)
      : renderNeutralToHTML(extraction.facts, width);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...(showScores ? {} : { "Cache-Control": "no-store" }),
      },
    });
  }

  // Default: SVG
  const svg = showScores
    ? renderToSVG(extraction.facts, extraction.grade, width)
    : renderNeutralToSVG(extraction.facts, width);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": showScores ? "public, max-age=60" : "no-store",
    },
  });
}
