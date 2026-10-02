const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// Admin password for the RSVP dashboard (public/admin.html).
// Set ADMIN_KEY in the environment (or Render dashboard) to override the default.
const ADMIN_KEY = (process.env.ADMIN_KEY || '1234').trim();

// Comma-separated list of allowed origins (e.g. "https://your-site.netlify.app").
// Any *.netlify.app origin is always allowed so the deployed card works out of
// the box even if CORS_ORIGINS isn't set on Render.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const NETLIFY_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.netlify\.app$/;

const DATA_DIR = path.join(__dirname, 'data');
const RSVP_FILE = path.join(DATA_DIR, 'rsvps.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RSVP_FILE)) fs.writeFileSync(RSVP_FILE, '[]');

function readRsvps() {
  return JSON.parse(fs.readFileSync(RSVP_FILE, 'utf-8'));
}

function writeRsvps(list) {
  fs.writeFileSync(RSVP_FILE, JSON.stringify(list, null, 2));
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || NETLIFY_ORIGIN_RE.test(origin) || CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/rsvp', (req, res) => {
  const { name, attending, guests, message } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (attending !== 'yes' && attending !== 'no') {
    return res.status(400).json({ error: 'Attending must be yes or no.' });
  }

  const guestCount = Math.min(Math.max(parseInt(guests, 10) || 1, 1), 10);

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: name.trim().slice(0, 100),
    attending,
    guests: guestCount,
    message: typeof message === 'string' ? message.trim().slice(0, 500) : '',
    submittedAt: new Date().toISOString()
  };

  const list = readRsvps();
  list.push(entry);
  writeRsvps(list);

  res.status(201).json({ ok: true });
});

// Simple admin view of RSVPs — pass ?key=<ADMIN_KEY> to access.
app.get('/api/rsvp', (req, res) => {
  if (String(req.query.key || '').trim() !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(readRsvps());
});

app.delete('/api/rsvp/:id', (req, res) => {
  if (String(req.query.key || '').trim() !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const list = readRsvps();
  const filtered = list.filter((r) => r.id !== req.params.id);

  if (filtered.length === list.length) {
    return res.status(404).json({ error: 'Not found' });
  }

  writeRsvps(filtered);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Wedding invitation server running at http://localhost:${PORT}`);
  console.log(`Admin dashboard:  http://localhost:${PORT}/admin.html`);
  console.log(`Admin password:   ${ADMIN_KEY}${process.env.ADMIN_KEY ? ' (from ADMIN_KEY env)' : ' (default — set ADMIN_KEY to change)'}`);
});
