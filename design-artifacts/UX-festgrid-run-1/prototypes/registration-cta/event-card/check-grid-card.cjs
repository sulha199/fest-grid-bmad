// Layout check for grid-card-owner-layout.html, every language x highlight length x width.
// HARD failures (exit 1): badge wraps to 2 lines, badge touches the heart button, left footer slot wraps, gap between left and right slot under 1em,
//   wrong text size (10px expected only when the card is < 145px wide, else 12px), card width off.
// SOFT (reported, not failures): title / highlight clipped at 2 lines, location ellipsis, event type ellipsis.
const { createRequire } = require('module');
const req = createRequire('c:/projects/portfolio/festgrid/bmad/apps/web/package.json');
const { chromium } = req('@playwright/test');
const FILE = require('url').pathToFileURL(require('path').join(__dirname, 'grid-card-owner-layout.html')).href;
const EXPECT_CARD = { 390: 174, 360: 159, 340: 149, 320: 139 };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  await p.goto(FILE, { waitUntil: 'load' });
  await p.waitForTimeout(3000); // Tailwind CDN + Font Awesome
  const res = await p.evaluate(() => [...document.querySelectorAll('[data-frame]')].map((f) => {
    const cards = [...f.querySelectorAll('[data-card]')].map((a, i) => {
      const fs = (e) => parseFloat(getComputedStyle(e).fontSize);
      const badge = a.querySelector('[data-badge]'), heart = a.querySelector('[data-heart]');
      const br = badge.getBoundingClientRect(), hr = heart.getBoundingClientRect();
      const left = a.querySelector('[data-left]'), type = a.querySelector('[data-type]'), green = a.querySelector('[data-green]');
      const title = a.querySelector('[data-title]'), loc = a.querySelector('[data-loc]');
      const lfs = fs(left);
      return {
        i: i + 1, w: Math.round(a.getBoundingClientRect().width),
        badgeFs: fs(badge), footFs: lfs,
        badgeWrap: br.height > fs(badge) * 2.2, badgeGap: Math.round(hr.left - br.right),
        leftWrap: left.getBoundingClientRect().height > lfs * 2.6,
        titleClip: title.scrollHeight > title.clientHeight + 1,
        greenClip: green ? green.scrollHeight > green.clientHeight + 1 : false,
        locClip: loc.scrollWidth > loc.clientWidth + 1,
        gapEm: type ? +((type.getBoundingClientRect().left - left.getBoundingClientRect().right) / lfs).toFixed(2) : null,
        typeClip: type ? type.scrollWidth > type.clientWidth + 1 : false,
      };
    });
    return { lang: f.dataset.lang, w: +f.dataset.w, short: f.dataset.short === '1', cards };
  }));
  let hard = 0;
  console.log('lang short  width card | hard fails | soft: title/highlight/location/type clipped (card numbers)');
  for (const r of res) {
    const wantFs = (c) => (c.w < 145 ? 10 : 12);
    const fails = [];
    for (const c of r.cards) {
      if (c.badgeWrap) fails.push(`#${c.i} badge wraps`);
      if (c.badgeGap < 2) fails.push(`#${c.i} badge touches heart (gap ${c.badgeGap}px)`);
      if (c.gapEm !== null && c.gapEm < 0.99) fails.push(`#${c.i} gap between left and right slot ${c.gapEm}em, expected >= 1em`);
      if (c.leftWrap) fails.push(`#${c.i} left slot wraps`);
      if (c.badgeFs !== wantFs(c) || c.footFs !== wantFs(c)) fails.push(`#${c.i} text ${c.badgeFs}/${c.footFs}px, expected ${wantFs(c)}`);
      if (c.w !== EXPECT_CARD[r.w]) fails.push(`#${c.i} card ${c.w}px, expected ${EXPECT_CARD[r.w]}`);
    }
    hard += fails.length;
    const list = (k) => r.cards.filter((c) => c[k]).map((c) => c.i).join(',') || '-';
    console.log(`${r.lang}   ${r.short ? 'short' : 'long '}  ${String(r.w).padStart(4)} ${r.cards[0].w}px | ${fails.length ? 'FAIL ' + fails.join('; ') : 'ok'} | title ${list('titleClip')} | hl ${list('greenClip')} | loc ${list('locClip')} | type ${list('typeClip')}`);
  }
  console.log(hard ? `\n${hard} HARD failure(s)` : '\nno hard failures');
  await b.close();
  process.exit(hard ? 1 : 0);
})();
