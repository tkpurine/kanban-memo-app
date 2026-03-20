const express = require('express');
const fs = require('fs');
const path = require('path');
const q = require('./queries');

function createRoutes(getDb) {
  const router = express.Router();

  // --- Helpers ---

  function requireDb(res) {
    const db = getDb();
    if (!db) {
      res.status(400).json({ error: 'Storage folder not configured' });
      return null;
    }
    return db;
  }

  function generateId(prefix) {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${prefix}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
  }

  function generateSessionId() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `session_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  // --- Migration ---

  router.post('/migrate', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    // Gather JSON data from old files
    const folder = req.app.locals.storageFolder;
    const jsonData = { sessions: [], tags: [] };

    // Read kanban-data.json if exists
    const dataFile = path.join(folder, 'kanban-data.json');
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      if (data.sessions) jsonData.sessions.push(...data.sessions);
      if (data.tags) jsonData.tags.push(...data.tags);
    }

    // Read old session_*.json files
    const sessionFiles = fs.readdirSync(folder)
      .filter(f => /^session_\d{8}_\d{6}\.json$/.test(f))
      .sort();

    sessionFiles.forEach(f => {
      const session = JSON.parse(fs.readFileSync(path.join(folder, f), 'utf-8'));
      if (!jsonData.sessions.find(s => s.id === session.id)) {
        jsonData.sessions.push(session);
      }
    });

    // Read old tags.json
    const tagsFile = path.join(folder, 'tags.json');
    if (fs.existsSync(tagsFile)) {
      const oldTags = JSON.parse(fs.readFileSync(tagsFile, 'utf-8'));
      if (oldTags.tags) {
        oldTags.tags.forEach(tag => {
          if (!jsonData.tags.find(t => t.id === tag.id)) {
            jsonData.tags.push(tag);
          }
        });
      }
    }

    const importedSessions = q.importJsonData(db, jsonData);
    const totalSessions = db.prepare('SELECT COUNT(*) AS cnt FROM sessions').get().cnt;
    const totalTags = db.prepare('SELECT COUNT(*) AS cnt FROM tags').get().cnt;

    res.json({ success: true, importedSessions, totalSessions, totalTags });
  });

  // --- Session Routes ---

  // GET /api/session/current
  router.get('/session/current', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    let session = q.getCurrentSession(db);
    if (!session) {
      const id = generateSessionId();
      const now = new Date().toISOString();
      q.createSession(db, id, now);
      session = q.getCurrentSession(db);
    }
    res.json(q.buildSessionResponse(db, session));
  });

  // POST /api/session/new
  router.post('/session/new', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    const current = q.getCurrentSession(db);
    if (current) {
      q.endSession(db, current.id, new Date().toISOString());
    }

    const newId = generateSessionId();
    q.createSession(db, newId, new Date().toISOString());

    if (current) {
      q.carryOverTasks(db, current.id, newId);
    }

    const newSession = q.getCurrentSession(db);
    res.json(q.buildSessionResponse(db, newSession));
  });

  // --- Task Routes ---

  // POST /api/task
  router.post('/task', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Task content is required' });
    }

    const session = q.getCurrentSession(db);
    if (!session) {
      return res.status(400).json({ error: 'No active session' });
    }

    const id = generateId('task');
    const sortOrder = q.getNextSortOrder(db, session.id);
    q.createTask(db, id, session.id, content.trim(), 'todo', new Date().toISOString(), sortOrder);

    res.json(q.getTask(db, id));
  });

  // PUT /api/task/:id
  router.put('/task/:id', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    const task = q.getTask(db, req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (req.body.status) {
      q.updateTaskStatus(db, req.params.id, req.body.status);
    }
    if (req.body.content !== undefined) {
      const trimmed = req.body.content.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Task content cannot be empty' });
      }
      q.updateTaskContent(db, req.params.id, trimmed);
    }
    if (req.body.tagIds) {
      q.setTaskTagIds(db, req.params.id, req.body.tagIds);
    }

    res.json(q.getTask(db, req.params.id));
  });

  // DELETE /api/task/:id/tags/:tagId
  router.delete('/task/:id/tags/:tagId', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    const task = q.getTask(db, req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    q.removeTaskTag(db, req.params.id, req.params.tagId);
    res.json(q.getTask(db, req.params.id));
  });

  // PUT /api/tasks/order
  router.put('/tasks/order', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    const { taskIds } = req.body;
    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds must be an array' });
    }

    const session = q.getCurrentSession(db);
    if (!session) {
      return res.status(400).json({ error: 'No active session' });
    }

    q.reorderTasks(db, session.id, taskIds);
    res.json({ success: true });
  });

  // --- Tag Routes ---

  // GET /api/tags
  router.get('/tags', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    const tags = q.getAllTags(db);
    res.json({ tags });
  });

  // POST /api/tags
  router.post('/tags', (req, res) => {
    const db = requireDb(res);
    if (!db) return;

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const maxNum = q.getMaxTagNum(db);
    const id = `tag_${String(maxNum + 1).padStart(3, '0')}`;
    const tag = q.createTag(db, id, name.trim());
    res.json(tag);
  });

  return router;
}

module.exports = createRoutes;
