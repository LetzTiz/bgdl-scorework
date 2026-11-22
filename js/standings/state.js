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

// Example data, shown when no sheet is set or it can't be loaded
const DEMO = {
  div: {
    gold: { matches: [
      { week: '1', t1: 'Goober', s1: 8, s2: 2, t2: 'Team 20', status: '', l1: 'Open Window', l2: 'Society' },
      { week: '1', t1: 'Requiem Aeternam', s1: 6, s2: 4, t2: 'Hotel For Life', status: '', l1: '', l2: '' },
      { week: '1', t1: 'Hivemind', s1: 5, s2: 5, t2: 'Team 13', status: '', l1: '', l2: '' },
      { week: '1', t1: 'Near Miss', s1: 3, s2: 7, t2: 'Team 12', status: '', l1: '', l2: '' },
      { week: '2', t1: 'Hotel For Life', s1: 5, s2: 3, t2: 'Hivemind', status: 'live', l1: 'Bloodbath', l2: '' },
      { week: '2', t1: 'Requiem Aeternam', s1: null, s2: null, t2: 'Near Miss', status: '', l1: '', l2: '' },
      { week: '2', t1: 'Team 13', s1: null, s2: null, t2: 'Goober', status: '', l1: '', l2: '' },
      { week: '2', t1: 'Team 12', s1: null, s2: null, t2: 'Team 20', status: '', l1: '', l2: '' } ] },
    silver: { matches: [
      { week: '1', t1: 'TML', s1: 7, s2: 3, t2: 'Ignition', status: '', l1: '', l2: '' },
      { week: '1', t1: 'SAYO Kings', s1: 5, s2: 5, t2: 'Gmail', status: '', l1: '', l2: '' },
      { week: '1', t1: "Fightin' Dashers", s1: 8, s2: 2, t2: 'Team Ember', status: '', l1: '', l2: '' },
      { week: '1', t1: 'The Losers', s1: 2, s2: 8, t2: 'Brodiac', status: '', l1: '', l2: '' },
      { week: '2', t1: 'Ignition', s1: null, s2: null, t2: "Fightin' Dashers", status: '', l1: '', l2: '' },
      { week: '2', t1: 'Brodiac', s1: null, s2: null, t2: 'TML', status: '', l1: '', l2: '' } ] },
  },
  roster: [
    { team: 'Requiem Aeternam', slot: '1', player: 'LetzTiz', country: 'Germany', hardest: 'Bloodbath', price: '120' },
    { team: 'Requiem Aeternam', slot: '2', player: 'Player Two', country: '', hardest: '', price: '' } ],
  teams: [ { name: 'Goober', captain: 'Axel' }, { name: 'Requiem Aeternam', captain: 'LetzTiz' }, { name: 'Hivemind', captain: 'Talci' },
           { name: 'Hotel For Life', captain: 'Nando7' }, { name: "Fightin' Dashers", captain: 'eliwowwowwow' } ],
};
