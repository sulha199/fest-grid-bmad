// POC: title -> stage rule, version 2. Tuned by reading the errors on the ODD-numbered labelled titles only; the EVEN ones are the held-out check.
// Differences from v1: qualification and supporting are not separate outputs (both count as event days and the rule cannot tell them apart:
// 19 of 48 v1 errors were event -> supporting and 10 were event -> qualification), a main-day override runs first so mixed titles such as
// "Technical Meeting & Match Day" stay event, announcement is checked before registration, and "batch"/"gelombang" alone no longer mean registration.
export const STAGES_V2 = ['event', 'registration', 'submission', 'announcement', 'preparation'];
const RULES = [
  ['event', /(acara puncak|main event|match day|race day|grand final|final day|day \d+ (main|music|stage)|konser|festival opening|opening ceremony)/i],
  ['preparation', /(registrasi ulang|daftar ulang|re-?registration|check-?in|penukaran|redeem|technical meeting|teknikal meeting|\btm\b|race ?pack|rpc\b|pengambilan|collection|gladi|rehearsal|check sound|load[- ]?in|briefing|rapat manajer|manager meeting|congress)/i],
  ['announcement', /(pengumuman|announcement|announce\b)/i],
  ['registration', /(pendaftaran|registrasi|registration|\bdaftar\b|register|early ?bird|presale|pre-?sale|penjualan tiket|ticket ?sale|tiket (dibuka|on ?sale)|(normal|regular|reguler) tickets?|open recruitment|last call|application|(batch|gelombang) \d+ (registration|pendaftaran)|(registration|pendaftaran) (batch|gelombang))/i],
  ['submission', /(pengumpulan|pengiriman|submission|submit|batas (akhir )?(kirim|pengumpulan)|open call|call for (papers?|entries|submission))/i],
];
export function classifyStage(title) {
  const t = String(title ?? '');
  // a deadline for sending work is a submission even when the word "pendaftaran" is absent; check it before registration only when no registration word is present
  for (const [stage, re] of RULES) if (re.test(t)) return stage;
  return 'event';
}
