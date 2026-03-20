const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb, getDb, closeDb } = require('./db');
const createRoutes = require('./routes');
const { authMiddleware, loginHandler, authCheckHandler } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

let storageFolder = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Auth endpoints (before middleware)
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/check', authCheckHandler);

// Auth middleware for all other /api routes
app.use(authMiddleware);

// Get current folder config
app.get('/api/config/folder', (req, res) => {
  res.json({ folder: storageFolder });
});

// Set storage folder path
app.post('/api/config/folder', (req, res) => {
  const { folder } = req.body;
  if (!folder) {
    return res.status(400).json({ error: 'Folder path is required' });
  }
  try {
    const stat = fs.statSync(folder);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
  } catch {
    return res.status(400).json({ error: 'Directory does not exist' });
  }
  storageFolder = folder;
  app.locals.storageFolder = folder;
  initDb(folder);
  res.json({ ok: true, folder: storageFolder });
});

// API routes
app.use('/api', createRoutes(getDb));

app.listen(PORT, () => {
  console.log(`Kanban Memo App running at http://localhost:${PORT}`);
});

// Clean shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
