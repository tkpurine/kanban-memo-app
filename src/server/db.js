const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = 'kanban.db';

let db = null;

function initDb(folderPath) {
  if (db) {
    db.close();
  }

  db = new Database(path.join(folderPath, DB_FILE));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      content    TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'todo',
      created_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id TEXT NOT NULL REFERENCES tasks(id),
      tag_id  TEXT NOT NULL REFERENCES tags(id),
      PRIMARY KEY (task_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks(session_id, sort_order);
  `);

  return db;
}

function getDb() {
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDb, getDb, closeDb };
