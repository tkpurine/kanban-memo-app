const express = require('express');
const fs = require('fs');
const path = require('path');

function createRoutes(getStorageFolder) {
  const router = express.Router();

  // --- Helpers ---

  function requireFolder(res) {
    const folder = getStorageFolder();
    if (!folder) {
      res.status(400).json({ error: 'Storage folder not configured' });
      return null;
    }
    return folder;
  }

  function getSessionFiles(folder) {
    return fs.readdirSync(folder)
      .filter(f => /^session_\d{8}_\d{6}\.json$/.test(f))
      .sort()
      .reverse();
  }

  function readSession(folder, filename) {
    return JSON.parse(fs.readFileSync(path.join(folder, filename), 'utf-8'));
  }

  function writeSession(folder, filename, data) {
    fs.writeFileSync(path.join(folder, filename), JSON.stringify(data, null, 2));
  }

  function readTags(folder) {
    const filepath = path.join(folder, 'tags.json');
    if (!fs.existsSync(filepath)) {
      return { tags: [] };
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  }

  function writeTags(folder, data) {
    fs.writeFileSync(path.join(folder, 'tags.json'), JSON.stringify(data, null, 2));
  }

  function generateId(prefix) {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${prefix}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
  }

  function createNewSession(folder, tasks = []) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `session_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
    const session = {
      id: filename.replace('.json', ''),
      startedAt: now.toISOString(),
      endedAt: null,
      tasks
    };
    writeSession(folder, filename, session);
    return { filename, session };
  }

  // --- Session Routes ---

  // GET /api/session/current
  router.get('/session/current', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const files = getSessionFiles(folder);
    if (files.length === 0) {
      const { session } = createNewSession(folder);
      return res.json(session);
    }
    const session = readSession(folder, files[0]);
    res.json(session);
  });

  // POST /api/session/new
  router.post('/session/new', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const files = getSessionFiles(folder);

    // End current session if one exists
    let carryOverTasks = [];
    if (files.length > 0) {
      const current = readSession(folder, files[0]);
      current.endedAt = new Date().toISOString();
      writeSession(folder, files[0], current);
      carryOverTasks = current.tasks.filter(t => t.status !== 'done');
    }

    const { session } = createNewSession(folder, carryOverTasks);
    res.json(session);
  });

  // --- Task Routes ---

  // POST /api/task
  router.post('/task', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Task content is required' });
    }

    const files = getSessionFiles(folder);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No active session' });
    }

    const session = readSession(folder, files[0]);
    const task = {
      id: generateId('task'),
      content: content.trim(),
      status: 'todo',
      tagIds: [],
      createdAt: new Date().toISOString()
    };
    session.tasks.push(task);
    writeSession(folder, files[0], session);
    res.json(task);
  });

  // PUT /api/task/:id
  router.put('/task/:id', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const files = getSessionFiles(folder);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No active session' });
    }

    const session = readSession(folder, files[0]);
    const task = session.tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (req.body.status) {
      task.status = req.body.status;
    }
    if (req.body.content !== undefined) {
      const trimmed = req.body.content.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Task content cannot be empty' });
      }
      task.content = trimmed;
    }
    if (req.body.tagIds) {
      task.tagIds = req.body.tagIds;
    }

    writeSession(folder, files[0], session);
    res.json(task);
  });

  // DELETE /api/task/:id/tags/:tagId
  router.delete('/task/:id/tags/:tagId', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const files = getSessionFiles(folder);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No active session' });
    }

    const session = readSession(folder, files[0]);
    const task = session.tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    task.tagIds = task.tagIds.filter(id => id !== req.params.tagId);
    writeSession(folder, files[0], session);
    res.json(task);
  });

  // PUT /api/tasks/order
  router.put('/tasks/order', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const { taskIds } = req.body;
    if (!Array.isArray(taskIds)) {
      return res.status(400).json({ error: 'taskIds must be an array' });
    }

    const files = getSessionFiles(folder);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No active session' });
    }

    const session = readSession(folder, files[0]);
    const reordered = [];
    taskIds.forEach(id => {
      const task = session.tasks.find(t => t.id === id);
      if (task) reordered.push(task);
    });
    session.tasks.forEach(t => {
      if (!taskIds.includes(t.id)) reordered.push(t);
    });
    session.tasks = reordered;
    writeSession(folder, files[0], session);
    res.json({ success: true });
  });

  // --- Tag Routes ---

  // GET /api/tags
  router.get('/tags', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const data = readTags(folder);
    res.json(data);
  });

  // POST /api/tags
  router.post('/tags', (req, res) => {
    const folder = requireFolder(res);
    if (!folder) return;

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const data = readTags(folder);
    const maxNum = data.tags.reduce((max, tag) => {
      const match = tag.id.match(/^tag_(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);

    const newTag = {
      id: `tag_${String(maxNum + 1).padStart(3, '0')}`,
      name: name.trim()
    };
    data.tags.push(newTag);
    writeTags(folder, data);
    res.json(newTag);
  });

  return router;
}

module.exports = createRoutes;
