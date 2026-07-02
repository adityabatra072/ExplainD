import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Local persistence: .data/explaind.db (gitignored — holds API keys and
 * lesson content; nothing here may ever be committed).
 */
const DATA_DIR = path.join(process.cwd(), ".data");
export const AUDIO_DIR = path.join(DATA_DIR, "audio");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(AUDIO_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, "explaind.db"));
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT 'general',
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generating', -- generating | ready | error
      error TEXT,
      outline_json TEXT,
      research_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      order_key REAL NOT NULL,          -- fractional ordering enables O(1) insertion
      spec_json TEXT NOT NULL,
      word_timings_json TEXT NOT NULL DEFAULT '[]',
      audio_path TEXT,                  -- file path under .data/audio/
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ready', -- generating | ready | error
      inserted INTEGER NOT NULL DEFAULT 0,  -- 1 = added by the tutor agent mid-lesson
      summary TEXT,                     -- 1-2 sentence cache for agent context
      repair_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scenes_lesson ON scenes(lesson_id, order_key);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      role TEXT NOT NULL,               -- user | assistant
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_lesson ON chat_messages(lesson_id, id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
  `);
}
