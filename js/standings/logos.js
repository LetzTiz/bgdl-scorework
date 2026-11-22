/* ==========================================================================
   Standings – team logos
   Order: link from the Teams tab -> logos/<team>.<png|webp|gif|jpg|jpeg|svg> -> empty placeholder
   ========================================================================== */

const LOGO_TYPES = ['png', 'webp', 'gif', 'jpg', 'jpeg', 'svg'];
const LOGO_CACHE = {};   // team name -> working image link, or '' if none was found

// Whatever is in the logo cell -> a direct image link (or '')
function imgUrl(v) {
  let u = String(v || '').trim();
  const f = u.match(/IMAGE\(\s*"([^"]+)"/i); if (f) u = f[1];        // =IMAGE("...") written as text
  if (!/^https?:\/\//i.test(u)) return '';
  const d = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  if (d) return `https://lh3.googleusercontent.com/d/${d[1]}`;        // Google Drive share link -> image
  return u;
}

// "Requiem Aeternam" -> "requiem-aeternam"; apostrophes are dropped ("Classical VIP's" -> "classical-vips"),
// dots become dashes ("S.A.Y.O" -> "s-a-y-o")
const slug = n => String(n).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’`´]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// File names to try for a team: with dots as dashes and with dots left out ("s-a-y-o-kings", "sayo-kings")
function logoFiles(name) {
  if (!CONFIG.logoFolder) return [];
  const names = [...new Set([slug(name), slug(String(name).replace(/\./g, ''))])];
  return names.flatMap(n => LOGO_TYPES.map(t => CONFIG.logoFolder + n + '.' + t));
}

// Empty diamond for the table when a team has no logo
const placeholder = cls => cls === 'lg' ? '<span class="ph" aria-hidden="true"></span>' : '';

// cls: 'lg' = table, '' = match cards, 'big' = roster window
function logo(name, cls) {
  const known = LOGO_CACHE[name];
  if (known === '') return placeholder(cls);                           // already searched, nothing found
  const srcs = known ? [known] : [teamInfo(name).logo, ...logoFiles(name)].filter(Boolean);
  if (!srcs.length) return placeholder(cls);
  return `<img class="${cls}" src="${esc(srcs[0])}" data-team="${esc(name)}" data-alt="${esc(srcs.slice(1).join('|'))}" data-ph="${esc(placeholder(cls))}"
    alt="" loading="lazy" onload="logoOk(this)" onerror="logoFail(this)">`;
}

// An image loaded: remember it for this team
function logoOk(img) { LOGO_CACHE[img.dataset.team] = img.getAttribute('src'); }

// An image didn't load: try the next file, then fall back
function logoFail(img) {
  const rest = (img.dataset.alt || '').split('|').filter(Boolean);
  if (rest.length) { img.dataset.alt = rest.slice(1).join('|'); img.src = rest[0]; return; }
  LOGO_CACHE[img.dataset.team] = '';
  const host = img.closest('#rLogo'); if (host) { host.hidden = true; img.remove(); return; }
  if (img.dataset.ph) img.outerHTML = img.dataset.ph; else img.remove();
}
