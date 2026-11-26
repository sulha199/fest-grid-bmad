// POC (owner, 2026-11-26): can a deterministic OCR step find the event names on a carousel's slides, instead of the slide-map model call?
// tesseract.js (WASM, eng + ind) reads each slide; code matches the distinctive words of each event name against the slide text; the same
// cover rule as the model route (slide-cover.mjs) then picks a slide. Same 6 carousels and event names as findings 11.13.
//   node slide-ocr.mjs [--maxImages 6]        output: private/slide-ocr.json (gitignored), summary on stdout
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createWorker } from 'tesseract.js';
import { decideCovers } from './slide-cover.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const maxImages = Number(arg('maxImages', 6));
const names = JSON.parse(readFileSync('private/slide-map-names-prod.json', 'utf8'));
mkdirSync('private/tessdata', { recursive: true });
const worker = await createWorker(['eng', 'ind'], 1, { cachePath: 'private/tessdata' });

const words = (s) => String(s ?? '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !/^20\d\d$/.test(w));
const result = {};
let totalMs = 0, images = 0, maxRss = 0;
for (const [pid, evs] of Object.entries(names)) {
  const slides = [];
  for (let i = 0; i < maxImages; i++) {
    const f = `private/img/${pid}-${i}.jpg`;
    if (!existsSync(f)) break;
    const t0 = Date.now();
    const { data } = await worker.recognize(f);
    totalMs += Date.now() - t0; images++; maxRss = Math.max(maxRss, process.memoryUsage().rss);
    slides.push({ slide: i + 1, text: data.text });
  }
  // distinctive words of a name: those that are not in every other name of the post (with one event, all of them)
  const sets = evs.map((n) => new Set(words(n)));
  const distinct = sets.map((s, i) => { const common = [...s].filter((w) => evs.length > 1 && sets.every((o, j) => j === i || o.has(w))); const d = [...s].filter((w) => !common.includes(w)); return d.length ? d : [...s]; });
  const mapped = slides.map(({ slide, text }) => {
    const flat = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
    return { slide, events: evs.filter((_, i) => { const d = distinct[i]; const hit = d.filter((w) => flat.includes(w)).length; return hit / d.length >= 0.6; }) };
  });
  const covers = decideCovers(mapped, evs);
  result[pid] = { events: evs, slides: mapped, covers: covers.map((c) => c.slide), chars: slides.map((s) => s.text.replace(/\s+/g, ' ').length) };
  console.log(pid, 'covers:', covers.map((c, i) => `E${i + 1}=${c.slide ?? 'post'}(${c.eventsOnSlide})`).join(' '), '| per slide:', mapped.map((m) => m.events.map((e) => 'E' + (evs.indexOf(e) + 1)).join('') || '-').join(' '));
}
await worker.terminate();
writeFileSync('private/slide-ocr.json', JSON.stringify(result, null, 1));
console.log(`images ${images}, avg ${(totalMs / Math.max(1, images) / 1000).toFixed(1)} s per image, peak RSS ${(maxRss / 1e6).toFixed(0)} MB`);
