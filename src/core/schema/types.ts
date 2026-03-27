import { z } from "zod";
import { PrivacyFactsSchema } from "./privacy-facts.schema";

// ─── Inferred types ───────────────────────────────────────────────────────────

export type PrivacyFacts = z.infer<typeof PrivacyFactsSchema>;

export type PrivacyFactsMetadata = PrivacyFacts["metadata"];
export type DataCollection = PrivacyFacts["dataCollection"];
export type DataItem = DataCollection["items"][number];
export type BooleanPractice = DataCollection["collectsPreciseGeolocation"];
export type DataSharing = PrivacyFacts["dataSharing"];
export type ThirdPartyRecipients = PrivacyFacts["thirdPartyRecipients"];
export type Purposes = PrivacyFacts["purposes"];
export type SensitiveTaxonomy = DataCollection["sensitiveTaxonomy"];
export type Retention = PrivacyFacts["retention"];
export type ConsumerRights = PrivacyFacts["consumerRights"];
export type SignalHonoring = PrivacyFacts["signalHonoring"];
export type Security = PrivacyFacts["security"];
export type SecurityMeasure = Security["additionalMeasures"][number];
export type Supplementary = PrivacyFacts["supplementary"];
