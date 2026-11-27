import { readFileSync } from 'node:fs';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { normalizeCaption, maskE164 } from './detect-phones.ts';
const sheet = JSON.parse(readFileSync('private/heldout-sheet.json', 'utf8'));
const all = new Map(readFileSync('private/all-captions.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l)).map((r) => [r.post_id, r]));
const PH = /(?:\(?\+?[ ]?62\)?[ \-.]?|0)8\d(?:[ \-.()]?\d){6,11}/g;
for (const id of ['N03','N08','N13','N14','N16','N28','N34','N39']) {
  const p = sheet.neg.find((x: any) => x.id === id); const t = normalizeCaption(all.get(p.post_id).caption);
  const out = [...t.matchAll(PH)].map((m) => { const d = m[0].replace(/[^\d+]/g, ''); const c = d.startsWith('+') ? d : d.startsWith('0') ? d : '+' + d; const n = parsePhoneNumberFromString(c, 'ID'); return `${m[0].replace(/\d/g,'x')} -> ${n ? (n.isValid() ? 'valid:' + n.getType() : 'INVALID') : 'unparsed'}`; });
  const loose = t.match(/(?:\+?62|\b0)[ .-]?\d[\d .-]{7,14}/g)?.map((s) => s.replace(/\d/g, 'x') + ' len' + s.replace(/\D/g, '').length);
  console.log(id, JSON.stringify(out), '| loose:', JSON.stringify(loose?.slice(0, 3)));
}
