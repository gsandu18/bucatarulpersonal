// server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_change_me';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors({ origin: true, credentials: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
});
app.use('/api/', limiter);

// --- DB ---
const db = new sqlite3.Database(path.join(__dirname, 'data.db'));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    name TEXT,
    role TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    date TEXT, city TEXT, persons INTEGER, budget INTEGER,
    clientName TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requestId TEXT,
    sender TEXT, -- 'chef' | 'client'
    text TEXT,
    createdAt INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requestId TEXT,
    chefName TEXT,
    filename TEXT,
    originalName TEXT,
    mime TEXT,
    size INTEGER,
    sha256 TEXT,
    createdAt INTEGER
  )`);
});

// seed demo user + cereri (o singură dată)
function seed() {
  db.get('SELECT COUNT(*) AS c FROM users', (e, r) => {
    if (!r || r.c === 0) {
      db.run('INSERT INTO users (email,name,role) VALUES (?,?,?)',
        ['chef@demo.ro', 'Chef Demo', 'chef']);
    }
  });
  db.get('SELECT COUNT(*) AS c FROM requests', (e, r) => {
    if (!r || r.c === 0) {
      const s = db.prepare('INSERT INTO requests (id,date,city,persons,budget,clientName) VALUES (?,?,?,?,?,?)');
      s.run('CER-9001', '2025-08-20', 'București', 6, 2500, 'Client Nou');
      s.run('CER-9002', '2025-09-02', 'Cluj', 12, 5200, 'Client Corporate');
      s.finalize();
    }
  });
}
seed();

// --- Helpers ---
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Fără token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid' });
  }
}

function sanitizeOut(txt = '') {
  return String(txt)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redactat email]')
    .replace(/\+?\d[\d\s\-().]{6,}\d/g, '[redactat tel]');
}

function randomStr(n = 6) {
  return crypto.randomBytes(Math.ceil(n/2)).toString('hex').slice(0, n);
}

// --- Static (frontend) ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// --- API ---
// Login demo – orice email + parola demo -> token
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email/parola necesare' });
  db.get('SELECT * FROM users WHERE email = ?', [email], (e, user) => {
    if (e) return res.status(500).json({ error: 'DB' });
    // demo: dacă nu există, îl creăm chef
    if (!user) {
      db.run('INSERT INTO users (email,name,role) VALUES (?,?,?)',
        [email, email.split('@')[0], 'chef'], function (err) {
          if (err) return res.status(500).json({ error: 'DB insert' });
          const tok = jwt.sign({ sub: this.lastID, email, role: 'chef', name: email.split('@')[0] }, JWT_SECRET, { expiresIn: '7d' });
          return res.json({ token: tok });
        }
      );
    } else {
      const tok = jwt.sign({ sub: user.id, email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token: tok });
    }
  });
});

// Cereri
app.get('/api/requests', auth, (req, res) => {
  db.all('SELECT * FROM requests ORDER BY date ASC', (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB' });
    // Nu expunem date de contact (nu există în tabel oricum)
    res.json({ items: rows });
  });
});

// Chat: list recuperat (polling)
app.get('/api/chats/:requestId', auth, (req, res) => {
  const { requestId } = req.params;
  const since = parseInt(req.query.since || '0', 10);
  db.all(
    'SELECT sender,text,createdAt FROM chats WHERE requestId = ? AND createdAt > ? ORDER BY createdAt ASC',
    [requestId, isNaN(since) ? 0 : since],
    (e, rows) => {
      if (e) return res.status(500).json({ error: 'DB' });
      res.json({ messages: rows, now: Date.now() });
    }
  );
});

// Chat: add message (server curăță PII)
app.post('/api/chats/:requestId', auth, (req, res) => {
  const { requestId } = req.params;
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Mesaj gol' });
  const clean = sanitizeOut(text.trim());
  const now = Date.now();
  db.run('INSERT INTO chats (requestId,sender,text,createdAt) VALUES (?,?,?,?)',
    [requestId, 'chef', clean, now], (e) => {
      if (e) return res.status(500).json({ error: 'DB' });
      res.json({ ok: true, at: now });
    }
  );
});

// Room token (Jitsi meet) – cameră unică + PIN
app.get('/api/room-token/:requestId', auth, (req, res) => {
  const { requestId } = req.params;
  // Cameră cu random + salting simplu (nu e JWT, dar previne guessing)
  const room = `bp-${requestId}-${randomStr(8)}`;
  const pin = String(Math.floor(100000 + Math.random() * 900000)); // 6 cifre
  res.json({ room, pin, ttl: 60 * 60 }); // valabil 1h (UI-ul îl folosește imediat)
});

// Upload înregistrări
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB
app.post('/api/recordings', auth, upload.single('file'), (req, res) => {
  try {
    const { requestId } = req.body || {};
    if (!requestId) return res.status(400).json({ error: 'requestId lipsă' });
    if (!req.file) return res.status(400).json({ error: 'Fișier lipsă' });

    const buf = req.file.buffer;
    // verificare mime "video/webm" sau "video/mp4" — fallback după extensie
    const mime = req.file.mimetype || 'application/octet-stream';
    if (!/^video\/(webm|mp4)$/i.test(mime)) return res.status(400).json({ error: 'Format invalid (doar webm/mp4)' });

    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const safeName = `${Date.now()}_${sha.slice(0,16)}.webm`;
    fs.writeFileSync(path.join(UPLOAD_DIR, safeName), buf);

    db.run(
      `INSERT INTO recordings (requestId,chefName,filename,originalName,mime,size,sha256,createdAt)
       VALUES (?,?,?,?,?,?,?,?)`,
      [requestId, req.user.name || 'Chef', safeName, req.file.originalname, mime, buf.length, sha, Date.now()],
      function (e) {
        if (e) return res.status(500).json({ error: 'DB' });
        res.json({ id: this.lastID, url: `/uploads/${safeName}` });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Upload fail' });
  }
});

// List recordings
app.get('/api/recordings', auth, (req, res) => {
  const { requestId } = req.query;
  if (!requestId) return res.status(400).json({ error: 'requestId lipsă' });
  db.all('SELECT id,filename,originalName,size,createdAt FROM recordings WHERE requestId = ? ORDER BY createdAt DESC',
    [requestId], (e, rows) => {
      if (e) return res.status(500).json({ error: 'DB' });
      const items = rows.map(r => ({
        id: r.id,
        name: r.originalName || r.filename,
        size: r.size,
        createdAt: r.createdAt,
        url: `/uploads/${r.filename}`
      }));
      res.json({ items });
    });
});

// Download recording (static deja pe /uploads)

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:'+PORT);
});
