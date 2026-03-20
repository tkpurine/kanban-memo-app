const crypto = require('crypto');

const APP_PASSWORD = process.env.APP_PASSWORD || '';

// Generate a simple token from password
function generateToken(password) {
  return crypto.createHash('sha256').update(password + '_kanban_memo').digest('hex');
}

// Auth middleware — skips if no password is set
function authMiddleware(req, res, next) {
  if (!APP_PASSWORD) {
    return next();
  }

  // Allow login endpoint without auth
  if (req.path === '/api/auth/login' || req.path === '/api/auth/check') {
    return next();
  }

  // Only protect /api routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const token = req.headers['x-auth-token'];
  const expectedToken = generateToken(APP_PASSWORD);

  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Login handler
function loginHandler(req, res) {
  const { password } = req.body;

  if (!APP_PASSWORD) {
    return res.json({ ok: true, token: '', authRequired: false });
  }

  if (password === APP_PASSWORD) {
    const token = generateToken(APP_PASSWORD);
    return res.json({ ok: true, token });
  }

  return res.status(401).json({ error: 'Invalid password' });
}

// Check if auth is required
function authCheckHandler(req, res) {
  res.json({ authRequired: !!APP_PASSWORD });
}

module.exports = { authMiddleware, loginHandler, authCheckHandler };
