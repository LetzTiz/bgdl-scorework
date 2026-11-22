/* ==========================================================================
   Standings – start-up, events, loading and drawing the page
   ========================================================================== */

$('#league').textContent = CONFIG.league;
$('#season').textContent = CONFIG.season;
$('#foot').textContent   = `${CONFIG.league} — ${CONFIG.season}`;
document.title = CONFIG.league + ' – Standings';

// "Count live matches" is remembered per browser
try { const v = localStorage.getItem('gdl-inc-live'); if (v !== null) $('#incLive').checked = v === '1'; } catch (e) {}
$('#incLive').addEventListener('change', e => { try { localStorage.setItem('gdl-inc-live', e.target.checked ? '1' : '0'); } catch (_) {} draw(); });

// clicks: division tabs, match days, team names (roster), closing the roster
document.addEventListener('click', e => {
  const dv = e.target.closest('[data-div]');
  if (dv) { DIV = dv.dataset.div; DAY = null; history.replaceState(null, '', '#' + DIV); draw(); return; }
  const day = e.target.closest('[data-day]');
  if (day) { DAY = day.dataset.day; draw(); return; }
  const team = e.target.closest('[data-team]');
  if (team) { openRoster(team.dataset.team); return; }
  if (e.target === $('#roster') || e.target.closest('#rClose')) closeRoster();
});
addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (DIVS.some(d => d.id === h) && h !== DIV) { DIV = h; DAY = null; draw(); }
});

// Draw everything for the shown division
function draw() {
  if (!DATA) return;
  const inc = $('#incLive').checked;
  const dv = DIVS.find(d => d.id === DIV), dd = (DATA.div || {})[DIV] || {};
  const ms = dd.matches || [];

  drawDivisionTabs();
  $('#empty').hidden = ms.length > 0;
  $('#empty').textContent = dd.err
    ? `The ${dv.name} schedule could not be read (${dd.err}). It should be a tab called “${dv.tab}” with the same columns as the Gold League schedule.`
    : `No matches for the ${dv.name} yet.`;
  $('#tblWrap').hidden = !ms.length;
  $('#matchWrap').hidden = !ms.length;
  if (!ms.length) return;

  drawTable(dv, ms, inc);
  drawMatches(ms);
}

// Load all tabs from the sheet
async function load() {
  if (!SHEET) {
    DATA = DEMO;
    $('#notice').innerHTML = '<p class="note">These are example results. Add the sheet link in config.js to show the real league.</p>';
    $('#updated').textContent = 'Example data'; draw(); return;
  }
  const div = {}; let anyOk = false, firstErr = '';
  for (const d of DIVS) {
    try { div[d.id] = { matches: parseMatches(await loadTabRows(SHEET, d.tab)) }; anyOk = true; }
    catch (e) { div[d.id] = { matches: [], err: e.message || 'could not load' }; if (!firstErr) firstErr = div[d.id].err; }
  }
  if (anyOk) {
    let teams = DATA?.teams || [], roster = DATA?.roster || [];
    try { teams  = parseTeams(await loadTabRows(SHEET, CONFIG.teamsTab)); } catch (e) {}
    try { roster = parseRoster(await loadTabRows(SHEET, CONFIG.rosterTab)); } catch (e) {}
    DATA = { div, teams, roster }; lastOk = new Date(); lastErr = '';
    $('#notice').innerHTML = '';
  } else {
    lastErr = firstErr;
    const hadData = !!DATA && DATA !== DEMO;
    if (!DATA) DATA = DEMO;
    $('#notice').innerHTML = IN_PREVIEW
      ? `<p class="note">This preview can't reach Google Sheets, so you're looking at example results. The hosted page shows the real table.</p>`
      : `<p class="note bad">Couldn't load the sheet (${esc(lastErr)}). Make sure it's shared as “Anyone with the link can view”. ${hadData ? 'You are seeing the last results that loaded.' : 'You are seeing example results.'}</p>`;
  }
  $('#updated').textContent = lastOk ? `Last updated ${lastOk.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
  draw();
}

load();
setInterval(load, CONFIG.refreshSeconds * 1000);
