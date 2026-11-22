/* ==========================================================================
   Standings – match days and match cards
   ========================================================================== */

function drawMatches(ms) {
  // default: the first match day that is still open (live or not played)
  const days = [...new Set(ms.map(m => m.week))];
  const open = days.find(d => ms.some(m => m.week === d && (isLive(m) || !played(m))));
  if (!days.includes(DAY)) DAY = open ?? days[days.length - 1];

  $('#days').innerHTML = days.map(d => {
    const all = ms.filter(m => m.week === d);
    const lv = all.some(m => isLive(m) && played(m)), fin = all.every(m => played(m) && !isLive(m));
    return `<button class="day ${d === DAY ? 'on' : ''} ${lv ? 'lvd' : ''} ${fin ? 'fin' : ''}" data-day="${esc(d)}" aria-pressed="${d === DAY}">${esc(d)}</button>`;
  }).join('');

  const list = ms.filter(m => m.week === DAY);
  const date = [...new Set(list.map(m => m.date).filter(Boolean))].join(', ');
  $('#dayTitle').innerHTML = `Match Day ${esc(DAY)}` + (date ? `<small>${esc(date)}</small>` : '');

  $('#weeks').innerHTML = list.map(m => {
    const live = isLive(m), done = played(m);
    const w1 = done && !live && m.s1 > m.s2, w2 = done && !live && m.s2 > m.s1;
    const status = live ? '<em class="livetag">Live</em>' : done ? 'Final' : (m.date ? esc(m.date) : 'Upcoming');
    const row = (name, score, win, lose) =>
      `<div class="mr ${win ? 'win' : ''} ${lose ? 'lose' : ''}">${logo(name, '')}<button class="tn" data-team="${esc(name)}">${esc(name)}</button><span class="ms">${score ?? '–'}</span></div>`;
    return `<li class="match frame ${live ? 'live' : ''} ${done ? '' : 'up'}">
      <div class="mh"><span>${status}</span></div>
      ${row(m.t1, done ? m.s1 : null, w1, w2)}${row(m.t2, done ? m.s2 : null, w2, w1)}</li>`;
  }).join('');
}
