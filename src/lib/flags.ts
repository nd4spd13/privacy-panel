import { existsSync } from "fs";
import { dirname, join } from "path";

/**
 * Feature flags — set to true to enable, false to disable.
 * These are build-time constants; changing them requires a redeploy.
 */

/** Compare page — disabled until the side-by-side label view is complete.
 * TODO: Fix compare page — currently shows a basic table but lacks the
 *       full PrivacyPanelLabel side-by-side rendering. Re-enable once
 *       ComparisonView component is wired up and the layout is polished.
 */
export const FEATURE_COMPARE = false;

/** Dispute box on company pages — disabled until a dispute submission
 *  flow (form + backend) replaces the placeholder mailto link.
 */
export const FEATURE_DISPUTES = false;

/**
 * Emergency kill switch for the entire scoring layer.
 *
 * Returns false (scores hidden) if EITHER signal is present:
 *   1. SHOW_SCORES env var is set to the string "false"
 *   2. A file named SCORES_DISABLED exists in the data directory
 *
 * Both signals are checked at call time — no build required to flip.
 * OR'd failure mode: any signal toward "off" wins.
 * See docs/SHOW_SCORES.md for operator instructions.
 */
export function scoresEnabled(): boolean {
  if (process.env.SHOW_SCORES === "false") return false;
  try {
    const dataDir = process.env.DATABASE_URL
      ? dirname(process.env.DATABASE_URL)
      : join(process.cwd(), "data");
    if (existsSync(join(dataDir, "SCORES_DISABLED"))) return false;
  } catch {
    // fail open — env var still works as the authoritative signal
  }
  return true;
}
