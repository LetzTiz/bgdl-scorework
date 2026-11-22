/* ==========================================================================
   Standings – roster window (opens when a team name is clicked)
   ========================================================================== */

function openRoster(name) {
  const t = teamInfo(name);
  const dv = DIVS.find(d => ((DATA.div || {})[d.id]?.matches || []).some(m => m.t1 === name || m.t2 === name));
  const players = (DATA.roster || []).filter(p => norm(p.team) === norm(name)).sort((a, b) => (+a.slot || 99) - (+b.slot || 99));

  $('#rLogo').innerHTML = logo(name, 'big');
  $('#rLogo').hidden = !$('#rLogo').querySelector('img');
  $('#rTitle').textContent = name;
  $('#rMeta').textContent = [t.captain ? `Captain: ${t.captain}` : '', dv ? dv.name : ''].filter(Boolean).join('   ');

  // only show the Country / Hardest columns if anyone has them filled in
  const hasC = players.some(p => p.country), hasH = players.some(p => p.hardest);
  $('#rBody').innerHTML = players.length
    ? `<table class="rt"><thead><tr><th class="l">Player</th>${hasC ? '<th class="l">Country</th>' : ''}${hasH ? '<th class="l">Hardest</th>' : ''}</tr></thead><tbody>` +
      players.map(p => `<tr><td class="l">${esc(p.player)}</td>${hasC ? `<td class="l dim">${esc(p.country)}</td>` : ''}${hasH ? `<td class="l dim">${esc(p.hardest)}</td>` : ''}</tr>`).join('') +
      '</tbody></table>'
    : '<p class="rempty">No players signed yet.</p>';

  const d = $('#roster'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
}

function closeRoster() {
  const d = $('#roster'); if (d.close) d.close(); else d.removeAttribute('open');
}
