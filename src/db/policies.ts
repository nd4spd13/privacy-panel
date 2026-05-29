import { getDb } from "./client";

export interface Policy {
  id: number;
  company_id: number;
  url: string;
  content_hash: string;
  raw_text: string | null;
  fetched_at: string;
  created_at: string;
  // Provenance (CRS-199 / CRS-190)
  normalized_hash: string | null;     // sha256(norm-v1(raw_text))
  normalizer: string | null;          // e.g. "norm-v1"
  archive_url: string | null;         // Wayback capture (CRS-200)
  archive_captured_at: string | null;
}

export function getPolicyByHash(contentHash: string): Policy | null {
  return getDb()
    .prepare("SELECT * FROM policies WHERE content_hash = ?")
    .get(contentHash) as Policy | null;
}

export function getLatestPolicyForCompany(companyId: number): Policy | null {
  return getDb()
    .prepare(
      "SELECT * FROM policies WHERE company_id = ? ORDER BY fetched_at DESC LIMIT 1"
    )
    .get(companyId) as Policy | null;
}

export function insertPolicy(
  companyId: number,
  url: string,
  contentHash: string,
  fetchedAt: string,
  rawText?: string
): Policy {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO policies (company_id, url, content_hash, raw_text, fetched_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(companyId, url, contentHash, rawText ?? null, fetchedAt);
  return db
    .prepare("SELECT * FROM policies WHERE id = ?")
    .get(result.lastInsertRowid) as Policy;
}

export function updatePolicyRawText(policyId: number, rawText: string): void {
  getDb()
    .prepare("UPDATE policies SET raw_text = ? WHERE id = ?")
    .run(rawText, policyId);
}

export function getPolicyWithText(companyId: number): Policy | null {
  return getDb()
    .prepare(
      "SELECT * FROM policies WHERE company_id = ? AND raw_text IS NOT NULL ORDER BY fetched_at DESC LIMIT 1"
    )
    .get(companyId) as Policy | null;
}

/** Set the norm-v1 normalized-text hash for a policy (CRS-199). */
export function setNormalizedHash(
  policyId: number,
  normalizedHash: string,
  normalizer: string
): void {
  getDb()
    .prepare("UPDATE policies SET normalized_hash = ?, normalizer = ? WHERE id = ?")
    .run(normalizedHash, normalizer, policyId);
}
