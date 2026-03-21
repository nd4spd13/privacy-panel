import { NextRequest, NextResponse } from "next/server";
import { getCompanyBySlug } from "@/db/companies";
import { getLatestExtractionForCompany } from "@/db/extractions";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const { allowed, remaining, resetAt } = checkRateLimit(ip);
  const rlHeaders = getRateLimitHeaders(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: rlHeaders });
  }

  const company = getCompanyBySlug(params.slug);
  if (!company) {
    return new NextResponse("Company not found", { status: 404 });
  }

  const extraction = getLatestExtractionForCompany(company.id);
  if (!extraction) {
    return new NextResponse("No analysis available", { status: 404 });
  }

  const format = req.nextUrl.searchParams.get("format") ?? "svg";
  const { renderToSVG, renderToHTML } = await import("@/core/rendering/embed");

  if (format === "html") {
    const html = renderToHTML(extraction.facts, extraction.grade);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Default: SVG
  const svg = renderToSVG(extraction.facts, extraction.grade);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
