// ===== BarX Reservation Server =====
// REST API pro správu rezervací s perzistencí do JSON
// Endpoints: GET/POST /api/reservations, PATCH/DELETE /api/reservations/:id

const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Server konfigurrace
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, 'reservations.json');

// MIME typy pro statické soubory
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Dostupné stoly s IDs a počtem míst
const TABLES = [
  { id: 'bar-2', seats: 2 },
  { id: 'window-4', seats: 4 },
  { id: 'lounge-4', seats: 4 },
  { id: 'booth-6', seats: 6 },
  { id: 'vip-8', seats: 8 }
];

// Povolené stavy rezervace
const RESERVATION_STATUSES = new Set(['new', 'called', 'confirmed', 'done', 'completed']);

// Převede datum a slot na počet ms od epoch
// Používá se pro kontrolu, zda uplynul čas na auto-korpmletaci status
function getReservationStartMs(item) {
  const dateValue = String(item.date || '');
  const slotValue = String(item.slot || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  if (!/^\d{2}:\d{2}$/.test(slotValue)) return null;
  const ms = new Date(dateValue + 'T' + slotValue + ':00').getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Auto-kompletace: pokud od začátku rezervace uplynula 1 hodina, set status na 'completed'
// Vrací { next (upravená pole), changed (bool) }
function autoCompleteExpiredReservations(items) {
  const nowMs = Date.now();
  let changed = false;
  const next = items.map(item => {
    const startMs = getReservationStartMs(item);
    if (startMs === null) return item;
    if (nowMs < startMs + (60 * 60 * 1000)) return item; // Ještě uplynula pouze 1 hodina
    if (String(item.status || 'new').trim() === 'completed') return item; // Už je completed

    // Aktualizuj na completed
    changed = true;
    return {
      ...item,
      status: 'completed',
      updatedAt: new Date().toISOString()
    };
  });
  return { next, changed };
}

// Odeslání JSON odpovědi s CORS headerem
function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

// Odeslání textové odpovědi
function sendText(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

async function ensureDataFile() {
  try {
    await fs.promises.access(DATA_FILE, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(DATA_FILE, '[]\n', 'utf8');
  }
}

async function readReservations() {
  await ensureDataFile();
  const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeReservations(reservations) {
  await fs.promises.writeFile(DATA_FILE, JSON.stringify(reservations, null, 2) + '\n', 'utf8');
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// Validační funkce
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return typeof phone === 'string' && /^[+\d][\d\s]{7,}$/.test(phone);
}

// Ověří všechna povinná pole a jejich validitu
function validateReservation(payload) {
  const requiredFields = ['name', 'phone', 'email', 'guests', 'date', 'slot', 'tableId', 'vibe'];
  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === '') {
      return 'Chybí povinné pole: ' + field;
    }
  }

  const guests = Number(payload.guests);
  const vibe = Number(payload.vibe);
  const table = TABLES.find(item => item.id === payload.tableId);
  if (!table) return 'Neplatný stůl.';
  if (!Number.isInteger(guests) || guests < 1) return 'Neplatný počet hostů.';
  if (!Number.isInteger(vibe) || vibe < 1 || vibe > 10) return 'Neplatná hodnota vibe (1-10).';
  if (guests > table.seats) return 'Vybraný stůl nemá dost míst.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return 'Neplatné datum.';
  if (!/^\d{2}:00$/.test(payload.slot)) return 'Neplatný čas.';
  if (!isValidEmail(payload.email)) return 'Neplatný e-mail.';
  if (!isValidPhone(payload.phone)) return 'Neplatné telefonní číslo.';
  return null;
}

// Normalizuje příchozí data do standardního formátu rezervace
function normalizeReservation(payload) {
  return {
    id: randomUUID(),
    name: String(payload.name).trim(),
    phone: String(payload.phone).trim(),
    email: String(payload.email).trim(),
    guests: Number(payload.guests),
    date: String(payload.date).trim(),
    slot: String(payload.slot).trim(),
    tableId: String(payload.tableId).trim(),
    vibe: Number(payload.vibe),
    status: 'new',
    note: payload.note ? String(payload.note).trim() : '',
    drink: payload.drink ? String(payload.drink).trim() : '',
    createdAt: new Date().toISOString()
  };
}

// Ověří PATCH request - musí obsahovat status a/nebo note
function validatePatchPayload(payload) {
  const hasStatus = Object.prototype.hasOwnProperty.call(payload, 'status');
  const hasNote = Object.prototype.hasOwnProperty.call(payload, 'note');
  if (!hasStatus && !hasNote) return 'Není co aktualizovat.';
  if (hasStatus && !RESERVATION_STATUSES.has(String(payload.status).trim())) {
    return 'Neplatný stav rezervace.';
  }
  return null;
}

// Seřadí rezervace podle data a času (vzestupně)
function sortReservations(items) {
  return [...items].sort((a, b) => {
    const left = new Date(a.date + 'T' + a.slot + ':00');
    const right = new Date(b.date + 'T' + b.slot + ':00');
    return left - right;
  });
}

// ===== API REQUEST HANDLER =====
// Zpracovává všechny /api/* requesty
async function handleApi(req, res, pathname) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // GET /api/reservations - Vrátí všechny rezervace, auto-kompletuje expirované
  if (pathname === '/api/reservations' && req.method === 'GET') {
    const reservations = await readReservations();
    const { next, changed } = autoCompleteExpiredReservations(reservations);
    if (changed) {
      await writeReservations(next);
    }
    sendJson(res, 200, { reservations: sortReservations(next) });
    return;
  }

  // POST /api/reservations - Vytvoří novou rezervaci
  if (pathname === '/api/reservations' && req.method === 'POST') {
    const payload = await getBody(req);
    const error = validateReservation(payload);
    if (error) {
      sendJson(res, 400, { error });
      return;
    }

    const reservations = await readReservations();
    const duplicate = reservations.find(item => item.date === payload.date && item.slot === payload.slot && item.tableId === payload.tableId);
    if (duplicate) {
      sendJson(res, 409, { error: 'Tenhle stůl je v daném čase už rezervovaný.' });
      return;
    }

    const reservation = normalizeReservation(payload);
    reservations.push(reservation);
    await writeReservations(reservations);
    sendJson(res, 201, { reservation });
    return;
  }

  // DELETE /api/reservations/:id - Smaže rezervaci
  if (pathname.startsWith('/api/reservations/') && req.method === 'DELETE') {
    const id = pathname.split('/').pop();
    const reservations = await readReservations();
    const nextReservations = reservations.filter(item => item.id !== id);
    if (nextReservations.length === reservations.length) {
      sendJson(res, 404, { error: 'Rezervace nebyla nalezena.' });
      return;
    }
    await writeReservations(nextReservations);
    sendJson(res, 200, { ok: true });
    return;
  }

  // PATCH /api/reservations/:id - Aktualizuje status nebo poznámku
  if (pathname.startsWith('/api/reservations/') && req.method === 'PATCH') {
    const id = pathname.split('/').pop();
    const payload = await getBody(req);
    const patchError = validatePatchPayload(payload);
    if (patchError) {
      sendJson(res, 400, { error: patchError });
      return;
    }

    const reservations = await readReservations();
    const index = reservations.findIndex(item => item.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: 'Rezervace nebyla nalezena.' });
      return;
    }

    const current = reservations[index];
    const next = {
      ...current,
      ...(Object.prototype.hasOwnProperty.call(payload, 'status') ? { status: String(payload.status).trim() } : {}),
      ...(Object.prototype.hasOwnProperty.call(payload, 'note') ? { note: String(payload.note || '').trim() } : {}),
      updatedAt: new Date().toISOString()
    };
    reservations[index] = next;
    await writeReservations(reservations);
    sendJson(res, 200, { reservation: next });
    return;
  }

  sendJson(res, 404, { error: 'API endpoint nebyl nalezen.' });
}

// ===== STATIC FILE HANDLER =====
// Serviruje HTML, CSS, JS a ostatní statické soubory
async function handleStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT_DIR, normalized);

  if (!filePath.startsWith(ROOT_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mimeType });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

// ===== HTTP SERVER =====
// Hlavní server - routuje API a static requesty
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }
    await handleStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: 'Interní chyba serveru.', details: error.message });
  }
});

// Spusť server
ensureDataFile().then(() => {
  server.listen(PORT, () => {
    console.log('BarX server running at http://localhost:' + PORT);
  });
});
