// Synthetic cases only (placeholder numbers like 0812-3456-7890): safe to commit.
import assert from 'node:assert/strict';
import { scrubContactData, REMOVED } from './scrub-contact-data.ts';

const cases: Array<[string, string, string]> = [
  // [name, input, expected]
  ['plain 08', 'Daftar via 081234567890 ya', `Daftar via ${REMOVED} ya`],
  ['dashed', 'CP: 0812-3456-7890 (Budi)', `CP: ${REMOVED} (Budi)`],
  ['+62 spaced', 'WA +62 812-3456-7890', `WA ${REMOVED}`],
  ['62 no plus', 'hubungi 6281234567890', `hubungi ${REMOVED}`],
  ['dotted', 'telp 0812.3456.7890', `telp ${REMOVED}`],
  ['wa.me link', 'klik https://wa.me/6281234567890?text=Halo untuk daftar', `klik ${REMOVED} untuk daftar`],
  ['wa.me with plus and space', 'https://wa.me/+62 812-3456-7890', REMOVED],
  ['group invite', 'join https://chat.whatsapp.com/AbCdEf123', `join ${REMOVED}`],
  ['email', 'kirim ke panitia@example.com sekarang', `kirim ke ${REMOVED} sekarang`],
  ['bank account', 'BSI 7256587372 a/n Yayasan', `BSI ${REMOVED} a/n Yayasan`],
  ['amount with dots is kept', 'Prizepool Rp. 50.000.000 dan HTM Rp150.000', 'Prizepool Rp. 50.000.000 dan HTM Rp150.000'],
  ['amount with k is kept', 'Daftar mulai 25K / team', 'Daftar mulai 25K / team'],
  ['date is kept', 'Tanggal 2026-11-14, 08.30-12.00 WIB', 'Tanggal 2026-11-14, 08.30-12.00 WIB'],
  ['year range is kept', 'Pendaftaran 10 September - 29 Oktober 2026', 'Pendaftaran 10 September - 29 Oktober 2026'],
  ['handle with digits', 'DM @promo081234567890', `DM ${REMOVED}`],
  ['math-bold digits and letters', '𝗪𝗔: 𝟬𝟴𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝟬', `WA: ${REMOVED}`],
  ['zero-width inside number', '0812​3456​7890', REMOVED],
  ['message template with a number', 'Halo, saya mau daftar atas nama [Nama], HP 0812-3456-7890', `Halo, saya mau daftar atas nama [Nama], HP ${REMOVED}`],
  ['two numbers', '0812-3456-7890 / 0813-1111-2222', `${REMOVED} / ${REMOVED}`],
  ['ordinary text untouched', 'Gratis untuk 100 pendaftar pertama', 'Gratis untuk 100 pendaftar pertama'],
];
let pass = 0;
for (const [name, input, expected] of cases) {
  try { assert.equal(scrubContactData(input).text, expected); pass++; }
  catch { console.log('FAIL', name, '=>', JSON.stringify(scrubContactData(input).text)); }
}
console.log(`${pass}/${cases.length} scrub cases pass`);
