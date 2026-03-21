import { getDb } from "./client";

export interface Dispute {
  id: number;
  extraction_id: number;
  company_id: number;
  field: string;
  claimed_value: string;
  evidence_url: string | null;
  contact_email: string | null;
  status: "open" | "reviewing" | "resolved" | "rejected";
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export function insertDispute(params: {
  extractionId: number;
  companyId: number;
  field: string;
  claimedValue: string;
  evidenceUrl?: string;
  contactEmail?: string;
}): Dispute {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO disputes
        (extraction_id, company_id, field, claimed_value, evidence_url, contact_email)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.extractionId,
      params.companyId,
      params.field,
      params.claimedValue,
      params.evidenceUrl ?? null,
      params.contactEmail ?? null
    );
  return getDisputeById(result.lastInsertRowid as number)!;
}

export function getDisputeById(id: number): Dispute | null {
  return getDb().prepare("SELECT * FROM disputes WHERE id = ?").get(id) as Dispute | null;
}

export function getDisputesForCompany(companyId: number): Dispute[] {
  return getDb()
    .prepare("SELECT * FROM disputes WHERE company_id = ? ORDER BY created_at DESC")
    .all(companyId) as Dispute[];
}
