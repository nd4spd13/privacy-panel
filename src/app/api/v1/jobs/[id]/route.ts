import { NextResponse } from "next/server";

/**
 * Job submission is disabled. All analyses are pre-loaded by administrators.
 * Returns 410 Gone for any job ID.
 */
export async function GET() {
  return NextResponse.json(
    { error: "On-demand analysis is not available." },
    { status: 410 }
  );
}
