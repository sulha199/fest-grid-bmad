import { readFileSync } from 'node:fs';
import { detectRegistrationPhones, normalizeCaption } from './detect-phones.ts';
const all = readFileSync('private/all-captions.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const pool = all.filter((r) => r.flag && detectRegistrationPhones(r.caption).length === 0);
const cls: Record<string, number> = {};
const bump = (k: string) => (cls[k] = (cls[k] ?? 0) + 1);
const samples: string[] = [];
for (const r of pool) {
  const t = normalizeCaption(r.caption);
  const k: string[] = [];
  if (/(?:\+?62|\b0)8\d/.test(t.replace(/[ .-]/g, ''))) k.push('has 08/628 digits (rejected as recap/neg/invalid/no-cue)');
  if (/@[\w.-]+\.[a-z]{2,}/i.test(t)) k.push('email');
  if (/\(0\d{2,3}\)|\b0[2-7]\d{1,2}[ .-]?\d{5,8}\b/.test(t)) k.push('landline');
  if (/(dm|direct message|inbox|chat)\b/i.test(t)) k.push('dm/inbox');
  if (/(chat\.whatsapp|wa\.me)/i.test(t)) k.push('wa link (group/phone)');
  if (/(hubungi|contact|cp\b|narahubung|info)/i.test(t)) k.push('contact cue word');
  if (!k.length) k.push('none of the above (image-only / nothing)');
  k.forEach(bump);
  if (samples.length < 25 && k[0].startsWith('has 08')) {
    const m = t.replace(/[ .-]/g, '').search(/(?:\+?62|0)8\d/);
    const i = Math.max(0, Math.min(t.length - 1, m)); // approximate; context printed masked
    samples.push(`${r.post_id.slice(0, 6)} ${t.slice(Math.max(0, i - 60), i + 90).replace(/\d/g, 'x').replace(/\n+/g, ' ⏎ ')}`);
  }
}
console.log('flagged but undetected:', pool.length, JSON.stringify(cls, null, 1));
console.log(samples.join('\n'));
