// Scrub vs the real corpus; prints counts only.
import { readFileSync } from 'node:fs';
import { detectRegistrationPhones, normalizeCaption } from './detect-phones.ts';
import { scrubContactData } from './scrub-contact-data.ts';
const all = readFileSync('private/all-captions.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
let leak = 0, leakPosts = 0, amountLines = 0, amountMangled = 0, dateMangled = 0, lines = 0;
const AMOUNT = /(?:rp|idr)\.? ?\d[\d.,]*(?:\s?(?:k|rb|ribu|jt|juta))?|\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+ ?(?:k|rb|jt|juta)\b/gi;
const TIME_DATE = /\b\d{1,2}[.:]\d{2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g;
for (const r of all) {
  const text = normalizeCaption(r.caption);
  // 1) every detected number must be gone: re-run the detector on the scrubbed text
  const s = scrubContactData(r.caption).text;
  const left = detectRegistrationPhones(s, { requireCue: false, suppressRecap: false });
  if (left.length) { leak += left.length; leakPosts++; }
  // 2) amounts / times must survive, line by line
  for (const line of text.split('\n')) {
    lines++;
    const a = line.match(AMOUNT) ?? [];
    if (a.length) {
      amountLines++;
      const sl = scrubContactData(line).text;
      if (a.some((x) => !sl.includes(x))) amountMangled++;
    }
    const d = line.match(TIME_DATE) ?? [];
    if (d.length && d.some((x) => !scrubContactData(line).text.includes(x))) dateMangled++;
  }
}
console.log(JSON.stringify({ captions: all.length, numbersStillDetectedAfterScrub: leak, postsWithLeak: leakPosts, linesWithAmount: amountLines, amountLinesMangled: amountMangled, timeDateLinesMangled: dateMangled, lines }));
