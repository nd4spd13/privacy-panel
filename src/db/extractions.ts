import { join } from "path";
import { getDb } from "./client";
import type { PrivacyPanel } from "../core/schema/types";
import { score, type GradeResult } from "../core/scoring/engine";
import { loadRubricOrThrow, type Rubric } from "../core/scoring/rubric";
import { migrateV1ToV2 } from "../core/extraction/validator";

// Lazy-loaded v2 rubric — loaded once on first v1 migration, then cached
let _v2Rubric: Rubric | null = null;
function getV2Rubric(): Rubric {
  if (!_v2Rubric) {
    _v2Rubric = loadRubricOrThrow(join(process.cwd(), "src/core/scoring/rubric.v2.yaml"));
  }
  return _v2Rubric;
}

export interface ExtractionRow {
  id: number;
  policy_id: number;
  company_id: number;
  facts_json: string;
  score: number;
  letter: string;
  grade_label: string;
  grade_color: string;
  rubric_version: string;
  breakdown_json: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  chunked: number;
  created_at: string;
}

export interface ExtractionRecord extends Omit<ExtractionRow, "facts_json" | "breakdown_json"> {
  facts: PrivacyPanel;
  grade: GradeResult;
}

export function getLatestExtractionForCompany(companyId: number): ExtractionRecord | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM extractions WHERE company_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(companyId) as ExtractionRow | null;
  return row ? parseRow(row) : null;
}

export function getExtractionById(id: number): ExtractionRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM extractions WHERE id = ?")
    .get(id) as ExtractionRow | null;
  return row ? parseRow(row) : null;
}

export function listRecentExtractions(limit = 20): ExtractionRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT e.*, c.name as company_name, c.slug as company_slug
       FROM extractions e JOIN companies c ON e.company_id = c.id
       ORDER BY e.created_at DESC LIMIT ?`
    )
    .all(limit) as ExtractionRow[];
  return rows.map(parseRow);
}

export function listExtractionsByScore(order: "asc" | "desc" = "desc", limit = 100): ExtractionRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT e.* FROM extractions e
       WHERE e.id IN (
         SELECT MAX(id) FROM extractions GROUP BY company_id
       )
       ORDER BY e.score ${order === "desc" ? "DESC" : "ASC"}
       LIMIT ?`
    )
    .all(limit) as ExtractionRow[];
  return rows.map(parseRow);
}

export function insertExtraction(
  policyId: number,
  companyId: number,
  facts: PrivacyPanel,
  grade: GradeResult,
  meta: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    chunked?: boolean;
  }
): ExtractionRecord {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO extractions
        (policy_id, company_id, facts_json, score, letter, grade_label, grade_color,
         rubric_version, breakdown_json, model, input_tokens, output_tokens, latency_ms, chunked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      policyId,
      companyId,
      JSON.stringify(facts),
      grade.score,
      grade.letter,
      grade.label,
      grade.color,
      grade.rubricVersion,
      JSON.stringify(grade.breakdown),
      meta.model,
      meta.inputTokens ?? null,
      meta.outputTokens ?? null,
      meta.latencyMs ?? null,
      meta.chunked ? 1 : 0
    );
  return getExtractionById(result.lastInsertRowid as number)!;
}

function parseRow(row: ExtractionRow): ExtractionRecord {
  const { facts_json, breakdown_json, ...rest } = row;
  let facts = JSON.parse(facts_json) as PrivacyPanel;

  // Transparently upgrade v1 extractions: migrate schema then re-score with v2 rubric
  const schemaVersion = (facts as { metadata?: { schemaVersion?: string } }).metadata?.schemaVersion;
  if (schemaVersion === "1.0.0") {
    const migrated = migrateV1ToV2(facts);
    if (migrated.success) {
      facts = migrated.data;
      const v2Grade = score(facts, getV2Rubric());
      return { ...rest, facts, grade: v2Grade };
    }
  }

  const breakdown = JSON.parse(breakdown_json);
  return {
    ...rest,
    facts,
    grade: {
      score: row.score,
      letter: row.letter as GradeResult["letter"],
      label: row.grade_label,
      color: row.grade_color,
      rubricVersion: row.rubric_version,
      breakdown,
    },
  };
}
