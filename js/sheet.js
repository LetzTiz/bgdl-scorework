/* ==========================================================================
   Google Sheet loading – shared by the standings page and the overlay
   ========================================================================== */

const norm = s => String(s || '').trim().toLowerCase();
const lc   = s => norm(s).replace(/\s+/g, ' ');
const num  = v => { const t = String(v ?? '').trim().replace(',', '.'); return t === '' ? null : (Number.isFinite(+t) ? +t : null); };

// true inside the claude.ai preview, which may not load data from Google
const IN_PREVIEW = /claude\.ai$|claudeusercontent|anthropic/.test(location.hostname);

// CSV text -> array of rows (handles quotes, commas and line breaks inside quotes)
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

// The spreadsheet id from a normal sheet link
function sheetId(u) {
  const m = String(u || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m && m[1] !== 'e' ? m[1] : null;
}

// Fallback: Google's JSONP endpoint, loaded as a script (works where fetch is blocked, e.g. file:// pages)
function jsonpTab(id, tab) {
  return new Promise((resolve, reject) => {
    const cb = '__gdl' + Math.random().toString(36).slice(2);
    const sc = document.createElement('script');
    const done = (fn, v) => { clearTimeout(to); try { delete window[cb]; } catch (e) { window[cb] = undefined; } sc.remove(); fn(v); };
    const to = setTimeout(() => done(reject, new Error('timeout')), 12000);
    window[cb] = res => {
      if (!res || res.status === 'error') return done(reject, new Error((res && res.errors && res.errors[0] && res.errors[0].detailed_message) || 'sheet error'));
      const t = res.table; const rows = [];
      const labels = t.cols.map(c => c.label || ''); if (labels.some(x => x)) rows.push(labels);
      t.rows.forEach(r => rows.push((r.c || []).map(c => c == null ? '' : (c.f != null ? String(c.f) : (c.v == null ? '' : String(c.v))))));
      done(resolve, rows);
    };
    sc.onerror = () => done(reject, new Error('blocked'));
    sc.src = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json;responseHandler:${cb}&sheet=${encodeURIComponent(tab)}&headers=0&_=${Date.now()}`;
    document.head.appendChild(sc);
  });
}

// Load one tab as rows: first as CSV via fetch, then via JSONP if the browser blocks that
async function loadTabRows(url, tab) {
  const id = sheetId(url);
  try {
    const r = await fetch(id ? `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&headers=0` : url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return parseCSV(await r.text());
  } catch (e) {
    if (!id) throw e;
    return await jsonpTab(id, tab);
  }
}

// Find the header row (the sheet has a title row above it) that contains all `must` labels
function headerOf(rows, must) {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const h = rows[i].map(lc);
    if (must.every(n => h.some(x => x.includes(n)))) return { i, h };
  }
  return null;
}

// Column index by label: exact match first, then partial
function idx(h, ...names) {
  for (const n of names) { const k = h.findIndex(x => x === n); if (k >= 0) return k; }
  for (const n of names) { const k = h.findIndex(x => x.endsWith(n) || x.includes(n)); if (k >= 0) return k; }
  return -1;
}

// Schedule tab -> matches
// {no, week, date, t1, t2, l1, l2, s1, s2, status:'live'|''}  (s1/s2 null = not played yet)
function parseMatches(rows) {
  if (!rows.length) throw new Error('the Schedule tab is empty');
  const H = headerOf(rows, ['team a', 'team b']);
  if (!H) throw new Error('no "Team A" / "Team B" columns found');
  const h = H.h;
  const c = { no: idx(h, 'no.', 'no'), day: idx(h, 'match day', 'matchday'), date: idx(h, 'date'), a: idx(h, 'team a'), b: idx(h, 'team b'),
              l1: idx(h, 'level 1'), l2: idx(h, 'level 2'), pa: idx(h, 'points a'), pb: idx(h, 'points b'), pl: idx(h, 'played') };
  // Google's export can blank out header labels in number columns: fall back to the sheet's fixed order
  const off = { no: -3, day: -2, date: -1, b: 1, l1: 2, l2: 3, pa: 4, pb: 5, pl: 7 };
  for (const k in off) if (c[k] < 0 && c.a + off[k] >= 0) c[k] = c.a + off[k];
  const get = (r, k) => c[k] >= 0 ? (r[c[k]] ?? '').trim() : '';
  return rows.slice(H.i + 1).map(r => {
    const s1 = num(get(r, 'pa')), s2 = num(get(r, 'pb'));
    const pv = lc(get(r, 'pl')); const done = pv === '1' || pv === 'true' || pv === 'yes' || pv === 'x';
    const hasScore = s1 !== null && s2 !== null;
    return { no: get(r, 'no'), week: get(r, 'day') || '–', date: get(r, 'date'), t1: get(r, 'a'), t2: get(r, 'b'),
             l1: get(r, 'l1'), l2: get(r, 'l2'), s1: hasScore ? s1 : null, s2: hasScore ? s2 : null,
             status: hasScore && !done ? 'live' : '' };
  }).filter(m => m.t1 && m.t2);
}
