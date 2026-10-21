/**
 * POC ground truth. Labels were written by reading each caption, NOT by looking at model output,
 * and are deliberately expressed as accept-sets where the text is genuinely ambiguous (a
 * "restricted vs open" call on a registration-gated conference is a judgement, not a fact).
 * They are one reviewer's labels — worth a second pair of eyes before anyone treats the
 * accuracy percentages as more than directional.
 *
 * `real` posts come from corpus.real.json (captions only; phone/bank/email lines stripped).
 * `synthetic` posts are written here to cover cases the real corpus lacks (women-only, age-floor,
 * institution-only, online/national, venue-vs-artist-origin confusion, high price, expat/English).
 */
import type {
  CostTier, Eligibility, GenderFocus, GeoScope, ParticipationMode, Segment,
} from './insight-schema.js';

export interface Label {
  geoScope: GeoScope[];                    // acceptable scopes
  areasAll?: string[][];                   // every group must be hit by some targetAreas name (aliases, see score.ts)
  areasForbid?: string[];                  // alias keys that must NOT appear in targetAreas
  noAreas?: boolean;                       // targetAreas must be empty
  eligibility: Eligibility[];
  segmentsAll?: Segment[][];               // every group must have at least one member in output
  segmentsForbid?: Segment[];
  ageMin: 'absent' | number[];
  ageMax: 'absent' | number[];
  genderFocus: GenderFocus[];
  interestsAll: string[][];                // every group must be hit (substring, case-insensitive)
  participationAll: ParticipationMode[][]; // every group must have at least one member in output
  costTier: CostTier[];
  languages?: string[];                    // each must be present
}

export interface SyntheticPost { id: string; caption: string; note: string }

const NO_KIDS_SENIORS_PROS: Segment[] = ['kids', 'seniors', 'professionals'];
const DIY_FALSE_AREAS = ['jakarta', 'bandung', 'surabaya', 'bali', 'asia'];

export const REAL_LABELS: Record<string, Label> = {
  'shopfest': {
    geoScope: ['venue_local', 'city'], areasAll: [['yogyakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: ['kids', 'teens', 'seniors', 'professionals'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['shop', 'reward', 'voucher', 'mall']], participationAll: [['shop']], costTier: ['unspecified', 'free'], languages: ['id'],
  },
  'uss-market': {
    geoScope: ['city', 'venue_local', 'region'], areasAll: [['yogyakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsAll: [['young_adults', 'teens']], segmentsForbid: ['seniors', 'kids', 'professionals'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['shop', 'fashion', 'streetwear', 'sneaker', 'market', 'brand'], ['music', 'concert', 'performance']],
    participationAll: [['shop'], ['attend', 'participate']], costTier: ['unspecified', 'free'],
  },
  'tropical-playland': {
    geoScope: ['city', 'venue_local'], areasAll: [['yogyakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsAll: [['families', 'kids']], segmentsForbid: ['seniors', 'professionals'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['pet', 'animal', 'exotic', 'reptile'], ['plant', 'botanic', 'garden', 'biodiversity', 'nature']],
    participationAll: [['attend', 'participate', 'learn']], costTier: ['unspecified', 'free'],
  },
  'swasana-budaya': {
    geoScope: ['city', 'venue_local'], areasAll: [['yogyakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: ['professionals'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['cultur', 'javanese', 'tradition', 'wayang', 'dance', 'heritage']],
    participationAll: [['attend', 'learn']], costTier: ['free', 'unspecified'],
  },
  'gowes-merdeka': {
    geoScope: ['venue_local', 'city', 'region'], areasAll: [['yogyakarta', 'sleman']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: NO_KIDS_SENIORS_PROS, ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['cycl', 'bike', 'bicycl']], participationAll: [['participate', 'compete']], costTier: ['unspecified', 'free'],
  },
  'cald-conference': {
    geoScope: ['international'], areasAll: [['asia']], eligibility: ['restricted', 'unspecified'],
    segmentsAll: [['professionals']], segmentsForbid: ['kids', 'teens', 'families', 'students'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['politic', 'democra', 'policy', 'governance']], participationAll: [['network', 'learn', 'attend']],
    costTier: ['free'], languages: ['en'],
  },
  'porseni-stikes': {
    geoScope: ['city', 'venue_local', 'region'], areasAll: [['yogyakarta']], eligibility: ['open_to_public'],
    segmentsAll: [['students', 'young_adults']], segmentsForbid: ['kids', 'seniors', 'families'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['basket'], ['badminton']], participationAll: [['compete']], costTier: ['low', 'medium'],
  },
  'volunteer-sosling': {
    geoScope: ['venue_local', 'city', 'unspecified'], areasForbid: DIY_FALSE_AREAS, eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: ['kids', 'seniors'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['environment', 'tree', 'sustainab', 'nature', 'plant', 'eco']], participationAll: [['volunteer']],
    costTier: ['free', 'unspecified'], languages: ['id'],
  },
  'volunteer-pulangkesinii': {
    geoScope: ['unspecified', 'online', 'national'], noAreas: true, eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: NO_KIDS_SENIORS_PROS, ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['volunteer', 'social', 'communit', 'charity']], participationAll: [['volunteer']], costTier: ['free', 'unspecified'],
  },
  'futsal-mfc': {
    geoScope: ['region'], areasAll: [['yogyakarta'], ['central_java']], eligibility: ['open_to_public'],
    segmentsAll: [['students', 'young_adults']], segmentsForbid: ['kids', 'seniors', 'families'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['futsal']], participationAll: [['compete']], costTier: ['low', 'medium'],
  },
  'lomba-mewarnai': {
    geoScope: ['city', 'region', 'venue_local'], areasAll: [['yogyakarta', 'sleman']], eligibility: ['open_to_public', 'unspecified'],
    segmentsAll: [['kids'], ['families']], segmentsForbid: ['seniors', 'professionals', 'students', 'young_adults'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['color', 'draw', 'art', 'paint']], participationAll: [['compete']], costTier: ['low'],
  },
  'apecx-talkshow': {
    geoScope: ['city', 'venue_local', 'national', 'region'], areasForbid: ['jakarta', 'bandung', 'bali'], eligibility: ['open_to_public', 'unspecified'],
    segmentsAll: [['professionals', 'students', 'young_adults']], segmentsForbid: ['kids', 'seniors', 'families'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['energy', 'oil', 'sustainab', 'gas']], participationAll: [['learn', 'network', 'attend']],
    costTier: ['unspecified', 'free'], languages: ['en'],
  },
  'rsih-run': {
    geoScope: ['city', 'region', 'venue_local'], areasAll: [['yogyakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: NO_KIDS_SENIORS_PROS, ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['run', 'jog']], participationAll: [['participate', 'compete']], costTier: ['unspecified', 'low', 'medium'],
  },
  'erafone-run': {
    geoScope: ['region', 'city', 'venue_local'], areasAll: [['yogyakarta', 'sleman']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: NO_KIDS_SENIORS_PROS, ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['run']], participationAll: [['participate', 'compete']], costTier: ['unspecified', 'low', 'medium'],
  },
  'fixture-sleman-city-hall': {
    geoScope: ['city', 'venue_local'], areasAll: [['sleman', 'yogyakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: ['professionals', 'seniors'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['music', 'concert', 'performance'], ['circus', 'entertain', 'firework']], participationAll: [['attend']], costTier: ['unspecified', 'free'],
  },
  'fixture-drum-contest': {
    geoScope: ['city', 'region', 'venue_local'], areasAll: [['yogyakarta']], eligibility: ['open_to_public'],
    segmentsAll: [['kids'], ['teens']], segmentsForbid: ['seniors', 'professionals'], ageMin: [7], ageMax: [16], genderFocus: ['all'],
    interestsAll: [['drum', 'percussion', 'music']], participationAll: [['compete']], costTier: ['low', 'medium'],
  },
  'fixture-vifation': {
    geoScope: ['region', 'city'], areasAll: [['yogyakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsAll: [['students', 'young_adults']], segmentsForbid: ['kids', 'seniors', 'families'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['billiard'], ['esport', 'pes', 'gaming', 'video game'], ['futsal']], participationAll: [['compete']], costTier: ['unspecified', 'low', 'medium'],
  },
};

export const SYNTHETIC_POSTS: SyntheticPost[] = [
  {
    id: 'syn-women-tech',
    note: 'gender-restricted professional meetup',
    caption: `WOMEN IN TECH JOGJA — Meetup #7 👩‍💻

Khusus perempuan! Ngobrol santai bareng para engineer, product manager & founder perempuan di Jogja soal karier di industri teknologi.

📅 Sabtu, 14 November 2026
⏰ 13.00–16.00 WIB
📍 Hubs Co-working Space, Jl. Kaliurang, Sleman
💸 Gratis, kuota 60 peserta

Bukan untuk laki-laki ya, tapi boleh titip salam 😄
#womenintech #techjogja`,
  },
  {
    id: 'syn-senam-lansia',
    note: 'stated numeric age floor, seniors',
    caption: `SENAM LANSIA CERIA 🧓💚

Gratis untuk seluruh lansia usia 60 tahun ke atas!
Setiap Minggu pagi pukul 06.30 WIB di Lapangan Puskesmas Depok 1, Sleman.
Cek tekanan darah gratis.

Ajak ayah, ibu, kakek dan nenek ya!
#lansiasehat #senamlansia`,
  },
  {
    id: 'syn-webinar-nasional',
    note: 'online, national scope, no place',
    caption: `WEBINAR NASIONAL GRATIS 🎓
"Peluang Karier di Industri Kreatif untuk Fresh Graduate"

Sabtu, 21 November 2026, 09.00 WIB via Zoom.
Terbuka untuk seluruh mahasiswa tingkat akhir & fresh graduate di seluruh Indonesia.
E-certificate untuk semua peserta.

Daftar: s.id/webinarkreatif`,
  },
  {
    id: 'syn-open-house-internal',
    note: 'explicitly institution-only',
    caption: `OPEN HOUSE KHUSUS MAHASISWA BARU UNIVERSITAS KARYA BANGSA 2026 🎒

Hanya untuk mahasiswa baru angkatan 2026 (wajib membawa KTM). Kampus tour, pengenalan UKM, dan games seru.

📅 Sabtu, 5 Desember 2026
📍 Kampus Terpadu Universitas Karya Bangsa, Sleman

Tidak terbuka untuk umum.`,
  },
  {
    id: 'syn-konser-jakarta',
    note: 'control: audience-neutral paid concert; any segment claim is hallucination',
    caption: `Konser Akhir Tahun — NADA SENJA LIVE IN CONCERT 🎶

12 Desember 2026
Istora Senayan, Jakarta
Pukul 19.30 WIB

Tiket mulai Rp750.000 (festival) hingga Rp3.500.000 (VIP). Pembelian tiket hanya di website resmi.`,
  },
  {
    id: 'syn-pameran-origin',
    note: 'adversarial: artists from Yogyakarta, venue and audience in Jakarta',
    caption: `PAMERAN SENI RUPA "AKAR & TANAH" 🎨

Karya 30 perupa Yogyakarta dipamerkan di Galeri Nasional Indonesia, Jakarta.
1–20 Desember 2026, 10.00–20.00 WIB.

Gratis, terbuka untuk umum.`,
  },
  {
    id: 'syn-expat-bali',
    note: 'English, expat/digital-nomad audience, price in IDR',
    caption: `Sunset Yoga & Community Dinner 🌅

Every Friday in Canggu, Bali. Meet fellow digital nomads, remote workers and expats over a yoga session on the beach followed by a shared vegan dinner. 5 PM.

IDR 180,000 per person incl. dinner.
Come solo, leave with friends!`,
  },
  {
    id: 'syn-family-day',
    note: 'stated age ceiling (under 12), free for kids',
    caption: `FAMILY FUN DAY 🎈

Sabtu, 28 November 2026 — Taman Pintar Yogyakarta.
Anak di bawah 12 tahun masuk GRATIS dengan didampingi orang tua! Ada pentas boneka, mendongeng, dan pojok sains.

Ajak seluruh keluarga ya!`,
  },
  {
    id: 'syn-gala-dinner',
    note: 'high price, formal, limited reservation',
    caption: `CHARITY GALA DINNER "MALAM AMAL 2026" 🥂

Black-tie.
20 Desember 2026, Hotel Tentrem Yogyakarta, 19.00 WIB.
Investasi Rp2.500.000 per orang, seluruh hasil disumbangkan untuk beasiswa anak yatim.

Reservasi terbatas melalui sekretariat panitia.`,
  },
  {
    id: 'syn-kota-lama',
    note: 'vague "seru" vibe; no explicit audience',
    caption: `Malam Minggu Seru di Kota Lama Semarang! 🎸🍢

Live music, jajanan, dan bazar UMKM. Datang yuk, gratis!
Sabtu 7 November 2026, mulai jam 6 sore.`,
  },
];

export const SYNTHETIC_LABELS: Record<string, Label> = {
  'syn-women-tech': {
    geoScope: ['city', 'venue_local', 'region'], areasAll: [['yogyakarta', 'sleman']], eligibility: ['restricted'],
    segmentsAll: [['professionals', 'adults', 'young_adults']], segmentsForbid: ['kids', 'teens', 'seniors'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['women'],
    interestsAll: [['tech']], participationAll: [['network', 'learn']], costTier: ['free'], languages: ['id'],
  },
  'syn-senam-lansia': {
    geoScope: ['venue_local', 'city'], areasAll: [['sleman', 'yogyakarta']], eligibility: ['restricted', 'open_to_public'],
    segmentsAll: [['seniors']], segmentsForbid: ['kids', 'teens', 'students'],
    ageMin: [60], ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['exercise', 'fitness', 'gymnastic', 'health', 'senior']], participationAll: [['participate']], costTier: ['free'],
  },
  'syn-webinar-nasional': {
    geoScope: ['online', 'national'], areasForbid: ['yogyakarta', 'jakarta'], eligibility: ['open_to_public'],
    segmentsAll: [['students', 'young_adults']], segmentsForbid: ['kids', 'seniors', 'families'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['career', 'creative']], participationAll: [['learn']], costTier: ['free'], languages: ['id'],
  },
  'syn-open-house-internal': {
    geoScope: ['venue_local', 'city'], areasAll: [['sleman', 'yogyakarta']], eligibility: ['restricted'],
    segmentsAll: [['students']], segmentsForbid: ['kids', 'seniors', 'families'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['campus', 'universit', 'orientation', 'student']], participationAll: [['attend', 'participate', 'learn']], costTier: ['unspecified', 'free'],
  },
  'syn-konser-jakarta': {
    geoScope: ['city', 'venue_local'], areasAll: [['jakarta']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: ['kids', 'seniors', 'families', 'students', 'professionals'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['music', 'concert']], participationAll: [['attend']], costTier: ['high'],
  },
  'syn-pameran-origin': {
    geoScope: ['city', 'venue_local'], areasAll: [['jakarta']], areasForbid: ['yogyakarta'], eligibility: ['open_to_public'],
    segmentsForbid: ['kids', 'seniors', 'professionals', 'students'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['art', 'exhibition']], participationAll: [['attend']], costTier: ['free'],
  },
  'syn-expat-bali': {
    geoScope: ['venue_local', 'city', 'region'], areasAll: [['bali', 'canggu']], areasForbid: ['yogyakarta', 'jakarta'], eligibility: ['open_to_public', 'unspecified'],
    segmentsAll: [['tourists_expats', 'professionals', 'adults', 'young_adults']], segmentsForbid: ['kids', 'seniors'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['yoga']], participationAll: [['participate', 'attend']], costTier: ['medium'], languages: ['en'],
  },
  'syn-family-day': {
    geoScope: ['city', 'venue_local'], areasAll: [['yogyakarta']], eligibility: ['open_to_public'],
    segmentsAll: [['kids'], ['families']], segmentsForbid: ['seniors', 'professionals'],
    ageMin: 'absent', ageMax: [11, 12], genderFocus: ['all'],
    interestsAll: [['puppet', 'storytell', 'science', 'family']], participationAll: [['attend', 'participate']], costTier: ['free', 'unspecified'], languages: ['id'],
  },
  'syn-gala-dinner': {
    geoScope: ['city', 'venue_local'], areasAll: [['yogyakarta']], eligibility: ['restricted', 'unspecified'],
    segmentsAll: [['adults', 'professionals']], segmentsForbid: ['kids', 'teens', 'students'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['charity', 'fundrais', 'gala', 'scholarship']], participationAll: [['attend', 'network']], costTier: ['high'],
  },
  'syn-kota-lama': {
    geoScope: ['city', 'venue_local'], areasAll: [['semarang']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: ['seniors', 'professionals'],
    ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['music'], ['food', 'culinary', 'snack', 'street']], participationAll: [['attend', 'shop']], costTier: ['free'],
  },
};

// ---- Held-out set -----------------------------------------------------------------------------
// Written BEFORE the v1 failure analysis, so a prompt revised after reading v1's misses can be
// checked on cases it was not tuned on. Same failure families as the core set, different surface
// text. Do not edit these labels after a run.
export const HOLDOUT_POSTS: SyntheticPost[] = [
  {
    id: 'ho-pentas-bantul',
    note: '"terbuka untuk umum" must not become a national scope',
    caption: `PENTAS SENI RAKYAT BANTUL 🎭

Terbuka untuk umum! Nikmati tari, karawitan dan pentas teater rakyat.
Sabtu, 2 November 2026, pukul 19.00 WIB
Alun-alun Bantul

Gratis, tanpa tiket.`,
  },
  {
    id: 'ho-coding-camp',
    note: 'age range written with an en dash; paid; Bandung',
    caption: `KIDS CODING CAMP 💻
Untuk anak usia 8–12 tahun. Belajar bikin game pertamamu bareng mentor!

📅 12–13 Desember 2026
📍 Co-Lab Space, Bandung
💰 Rp450.000 (sudah termasuk modul & makan siang)`,
  },
  {
    id: 'ho-srikandi-run',
    note: 'women-only sports event',
    caption: `SRIKANDI RUN 5K 🏃‍♀️

Lari khusus perempuan! Semua usia, semua level, rayakan semangat Kartini bersama.
Minggu, 15 November 2026 — Taman Bungkul, Surabaya
Pendaftaran: Rp175.000 (termasuk jersey & medali)`,
  },
  {
    id: 'ho-esai-nasional',
    note: 'national, online, restricted to a school level',
    caption: `LOMBA ESAI NASIONAL 2026 ✍️

Tema: "Generasi Muda dan Masa Depan Energi Bersih"
Terbuka untuk pelajar SMA/sederajat se-Indonesia. Pendaftaran dan pengumpulan karya 100% online.
Batas akhir: 30 November 2026. Gratis biaya pendaftaran.`,
  },
  {
    id: 'ho-gathering-internal',
    note: 'company-internal',
    caption: `GATHERING KARYAWAN PT MAJU JAYA 2026 🎉

Khusus karyawan PT Maju Jaya dan keluarga inti. Tidak untuk umum.
Sabtu, 21 November 2026, The Alana Hotel, Yogyakarta.
Dresscode: batik.`,
  },
  {
    id: 'ho-layang-layang',
    note: 'invited from several regions; venue elsewhere',
    caption: `FESTIVAL LAYANG-LAYANG SE-JAWA & BALI 🪁

Peserta dari seluruh Jawa dan Bali diundang bertanding! Kategori anak, remaja dan dewasa.
Minggu, 22 November 2026 — Pantai Parangtritis, Bantul.
Pendaftaran gratis, hadiah total puluhan juta rupiah.`,
  },
];

export const HOLDOUT_LABELS: Record<string, Label> = {
  'ho-pentas-bantul': {
    geoScope: ['city', 'venue_local', 'region'], areasAll: [['bantul', 'yogyakarta']], eligibility: ['open_to_public'],
    segmentsForbid: ['professionals', 'students'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['dance', 'art', 'theat', 'culture', 'tradition', 'gamelan', 'karawitan']], participationAll: [['attend']], costTier: ['free'],
  },
  'ho-coding-camp': {
    geoScope: ['city', 'venue_local'], areasAll: [['bandung']], eligibility: ['open_to_public', 'restricted'],
    segmentsAll: [['kids']], segmentsForbid: ['seniors', 'professionals'], ageMin: [8], ageMax: [12], genderFocus: ['all'],
    interestsAll: [['cod', 'program', 'tech', 'game']], participationAll: [['learn', 'participate']], costTier: ['medium'],
  },
  'ho-srikandi-run': {
    geoScope: ['city', 'venue_local'], areasAll: [['surabaya']], eligibility: ['restricted'],
    segmentsForbid: ['kids', 'seniors', 'professionals'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['women'],
    interestsAll: [['run']], participationAll: [['participate', 'compete']], costTier: ['medium'],
  },
  'ho-esai-nasional': {
    geoScope: ['national', 'online'], areasForbid: ['yogyakarta', 'jakarta', 'surabaya', 'bandung'], eligibility: ['restricted', 'open_to_public'],
    segmentsAll: [['teens', 'students']], segmentsForbid: ['seniors', 'families', 'professionals'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['essay', 'writing', 'energy']], participationAll: [['compete']], costTier: ['free'],
  },
  'ho-gathering-internal': {
    geoScope: ['venue_local', 'city', 'unspecified'], areasForbid: ['jakarta', 'bandung', 'surabaya', 'bali'], eligibility: ['restricted'],
    segmentsAll: [['professionals']], segmentsForbid: ['kids', 'seniors'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['gathering', 'company', 'social', 'networking', 'corporate', 'team']], participationAll: [['attend', 'network', 'participate']], costTier: ['unspecified', 'free'],
  },
  'ho-layang-layang': {
    geoScope: ['region', 'national'], areasAll: [['bantul', 'yogyakarta'], ['bali']], eligibility: ['open_to_public', 'unspecified'],
    segmentsForbid: ['seniors', 'professionals'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
    interestsAll: [['kite']], participationAll: [['compete', 'participate']], costTier: ['free'],
  },
};
