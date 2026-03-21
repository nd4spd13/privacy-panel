/**
 * Feature flags — set to true to enable, false to disable.
 * These are build-time constants; changing them requires a redeploy.
 */

/** Compare page — disabled until the side-by-side label view is complete.
 * TODO: Fix compare page — currently shows a basic table but lacks the
 *       full PrivacyFactsLabel side-by-side rendering. Re-enable once
 *       ComparisonView component is wired up and the layout is polished.
 */
export const FEATURE_COMPARE = false;

/** Dispute box on company pages — disabled until a dispute submission
 *  flow (form + backend) replaces the placeholder mailto link.
 */
export const FEATURE_DISPUTES = false;
