// Behaviour + layout check for filter-header.html (run: node check-filter-header.cjs).
// Static frames: every dropdown trigger has a chevron, triggers stay one line, nothing overflows its frame, 44px touch target.
// Live frames (3: basic, full, full EN): padding, AI button right of the search input, one-line horizontally scrolling dropdown row, the owner's collapse motion
// (transition values + an in-between frame), auto-collapse / expand on scroll, deferral while a dropdown is open, floating panel rules, filter dot.
const { createRequire } = require('module');
const path = require('path');
const req = createRequire(path.resolve(__dirname, '../../../../../apps/web/package.json'));
const { chromium } = req('@playwright/test');
const FILE = require('url').pathToFileURL(path.join(__dirname, 'filter-header.html')).href;

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1000 } });
  await p.goto(FILE, { waitUntil: 'load' });
  await p.waitForTimeout(3500);

  // ---- static ----
  const stat = await p.evaluate(() => {
    const trig = [...document.querySelectorAll('[data-dd]')];
    const noChevron = trig.filter((t) => !t.querySelector('[data-chev]')).length;
    const tall = trig.filter((t) => t.getBoundingClientRect().height > 36).length;
    const t0 = trig[0]; const after = getComputedStyle(t0, '::after');
    const touch = Math.round(t0.getBoundingClientRect().height + parseFloat(after.top) * -1 + parseFloat(after.bottom) * -1);
    const aiBtn = document.querySelector('[data-ai]'); const aiAfter = getComputedStyle(aiBtn, '::after');
    const aiTouch = Math.round(aiBtn.getBoundingClientRect().height - parseFloat(aiAfter.top) - parseFloat(aiAfter.bottom));
    const overflow = [...document.querySelectorAll('.outline')].filter((f) => f.scrollWidth > f.clientWidth + 1).length;
    return { n: trig.length, noChevron, tall, touch, aiTouch, overflow };
  });
  ok(stat.n > 20 && stat.noChevron === 0, `all ${stat.n} dropdown triggers have a chevron`);
  ok(stat.tall === 0, 'no trigger wraps to two lines');
  ok(stat.touch >= 44, `trigger touch target ${stat.touch}px (>= 44)`);
  ok(stat.aiTouch >= 44, `AI button touch target ${stat.aiTouch}px (>= 44)`);
  ok(stat.overflow === 0, 'no static frame overflows horizontally');
  const rows = await p.evaluate(() => [...document.querySelectorAll('.outline [data-filter-row]')].map((r) => { const tops = new Set([...r.querySelectorAll('[data-dd]')].map((t) => Math.round(t.getBoundingClientRect().top))); return { lines: tops.size, scrolls: r.scrollWidth > r.clientWidth + 1, ox: getComputedStyle(r).overflowX, wrap: getComputedStyle(r).flexWrap }; }));
  ok(rows.length >= 15 && rows.every((r) => r.lines === 1 && r.wrap === 'nowrap' && r.ox === 'auto'), `all ${rows.length} static dropdown rows are one line (nowrap, overflow-x auto)`);
  ok(rows.some((r) => r.scrolls), `${rows.filter((r) => r.scrolls).length} static rows overflow and scroll (narrow widths / full row)`);

  // ---- live ----
  const n = await p.locator('[data-live]').count();
  ok(n === 3, `3 live frames (${n})`);
  for (let i = 0; i < n; i++) {
    const live = p.locator('[data-live]').nth(i);
    const lang = await live.getAttribute('data-lang'), variant = await live.getAttribute('data-variant');
    const tag = `[${lang}/${variant}]`;
    const sc = live.locator('[data-scroller]');
    const st = async () => live.evaluate((r) => {
      const pb = r.querySelector('[data-pillbox]'), pn = r.querySelector('[data-panel]');
      return { c: r.dataset.collapsed, f: r.dataset.floating, y: r.querySelector('[data-scroller]').scrollTop, h: r.querySelector('[data-scroller]').scrollHeight,
        pill: pb.dataset.open === 'true' && getComputedStyle(pb).visibility === 'visible', panel: pn.dataset.open === 'true', panelH: Math.round(pn.getBoundingClientRect().height), panelOp: parseFloat(getComputedStyle(pn).opacity) };
    });
    // sample inside the page (setTimeout in the page, not a Playwright round trip) so the in-between frame is read at ~100ms
    const sample = (y) => live.evaluate((r, v) => new Promise((res) => {
      const sc = r.querySelector('[data-scroller]'), pn = r.querySelector('[data-panel]');
      sc.scrollTop = v;
      setTimeout(() => res({ panelH: Math.round(pn.getBoundingClientRect().height), panelOp: parseFloat(getComputedStyle(pn).opacity) }), 100);
    }), y);
    const scrollTo = async (y, wait = 500) => { await sc.evaluate((e, v) => { e.scrollTop = v; }, y); await p.waitForTimeout(wait); };

    // padding: search, tab row and cards start at the same x (14px padding + 4px frame border)
    const pad = await live.evaluate((r) => {
      const fr = r.getBoundingClientRect(); const x = (e) => Math.round(e.getBoundingClientRect().left - fr.left);
      const row = r.querySelector('[data-filter-row]'); const first = row.querySelector('[data-dd]');
      const search = r.querySelector('[data-search]'), ai = r.querySelector('[data-ai]');
      const sr = search.getBoundingClientRect(), ar = ai ? ai.getBoundingClientRect() : null;
      return { search: x(search), tabs: x(r.querySelector('[data-content] .border-t')), card: x(r.querySelector('[data-card]')), first: x(first),
        order: [...row.querySelectorAll('[data-dd]')].map((c) => c.dataset.dd).join(','),
        ai: ar ? { right: Math.round(fr.right - ar.right), gap: Math.round(ar.left - sr.right), dy: Math.round((ar.top + ar.height / 2) - (sr.top + sr.height / 2)), h: Math.round(ar.height), sh: Math.round(sr.height) } : null,
        rowLines: new Set([...row.querySelectorAll('[data-dd]')].map((c) => Math.round(c.getBoundingClientRect().top))).size,
        scrolls: row.scrollWidth > row.clientWidth + 1, rowW: row.clientWidth, rowSW: row.scrollWidth, rowH: row.clientHeight, chipH: Math.round(first.getBoundingClientRect().height), ox: getComputedStyle(row).overflowX, rowLeft: Math.round(row.getBoundingClientRect().left - fr.left), rowRight: Math.round(fr.right - row.getBoundingClientRect().right) };
    });
    ok(pad.search === 18 && pad.tabs === 18 && pad.card === 18 && pad.first === 18, `${tag} search, first chip, tab row and cards all start at 18px (${JSON.stringify([pad.search, pad.first, pad.tabs, pad.card])})`);
    const want = variant === 'basic' ? 'time,type,cat' : 'time,type,cat,nearby';
    ok(pad.order === want, `${tag} dropdown order ${pad.order}`);
    ok(pad.rowLines === 1 && pad.ox === 'auto', `${tag} dropdown row is one line and scrolls horizontally`);
    ok(pad.rowH >= pad.chipH + 16, `${tag} scroll port keeps the 8px above and below each chip (touch target not clipped: ${pad.rowH} >= ${pad.chipH + 16})`);
    ok(pad.rowLeft <= 4 && pad.rowRight <= 4, `${tag} scrolling row bleeds to the screen edge (${pad.rowLeft}/${pad.rowRight}px incl. frame border)`);
    if (variant === 'basic') ok(!pad.ai, `${tag} no AI button in the basic frame`);
    else {
      ok(pad.ai && pad.ai.gap === 8 && Math.abs(pad.ai.dy) <= 1 && pad.ai.h === pad.ai.sh, `${tag} AI button is right of the search input, same height and centre (${JSON.stringify(pad.ai)})`);
      ok(pad.ai.right === 18, `${tag} AI button right edge aligns with the cards (${pad.ai.right}px from the frame edge)`);
      ok(pad.rowSW <= pad.rowW + 1 || pad.scrolls, `${tag} full row fits at 390px (scrollWidth ${pad.rowSW} vs ${pad.rowW}); narrower widths scroll (checked in the static frames)`);
    }

    await scrollTo(0);
    let s = await st(); ok(s.c === 'false' && s.panel && !s.pill, `${tag} top: header expanded`);
    await scrollTo(120);
    s = await st(); ok(s.c === 'false', `${tag} 120px: still expanded (below header height)`);

    // motion: same values as the owner's .filter-collapse, and an in-between frame while collapsing
    const motion = await live.evaluate((r) => { const cs = getComputedStyle(r.querySelector('[data-panel]')); return { prop: cs.transitionProperty, dur: cs.transitionDuration, ease: cs.transitionTimingFunction }; });
    ok(/max-height/.test(motion.prop) && /0\.28s/.test(motion.dur) && /0\.22s/.test(motion.dur) && /cubic-bezier\(0\.4, 0, 0\.2, 1\)/.test(motion.ease), `${tag} panel transition = max-height .28s cubic-bezier(.4,0,.2,1) + opacity .22s (${motion.dur})`);
    const full = (await st()).panelH;
    const mid = await sample(700);
    ok(mid.panelH > 0 && mid.panelH < full && mid.panelOp > 0 && mid.panelOp < 1, `${tag} mid-collapse frame is in between (height ${mid.panelH} of ${full}, opacity ${mid.panelOp})`);
    await p.waitForTimeout(450);
    s = await st(); ok(s.c === 'true' && s.pill && !s.panel && s.panelH === 0, `${tag} 700px: collapsed to the pill (panel height ${s.panelH})`);
    const mid2 = await sample(0);
    ok(mid2.panelH > 0 && mid2.panelH < full, `${tag} mid-expand frame is in between (height ${mid2.panelH} of ${full})`);
    await p.waitForTimeout(450);
    s = await st(); ok(s.c === 'false' && s.panel && !s.pill && Math.abs(s.panelH - full) <= 2, `${tag} back to top: expanded again (${s.panelH} vs ${full})`);

    // dropdown open defers collapse
    await live.locator('[data-dd="time"]').click();
    ok(await live.locator('[data-drawer="time"]').isVisible(), `${tag} time drawer opens`);
    await scrollTo(700);
    s = await st(); ok(s.c === 'false', `${tag} open dropdown defers the collapse`);
    await scrollTo(0);
    const week = await live.evaluate((r) => r.querySelectorAll('[data-drawer="time"] button')[1].textContent);
    await live.locator('[data-drawer="time"] button').nth(1).click();
    ok((await live.locator('[data-dd="time"] [data-label]').textContent()) === week, `${tag} picking "${week}" updates the trigger label`);
    ok(await live.locator('[data-reset]').isVisible(), `${tag} reset appears once a filter is active`);

    if (variant === 'full') {
      await live.locator('[data-dd="nearby"]').scrollIntoViewIfNeeded();
      await live.locator('[data-dd="nearby"]').click();
      ok(await live.locator('[data-drawer="nearby"]').isVisible(), `${tag} nearby drawer opens`);
      await live.locator('[data-drawer="nearby"] button').nth(3).click();
      const lab = (await live.locator('[data-dd="nearby"] [data-label]').textContent()).trim();
      ok(/5 km$/.test(lab), `${tag} nearby active label "${lab}"`);
      // reset stays reachable: sticky at the right edge even when the row is scrolled back to the start
      await live.locator('[data-filter-row]').evaluate((e) => { e.scrollLeft = 0; });
      const rs = await live.evaluate((r) => { const fr = r.getBoundingClientRect(), b = r.querySelector('[data-reset]').getBoundingClientRect(); return { right: Math.round(fr.right - b.right), vis: b.width > 0 && b.left < fr.right }; });
      ok(rs.vis && rs.right === 18, `${tag} reset icon is visible, aligned to the 14px page padding, not overlapping a chip (${rs.right}px from the frame edge)`);
      await live.locator('[data-reset]').click();
      const idleLab = (await live.locator('[data-dd="nearby"] [data-label]').textContent()).trim();
      ok(idleLab === (lang === 'en' ? 'Nearby' : 'Terdekat'), `${tag} reset restores the idle nearby label "${idleLab}"`);
      await live.locator('[data-filter-row]').evaluate((e) => { e.scrollLeft = 0; });
      await live.locator('[data-dd="time"]').click(); await live.locator('[data-drawer="time"] button').nth(1).click();
    }
    await scrollTo(700);
    s = await st(); ok(s.c === 'true', `${tag} closed dropdown: collapses`);
    ok(await live.locator('[data-dot]').isVisible(), `${tag} active-filter dot shows on the pill`);

    // floating panel
    const before = (await st()).h;
    const mid3 = await live.evaluate((r) => new Promise((res) => {
      const pn = r.querySelector('[data-panel]'); r.querySelector('[data-pill]').click();
      setTimeout(() => res({ panelH: Math.round(pn.getBoundingClientRect().height), panelOp: parseFloat(getComputedStyle(pn).opacity) }), 100);
    }));
    ok(mid3.panelH > 0 && mid3.panelOp < 1, `${tag} floating panel fades in (height ${mid3.panelH}, opacity ${mid3.panelOp})`);
    await p.waitForTimeout(450);
    s = await st(); ok(s.f === 'true' && s.panel && s.panelH > 100, `${tag} tap pill: floating panel opens (${s.panelH}px)`);
    ok(s.h === before, `${tag} floating panel does not change the document height (${before} -> ${s.h})`);
    await scrollTo(s.y + 10, 200);
    ok((await st()).f === 'true', `${tag} scroll 10px: panel stays`);
    await scrollTo(s.y + 60, 500);
    s = await st(); ok(s.f === 'false' && !s.panel && s.panelH === 0, `${tag} scroll > 32px: panel closes`);
    await live.locator('[data-pill]').click(); await p.keyboard.press('Escape'); await p.waitForTimeout(450);
    ok((await st()).f === 'false', `${tag} Esc closes the panel`);
    await live.locator('[data-pill]').click(); await p.waitForTimeout(450); await p.mouse.click(1850, 20); await p.waitForTimeout(450);
    ok((await st()).f === 'false', `${tag} outside press closes the panel`);
    await scrollTo(0, 700);
    s = await st(); ok(s.c === 'false' && s.f === 'false' && s.panel, `${tag} back to top: expanded, panel closed`);
  }

  const out = process.env.TEMP || '.';
  await p.locator('[data-live]').nth(0).scrollIntoViewIfNeeded();
  await p.locator('[data-live]').nth(0).screenshot({ path: path.join(out, 'filter-live-basic.png') });
  await p.locator('[data-live]').nth(1).screenshot({ path: path.join(out, 'filter-live-full.png') });
  
  await b.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nall checks passed');
  process.exit(fails ? 1 : 0);
})();
