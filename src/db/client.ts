import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

const DB_PATH = process.env.DATABASE_URL ?? join(process.cwd(), "data/privacypanel.db");
const SCHEMA_PATH = join(process.cwd(), "src/db/schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    applySchema(_db);
  }
  return _db;
}

function applySchema(db: Database.Database): void {
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  applyMigrations(db);
}

function applyMigrations(db: Database.Database): void {
  // v2 migration: add raw_text column to policies if it doesn't exist
  const cols = db.prepare("PRAGMA table_info(policies)").all() as { name: string }[];
  if (!cols.some(c => c.name === "raw_text")) {
    db.exec("ALTER TABLE policies ADD COLUMN raw_text TEXT");
  }
}

/** Close the database connection (useful in tests). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
