/* ==========================================================================
   Standings – Teams and Roster tabs
   ========================================================================== */

// Teams tab -> [{name, captain, logo}]
function parseTeams(rows) {
  const H = headerOf(rows, ['team name']); if (!H) return [];
  const iN = idx(H.h, 'team name'), iL = idx(H.h, 'logo url', 'logo link', 'logo'), iM = idx(H.h, 'manager / captain', 'manager', 'captain');
  return rows.slice(H.i + 1).map(r => ({
    name: (r[iN] || '').trim(),
    logo: iL >= 0 ? imgUrl(r[iL]) : '',
    captain: iM >= 0 ? (r[iM] || '').trim() : '',
  })).filter(t => t.name);
}

// Roster tab -> [{team, slot, player, country, hardest, price}]  (empty slots are skipped)
function parseRoster(rows) {
  const H = headerOf(rows, ['player', 'slot']); if (!H) return [];
  const c = { team: idx(H.h, 'team'), slot: idx(H.h, 'slot'), player: idx(H.h, 'player'), country: idx(H.h, 'country'),
              hardest: idx(H.h, 'hardest'), price: idx(H.h, 'price (orbs)', 'price') };
  return rows.slice(H.i + 1).map(r => {
    const v = k => c[k] >= 0 ? String(r[c[k]] ?? '').trim() : '';
    return { team: v('team'), slot: v('slot'), player: v('player'), country: v('country'), hardest: v('hardest'), price: v('price') };
  }).filter(x => x.team && x.player);
}
