/* ==========================================================================
   Standings – shared state and small helpers
   ========================================================================== */

const $   = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ?sheet=LINK in the address overrides the sheet from config.js
const SHEET = new URLSearchParams(location.search).get('sheet') || CONFIG.sheetUrl;
const DIVS  = CONFIG.divisions;

let DATA = null;          // { div: {gold:{matches,err}, silver:{...}}, teams:[], roster:[] }
let lastOk = null, lastErr = '';
let DIV = DIVS.some(d => '#' + d.id === location.hash) ? location.hash.slice(1) : DIVS[0].id;   // shown division
let DAY = null;           // shown match day

function teamInfo(name) { return (DATA.teams || []).find(t => norm(t.name) === norm(name)) || {}; }
