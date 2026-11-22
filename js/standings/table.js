/* ==========================================================================
   Standings – league table
   ========================================================================== */

const played = m => Number.isFinite(m.s1) && Number.isFinite(m.s2);
const isLive = m => m.status === 'live';

// Matches -> sorted table rows. withLive = count live matches with their current score.
function computeTable(matches, withLive) {
  const T = new Map();
  const team = n => { if (!T.has(n)) T.set(n, { name: n, p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0, form: [], live: false }); return T.get(n); };
  for (const m of matches) {
    const a = team(m.t1), b = team(m.t2);
    if (!played(m)) continue;
    if (isLive(m) && !withLive) continue;
    a.p++; b.p++; a.pf += m.s1; a.pa += m.s2; b.pf += m.s2; b.pa += m.s1;
    const ra = m.s1 > m.s2 ? 'W' : m.s1 < m.s2 ? 'L' : 'D', rb = ra === 'W' ? 'L' : ra === 'L' ? 'W' : 'D';
    a.pts += ra === 'W' ? 3 : ra === 'D' ? 1 : 0; b.pts += rb === 'W' ? 3 : rb === 'D' ? 1 : 0;
    const k = { W: 'w', D: 'd', L: 'l' }; a[k[ra]]++; b[k[rb]]++;
    if (!isLive(m)) { a.form.push(ra); b.form.push(rb); } else { a.live = b.live = true; }
  }
  const rows = [...T.values()]; rows.forEach(r => r.diff = r.pf - r.pa);
  // tiebreakers: league points, then difference, then points scored
  rows.sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.pf - x.pf || x.name.localeCompare(y.name));
  rows.forEach((r, i) => r.rank = i + 1);
  return rows;
}

// Gold / Silver switch
function drawDivisionTabs() {
  $('#divs').innerHTML = DIVS.map(d =>
    `<button class="div ${d.id} ${d.id === DIV ? 'on' : ''}" data-div="${d.id}" aria-pressed="${d.id === DIV}">${esc(d.name)}</button>`).join('');
}

// Table, zones and legend for one division
function drawTable(dv, ms, inc) {
  const anyLive = ms.some(m => isLive(m) && played(m));
  const base = computeTable(ms, false), cur = computeTable(ms, inc);
  const n = cur.length;
  const zoneOf = rank => { for (const z of dv.zones || []) { if (z.from === 'top' ? rank <= z.count : rank > n - z.count) return z.kind; } return ''; };

  $('#tblTitle').textContent = dv.name;
  $('#liveTag').hidden = !(anyLive && inc);
  $('#legend').innerHTML = (dv.zones || []).map(z => `<span class="lg-${z.kind}">${z.from === 'top' ? 'Top' : 'Bottom'} ${z.count}: ${esc(z.label)}</span>`).join('');

  $('#tbl').innerHTML =
    `<thead><tr><th class="rk">#</th><th class="l">Team</th><th title="Played">P</th><th class="wdl" title="Won">W</th><th class="wdl" title="Drawn">D</th><th class="wdl" title="Lost">L</th>` +
    `<th class="opt" title="Points scored – against">PF–PA</th><th title="Difference">+/−</th><th class="pts" title="League points">Pts</th><th class="opt">Form</th></tr></thead><tbody>` +
    cur.map(r => {
      const b = base.find(x => x.name === r.name);
      const mv = inc && anyLive && b && b.rank !== r.rank ? (b.rank > r.rank ? '<span class="mv up">▲</span>' : '<span class="mv dn">▼</span>') : '';
      const f = r.form.slice(-5); const form = [...Array(5 - f.length).fill(''), ...f].map(x => `<i class="f${x}">${x}</i>`).join('');
      return `<tr class="z-${zoneOf(r.rank)} ${r.live && inc ? 'inlive' : ''}">
        <td class="rk">${String(r.rank).padStart(2, '0')}${mv}</td>
        <td class="team l">${logo(r.name, 'lg')}<button class="nm" data-team="${esc(r.name)}">${esc(r.name)}</button>${r.live && inc ? ' <em class="livetag">Live</em>' : ''}</td>
        <td>${r.p}</td><td class="wdl">${r.w}</td><td class="wdl">${r.d}</td><td class="wdl">${r.l}</td>
        <td class="opt dim">${r.pf}–${r.pa}</td>
        <td>${r.diff > 0 ? '+' : ''}${r.diff}</td>
        <td class="pts">${r.pts}</td><td class="opt"><span class="form">${form}</span></td></tr>`;
    }).join('') + '</tbody>';
}
