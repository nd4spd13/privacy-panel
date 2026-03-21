import { getDb } from "./client";

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface JobRow {
  id: string;
  url: string;
  company_id: number | null;
  status: JobStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function getJobById(id: string): JobRow | null {
  return getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | null;
}
