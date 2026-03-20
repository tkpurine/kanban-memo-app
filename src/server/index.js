const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb, getDb, closeDb } = require('./db');
const createRoutes = require('./routes');
const { authMiddleware, loginHandler, authCheckHandler } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

let storageFolder = null;
const isTursoMode = !!process.env.TURSO_DATABASE_URL;
const isCloudMode = isTursoMode || !!process.env.STORAGE_FOLDER;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Auth endpoints (before middleware)
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/check', authCheckHandler);

// Auth middleware for all other /api routes
app.use(authMiddleware);

// Get current folder config + mode info
app.get('/api/config/folder', (req, res) => {
  res.json({
    folder: isTursoMode ? 'turso-cloud' : storageFolder,
    mode: isTursoMode ? 'cloud' : isCloudMode ? 'cloud' : 'local'
  });
});

// Set storage folder path (local mode only)
app.post('/api/config/folder', async (req, res) => {
  if (isCloudMode) {
    return res.status(400).json({ error: 'Folder is auto-configured in cloud mode' });
  }
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
  await initDb(folder);
  res.json({ ok: true, folder: storageFolder });
});

// API routes
app.use('/api', createRoutes(getDb));

// Start server
async function start() {
  // Auto-configure in cloud/Turso mode
  if (isTursoMode) {
    await initDb();
    console.log('Turso cloud mode: connected to remote database');
  } else if (process.env.STORAGE_FOLDER) {
    const folder = process.env.STORAGE_FOLDER;
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    storageFolder = folder;
    app.locals.storageFolder = folder;
    await initDb(folder);
    console.log(`Cloud mode: storage folder set to ${folder}`);
  }

  app.listen(PORT, () => {
    console.log(`Kanban Memo App running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
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
