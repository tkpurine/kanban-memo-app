const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const DB_FILE = 'kanban.db';

let client = null;

async function initDb(folderOrUrl) {
  if (client) {
    client.close();
  }

  // Turso cloud mode: TURSO_DATABASE_URL is set
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    // Cloud mode: connect to Turso
    client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
    console.log('Connected to Turso cloud database');
  } else {
    // Local mode: use local SQLite file
    const dbPath = path.join(folderOrUrl, DB_FILE);
    client = createClient({
      url: `file:${dbPath}`,
    });
    console.log(`Connected to local database: ${dbPath}`);
  }

  await client.executeMultiple(`
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

  return client;
}

function getDb() {
  return client;
}

function closeDb() {
  if (client) {
    client.close();
    client = null;
  }
}

module.exports = { initDb, getDb, closeDb };
