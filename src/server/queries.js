// Data access layer for libSQL (Turso / local SQLite)

async function getCurrentSession(db) {
  const result = await db.execute('SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
  return result.rows[0] || null;
}

async function createSession(db, id, startedAt) {
  await db.execute({ sql: 'INSERT INTO sessions (id, started_at) VALUES (?, ?)', args: [id, startedAt] });
  return { id, startedAt, endedAt: null };
}

async function endSession(db, id, endedAt) {
  await db.execute({ sql: 'UPDATE sessions SET ended_at = ? WHERE id = ?', args: [endedAt, id] });
}

async function getSessionTasks(db, sessionId) {
  const result = await db.execute({
    sql: `
      SELECT t.id, t.content, t.status, t.created_at AS createdAt, t.sort_order,
             GROUP_CONCAT(tt.tag_id) AS tagIdStr
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      WHERE t.session_id = ?
      GROUP BY t.id
      ORDER BY t.sort_order
    `,
    args: [sessionId]
  });

  return result.rows.map(row => ({
    id: row.id,
    content: row.content,
    status: row.status,
    tagIds: row.tagIdStr ? row.tagIdStr.split(',') : [],
    createdAt: row.createdAt
  }));
}

async function buildSessionResponse(db, session) {
  if (!session) return null;
  const tasks = await getSessionTasks(db, session.id);
  return {
    id: session.id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    tasks
  };
}

async function getNextSortOrder(db, sessionId) {
  const result = await db.execute({ sql: 'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tasks WHERE session_id = ?', args: [sessionId] });
  return result.rows[0].next;
}

async function createTask(db, id, sessionId, content, status, createdAt, sortOrder) {
  await db.execute({ sql: 'INSERT INTO tasks (id, session_id, content, status, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?)', args: [id, sessionId, content, status, createdAt, sortOrder] });
}

async function getTask(db, taskId) {
  const result = await db.execute({
    sql: `
      SELECT t.id, t.content, t.status, t.created_at AS createdAt, t.session_id,
             GROUP_CONCAT(tt.tag_id) AS tagIdStr
      FROM tasks t
      LEFT JOIN task_tags tt ON t.id = tt.task_id
      WHERE t.id = ?
      GROUP BY t.id
    `,
    args: [taskId]
  });

  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    content: row.content,
    status: row.status,
    tagIds: row.tagIdStr ? row.tagIdStr.split(',') : [],
    createdAt: row.createdAt
  };
}

async function updateTaskStatus(db, taskId, status) {
  await db.execute({ sql: 'UPDATE tasks SET status = ? WHERE id = ?', args: [status, taskId] });
}

async function deleteTask(db, taskId) {
  await db.execute({ sql: 'DELETE FROM task_tags WHERE task_id = ?', args: [taskId] });
  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [taskId] });
}

async function updateTaskContent(db, taskId, content) {
  await db.execute({ sql: 'UPDATE tasks SET content = ? WHERE id = ?', args: [content, taskId] });
}

async function setTaskTagIds(db, taskId, tagIds) {
  await db.execute({ sql: 'DELETE FROM task_tags WHERE task_id = ?', args: [taskId] });
  for (const tagId of tagIds) {
    await db.execute({ sql: 'INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)', args: [taskId, tagId] });
  }
}

async function removeTaskTag(db, taskId, tagId) {
  await db.execute({ sql: 'DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?', args: [taskId, tagId] });
}

async function reorderTasks(db, sessionId, taskIds) {
  for (let i = 0; i < taskIds.length; i++) {
    await db.execute({ sql: 'UPDATE tasks SET sort_order = ? WHERE id = ? AND session_id = ?', args: [i, taskIds[i], sessionId] });
  }
}

async function carryOverTasks(db, fromSessionId, toSessionId) {
  const result = await db.execute({ sql: "SELECT id FROM tasks WHERE session_id = ? AND status != 'done' ORDER BY sort_order", args: [fromSessionId] });
  for (let i = 0; i < result.rows.length; i++) {
    await db.execute({ sql: 'UPDATE tasks SET session_id = ?, sort_order = ? WHERE id = ?', args: [toSessionId, i, result.rows[i].id] });
  }
  return result.rows.length;
}

async function getAllTags(db) {
  const result = await db.execute('SELECT * FROM tags ORDER BY id');
  return result.rows;
}

async function getMaxTagNum(db) {
  const result = await db.execute("SELECT id FROM tags WHERE id LIKE 'tag_%' ORDER BY id DESC LIMIT 1");
  const row = result.rows[0];
  if (!row) return 0;
  const match = row.id.match(/^tag_(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

async function createTag(db, id, name) {
  await db.execute({ sql: 'INSERT INTO tags (id, name) VALUES (?, ?)', args: [id, name] });
  return { id, name };
}

async function importJsonData(db, jsonData) {
  let importedSessions = 0;

  // Import tags first
  if (jsonData.tags) {
    for (const tag of jsonData.tags) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)', args: [tag.id, tag.name] });
    }
  }

  // Import sessions and tasks
  if (jsonData.sessions) {
    for (const session of jsonData.sessions) {
      const result = await db.execute({ sql: 'INSERT OR IGNORE INTO sessions (id, started_at, ended_at) VALUES (?, ?, ?)', args: [session.id, session.startedAt, session.endedAt || null] });
      if (result.rowsAffected > 0) importedSessions++;

      if (session.tasks) {
        for (let i = 0; i < session.tasks.length; i++) {
          const task = session.tasks[i];
          await db.execute({ sql: 'INSERT OR IGNORE INTO tasks (id, session_id, content, status, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?)', args: [task.id, session.id, task.content, task.status, task.createdAt, i] });
          if (task.tagIds) {
            for (const tagId of task.tagIds) {
              await db.execute({ sql: 'INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)', args: [task.id, tagId] });
            }
          }
        }
      }
    }
  }

  return importedSessions;
}

module.exports = {
  getCurrentSession,
  createSession,
  endSession,
  getSessionTasks,
  buildSessionResponse,
  getNextSortOrder,
  createTask,
  getTask,
  updateTaskStatus,
  deleteTask,
  updateTaskContent,
  setTaskTagIds,
  removeTaskTag,
  reorderTasks,
  carryOverTasks,
  getAllTags,
  getMaxTagNum,
  createTag,
  importJsonData
};
