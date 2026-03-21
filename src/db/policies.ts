import { getDb } from "./client";

export interface Policy {
  id: number;
  company_id: number;
  url: string;
  content_hash: string;
  fetched_at: string;
  created_at: string;
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
  fetchedAt: string
): Policy {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO policies (company_id, url, content_hash, fetched_at) VALUES (?, ?, ?, ?)"
    )
    .run(companyId, url, contentHash, fetchedAt);
  return db
    .prepare("SELECT * FROM policies WHERE id = ?")
    .get(result.lastInsertRowid) as Policy;
}
