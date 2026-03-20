// Data access layer for SQLite

function getCurrentSession(db) {
  return db.prepare('SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1').get() || null;
}

function createSession(db, id, startedAt) {
  db.prepare('INSERT INTO sessions (id, started_at) VALUES (?, ?)').run(id, startedAt);
  return { id, startedAt, endedAt: null };
}

function endSession(db, id, endedAt) {
  db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(endedAt, id);
}

function getSessionTasks(db, sessionId) {
  const rows = db.prepare(`
    SELECT t.id, t.content, t.status, t.created_at AS createdAt, t.sort_order,
           GROUP_CONCAT(tt.tag_id) AS tagIdStr
    FROM tasks t
    LEFT JOIN task_tags tt ON t.id = tt.task_id
    WHERE t.session_id = ?
    GROUP BY t.id
    ORDER BY t.sort_order
  `).all(sessionId);

  return rows.map(row => ({
    id: row.id,
    content: row.content,
    status: row.status,
    tagIds: row.tagIdStr ? row.tagIdStr.split(',') : [],
    createdAt: row.createdAt
  }));
}

function buildSessionResponse(db, session) {
  if (!session) return null;
  const tasks = getSessionTasks(db, session.id);
  return {
    id: session.id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    tasks
  };
}

function getNextSortOrder(db, sessionId) {
  const row = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM tasks WHERE session_id = ?').get(sessionId);
  return row.next;
}

function createTask(db, id, sessionId, content, status, createdAt, sortOrder) {
  db.prepare('INSERT INTO tasks (id, session_id, content, status, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(id, sessionId, content, status, createdAt, sortOrder);
}

function getTask(db, taskId) {
  const row = db.prepare(`
    SELECT t.id, t.content, t.status, t.created_at AS createdAt, t.session_id,
           GROUP_CONCAT(tt.tag_id) AS tagIdStr
    FROM tasks t
    LEFT JOIN task_tags tt ON t.id = tt.task_id
    WHERE t.id = ?
    GROUP BY t.id
  `).get(taskId);

  if (!row) return null;
  return {
    id: row.id,
    content: row.content,
    status: row.status,
    tagIds: row.tagIdStr ? row.tagIdStr.split(',') : [],
    createdAt: row.createdAt
  };
}

function updateTaskStatus(db, taskId, status) {
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, taskId);
}

function updateTaskContent(db, taskId, content) {
  db.prepare('UPDATE tasks SET content = ? WHERE id = ?').run(content, taskId);
}

function setTaskTagIds(db, taskId, tagIds) {
  const setTags = db.transaction((taskId, tagIds) => {
    db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId);
    const insert = db.prepare('INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)');
    for (const tagId of tagIds) {
      insert.run(taskId, tagId);
    }
  });
  setTags(taskId, tagIds);
}

function removeTaskTag(db, taskId, tagId) {
  db.prepare('DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?').run(taskId, tagId);
}

function reorderTasks(db, sessionId, taskIds) {
  const reorder = db.transaction((sessionId, taskIds) => {
    const update = db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ? AND session_id = ?');
    taskIds.forEach((id, index) => {
      update.run(index, id, sessionId);
    });
  });
  reorder(sessionId, taskIds);
}

function carryOverTasks(db, fromSessionId, toSessionId) {
  const carry = db.transaction(() => {
    const tasks = db.prepare("SELECT id FROM tasks WHERE session_id = ? AND status != 'done' ORDER BY sort_order").all(fromSessionId);
    const update = db.prepare('UPDATE tasks SET session_id = ?, sort_order = ? WHERE id = ?');
    tasks.forEach((task, index) => {
      update.run(toSessionId, index, task.id);
    });
    return tasks.length;
  });
  return carry();
}

function getAllTags(db) {
  return db.prepare('SELECT * FROM tags ORDER BY id').all();
}

function getMaxTagNum(db) {
  const row = db.prepare("SELECT id FROM tags WHERE id LIKE 'tag_%' ORDER BY id DESC LIMIT 1").get();
  if (!row) return 0;
  const match = row.id.match(/^tag_(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function createTag(db, id, name) {
  db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name);
  return { id, name };
}

function importJsonData(db, jsonData) {
  const doImport = db.transaction((data) => {
    const insertSession = db.prepare('INSERT OR IGNORE INTO sessions (id, started_at, ended_at) VALUES (?, ?, ?)');
    const insertTask = db.prepare('INSERT OR IGNORE INTO tasks (id, session_id, content, status, created_at, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    const insertTaskTag = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)');
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)');

    let importedSessions = 0;

    // Import tags first (foreign key dependency)
    if (data.tags) {
      for (const tag of data.tags) {
        insertTag.run(tag.id, tag.name);
      }
    }

    // Import sessions and tasks
    if (data.sessions) {
      for (const session of data.sessions) {
        const result = insertSession.run(session.id, session.startedAt, session.endedAt || null);
        if (result.changes > 0) importedSessions++;

        if (session.tasks) {
          session.tasks.forEach((task, index) => {
            insertTask.run(task.id, session.id, task.content, task.status, task.createdAt, index);
            if (task.tagIds) {
              for (const tagId of task.tagIds) {
                insertTaskTag.run(task.id, tagId);
              }
            }
          });
        }
      }
    }

    return importedSessions;
  });

  return doImport(jsonData);
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
