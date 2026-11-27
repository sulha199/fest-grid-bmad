import { readFileSync } from 'node:fs';
import { detectRegistrationPhones, normalizeCaption } from './detect-phones.ts';
const all = readFileSync('private/all-captions.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const seen = new Set<string>(); let n = 0, withPhone = 0, phoneAndLink = 0, phoneOnly = 0, multiPhone = 0, multiEventPhone = 0, multiEvent = 0, singleEventPhone = 0, qrOnlyNoPhoneNoLink = 0, linkOnly = 0, none = 0;
const LINK = /(bit\.ly|forms\.gle|docs\.google\.com\/forms|linktr\.ee|lynk\.id|s\.id\/|tinyurl|(link|tautan) ?(di )?(bio|pendaftaran|registrasi)|pendaftaran ?:? ?https?)/i;
const QR = /(scan|pindai)[^\n]{0,30}(qr|barcode)|qr ?code/i;
for (const r of all) {
  const k = normalizeCaption(r.caption).slice(0, 160); if (seen.has(k)) continue; seen.add(k); n++;
  const det = detectRegistrationPhones(r.caption); const t = normalizeCaption(r.caption);
  const link = LINK.test(t), qr = QR.test(t);
  if (r.n_events > 1) multiEvent++;
  if (det.length) { withPhone++; if (link) phoneAndLink++; else phoneOnly++; if (det.length > 1) multiPhone++; if (r.n_events > 1) multiEventPhone++; else singleEventPhone++; }
  else if (link) linkOnly++; else if (qr) qrOnlyNoPhoneNoLink++; else none++;
}
console.log(JSON.stringify({ distinctCaptions: n, withDetectedPhone: withPhone, ofWhich_alsoLink: phoneAndLink, ofWhich_phoneOnly: phoneOnly, ofWhich_2plusNumbers: multiPhone, phoneInMultiEventPost: multiEventPhone, phoneInSingleEventPost: singleEventPhone, multiEventPostsTotal: multiEvent, linkOnly_noPhone: linkOnly, qrOnly_noPhoneNoLink: qrOnlyNoPhoneNoLink, noneOfThese: none }));
