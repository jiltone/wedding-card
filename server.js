const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';

// Comma-separated list of allowed origins (e.g. "https://your-site.netlify.app").
// Leave unset to allow same-origin requests only implicitly via the browser default.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

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

if (CORS_ORIGINS.length) {
  app.use(cors({ origin: CORS_ORIGINS }));
}
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
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(readRsvps());
});

app.delete('/api/rsvp/:id', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
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
});
