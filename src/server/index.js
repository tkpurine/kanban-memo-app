const express = require('express');
const path = require('path');
const fs = require('fs');
const createRoutes = require('./routes');

const app = express();
const PORT = 3000;

let storageFolder = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

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
  res.json({ ok: true, folder: storageFolder });
});

// API routes — pass getter so routes always read current storageFolder
app.use('/api', createRoutes(() => storageFolder));

app.listen(PORT, () => {
  console.log(`Kanban Memo App running at http://localhost:${PORT}`);
});
