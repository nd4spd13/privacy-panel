import { z } from "zod";
import { PrivacyPanelSchema } from "./privacy-panel.schema";

// Re-export taxonomy constants for convenience
export type { DataCategory } from "./privacy-panel.schema";
export { DATA_CATEGORIES, SENSITIVE_CATEGORIES, CATEGORY_LABELS } from "./privacy-panel.schema";

// ─── Inferred types ───────────────────────────────────────────────────────────

export type PrivacyPanel = z.infer<typeof PrivacyPanelSchema>;

export type PrivacyPanelMetadata = PrivacyPanel["metadata"];
export type DataCollection = PrivacyPanel["dataCollection"];
export type DataItem = DataCollection["items"][number];
export type BooleanPractice = DataCollection["collectsPreciseGeolocation"];
export type DataSharing = PrivacyPanel["dataSharing"];
export type ThirdPartyRecipients = PrivacyPanel["thirdPartyRecipients"];
export type Purposes = PrivacyPanel["purposes"];
export type SensitiveTaxonomy = DataCollection["sensitiveTaxonomy"];
export type Retention = PrivacyPanel["retention"];
export type ConsumerRights = PrivacyPanel["consumerRights"];
export type SignalHonoring = PrivacyPanel["signalHonoring"];
export type Security = PrivacyPanel["security"];
export type SecurityMeasure = Security["additionalMeasures"][number];
export type Supplementary = PrivacyPanel["supplementary"];
