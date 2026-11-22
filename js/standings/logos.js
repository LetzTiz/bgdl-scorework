/* ==========================================================================
   Standings – team logos
   Order: link from the Teams tab -> logos/<team>.png -> empty placeholder
   ========================================================================== */

// Whatever is in the logo cell -> a direct image link (or '')
function imgUrl(v) {
  let u = String(v || '').trim();
  const f = u.match(/IMAGE\(\s*"([^"]+)"/i); if (f) u = f[1];        // =IMAGE("...") written as text
  if (!/^https?:\/\//i.test(u)) return '';
  const d = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  if (d) return `https://lh3.googleusercontent.com/d/${d[1]}`;        // Google Drive share link -> image
  return u;
}

// "Requiem Aeternam" -> "requiem-aeternam"
const slug = n => String(n).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Empty diamond for the table when a team has no logo
const placeholder = cls => cls === 'lg' ? '<span class="ph" aria-hidden="true"></span>' : '';

// cls: 'lg' = table, '' = match cards, 'big' = roster window
function logo(name, cls) {
  const srcs = [teamInfo(name).logo, CONFIG.logoFolder ? CONFIG.logoFolder + slug(name) + '.png' : ''].filter(Boolean);
  if (!srcs.length) return placeholder(cls);
  return `<img class="${cls}" src="${esc(srcs[0])}" data-alt="${esc(srcs.slice(1).join('|'))}" data-ph="${esc(placeholder(cls))}" alt="" loading="lazy" onerror="logoFail(this)">`;
}

// An image didn't load: try the next source, then fall back
function logoFail(img) {
  const rest = (img.dataset.alt || '').split('|').filter(Boolean);
  if (rest.length) { img.dataset.alt = rest.slice(1).join('|'); img.src = rest[0]; return; }
  const host = img.closest('#rLogo'); if (host) { host.hidden = true; img.remove(); return; }
  if (img.dataset.ph) img.outerHTML = img.dataset.ph; else img.remove();
}
