import { getDb } from "./client";

export interface Company {
  id: number;
  slug: string;
  name: string;
  domain: string | null;
  created_at: string;
  updated_at: string;
}

export function getCompanyBySlug(slug: string): Company | null {
  return getDb().prepare("SELECT * FROM companies WHERE slug = ?").get(slug) as Company | null;
}

export function getCompanyById(id: number): Company | null {
  return getDb().prepare("SELECT * FROM companies WHERE id = ?").get(id) as Company | null;
}

export function searchCompanies(query: string, limit = 20): Company[] {
  return getDb()
    .prepare(
      "SELECT * FROM companies WHERE name LIKE ? ORDER BY name COLLATE NOCASE LIMIT ?"
    )
    .all(`%${query}%`, limit) as Company[];
}

export function listCompanies(limit = 100, offset = 0): Company[] {
  return getDb()
    .prepare("SELECT * FROM companies ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?")
    .all(limit, offset) as Company[];
}

export function upsertCompany(slug: string, name: string, domain?: string): Company {
  const db = getDb();
  const existing = getCompanyBySlug(slug);
  if (existing) {
    db.prepare(
      "UPDATE companies SET name = ?, domain = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE slug = ?"
    ).run(name, domain ?? null, slug);
    return getCompanyBySlug(slug)!;
  }
  const result = db
    .prepare("INSERT INTO companies (slug, name, domain) VALUES (?, ?, ?)")
    .run(slug, name, domain ?? null);
  return getCompanyById(result.lastInsertRowid as number)!;
}

export function countCompanies(): number {
  const row = getDb().prepare("SELECT COUNT(*) as n FROM companies").get() as { n: number };
  return row.n;
}
