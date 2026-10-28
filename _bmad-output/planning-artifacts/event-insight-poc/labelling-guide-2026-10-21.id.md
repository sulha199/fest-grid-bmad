# Panduan pelabelan: acara ini ditujukan untuk siapa? (versi Indonesia; versi Inggris: `labelling-guide-2026-10-21.md`)

Untuk dua orang yang melabeli postingan pada POC audiens, bahasa, dan taksonomi (`audience-and-taxonomy-poc-plan-2026-10-21.md`). Label Anda adalah kunci jawaban untuk menilai model, jadi harus cermat, mandiri, dan konsisten. Sekitar 2 menit per postingan.

## Aturan dasar

1. **Beri label hanya dari postingannya**: keterangan (caption), tagar, lokasi yang ditandai, dan teks yang bisa dibaca pada gambar. Jangan memakai pengetahuan Anda tentang penyelenggaranya. Satu-satunya pengetahuan luar yang boleh dipakai adalah geografi (kota yang disebut ada di negara mana).
2. **Bekerja sendiri.** Jangan melihat lembar pelabel lain atau hasil model, dan jangan membahas label sampai keduanya selesai. Tingkat kesepakatan akan diukur, jadi jawaban yang dibahas bersama merusak pengukuran.
3. **Jangan menebak.** Jika setelah sekitar dua menit Anda belum bisa memutuskan sebuah kolom, tulis `unclear` dan beri alasannya di catatan. `unclear` adalah jawaban yang berguna; tebakan tidak.
4. **Postingan ini konten orang lain.** Hanya ditampilkan di komputer pemilik. Jangan menyalin, memotret layar, meneruskan, atau memposting caption apa pun. Lembarnya dihapus saat POC selesai.
5. Pakai kata persis seperti pada daftar di bawah, supaya lembar bisa dibandingkan oleh program.

## Kolom yang diisi

| Kolom | Isi |
|---|---|
| `is_event` | `yes` jika postingan tentang sebuah acara tertentu yang punya tanggal: mengumumkan acara itu (akan datang atau sedang berlangsung) atau melaporkannya (hasil, juara, rekap, berita, ucapan terima kasih). `no` jika bukan tentang acara tertentu: repost vlog pribadi, promo toko atau restoran, kutipan atau ucapan, berita umum. Untuk postingan `no`, isi hanya `audience_country`, `post_language`, `sensitive`, dan `unsure`; tulis `unclear` di kolom label lain dan jelaskan di catatan (sebut nama acaranya di catatan jika postingan itu tentang acara yang dikenal). |
| `post_kind` | Apa yang dilakukan postingan terhadap acaranya (ditambahkan 2026-10-28, backlog IDEA-106). `announcement`: mengiklankan sesuatu yang akan datang atau sedang berlangsung (poster, iklan, jadwal). `report`: melaporkan acara yang sedang berlangsung atau sudah selesai: hasil, juara, skor, rekap, berita, laporan langsung, ucapan terima kasih; tanggalnya milik hal yang sudah terjadi dan tidak ada yang diumumkan ke depan. `mixed`: laporan yang juga mengumumkan sesuatu yang akan datang (babak berikutnya, hari pertandingan berikutnya, edisi berikutnya). `none`: bukan tentang acara tertentu (`is_event` = `no`). Untuk `report` isi hanya `audience_country`, `post_language`, `sensitive`, dan `unsure`, seperti postingan `no` (tidak ada acara mendatang yang dituju); tulis `unclear` di kolom label lain. Untuk `mixed`, isi kolom acara untuk bagian yang akan datang. Postingan hasil pertandingan yang mencantumkan jadwal besok adalah `mixed`. |
| `audience_country` | Negara yang dituju postingan, dengan kode dua huruf (`id` Indonesia, `my` Malaysia, `sg` Singapura, `au` Australia, `dk` Denmark ...), atau `international` jika ditujukan ke orang di beberapa negara, atau `unclear`. Lihat langkah keputusan di bawah. |
| `geo_scope` | `venue_local` (tempat/venue disebut), `city` (hanya kota atau wilayah, tanpa venue), `region`, `national`, `international`, `online`, atau `unspecified`. Lihat tabel di bawah. |
| `post_language` | `id`, `en`, `ms` (Melayu), `mixed` (Indonesia dan Inggris dalam satu caption), `other`, atau bahasa utama jika jelas dominan. |
| `target_area_name` | **(Diubah 2026-10-27, target-area-spec-2026-10-27.md.)** Wilayah yang DISEBUT postingan sebagai sasaran acara, sesuai tulisan: "Jogja", "DIY", "RW 05 Kelurahan X". Baca caption DAN poster. Orang yang hadir, mendaftar atau berlomba TERMASUK audiens ("peserta se-DIY", "warga Jogja"). BUKAN audiens: baris alamat atau "Tempat:", nama venue, asal pengisi acara, penampil, peserta pameran atau penjual ("sanggar tari se-yogyakarta" dalam sebuah pameran), nama tempat yang menjadi bagian dari sebuah nama ("Java Jazz"), "terbuka untuk umum". Beberapa wilayah: pisahkan dengan `;`. Tulis `none` jika postingan tidak menyebut wilayah. JANGAN menulis wilayah dari venue, hashtag atau akun pengunggah: sistem yang menurunkannya. |
| `target_area_source` | `stated` jika caption yang menyebutnya, `stated_poster` jika hanya poster yang menyebutnya, `none` jika tidak ada yang menyebut wilayah. Jangan memberi label wilayah dari venue, hashtag atau akun secara manual. |
| `target_area_level` | Tingkat wilayah pada `target_area_name`: `neighborhood` (HANYA jika tertulis RW, RT, kampung, dusun atau lingkungan), `city`, `regency`, `province`, `country`, `continent`. Jika namanya bisa kota atau provinsinya (Jogja, Yogyakarta, Jakarta), pilih yang LEBIH LUAS. `none` jika `target_area_source` adalah `none`. Wilayah yang disebut mengalahkan venue, baik lebih luas maupun lebih sempit. Aturan lama "ambil dari venue, lalu hashtag, lalu akun" dicabut. |
| `eligibility` | `restricted` hanya jika postingan membatasi peserta berdasarkan keanggotaan (undangan, satu sekolah, satu perusahaan, khusus anggota); selain itu `open_to_public`: acara tanpa pembatasan berarti terbuka. `unspecified` hanya untuk postingan yang bukan acara. Usia dan gender bukan eligibility. |
| `track_count` | Berapa kategori terpisah yang memenuhi syarat yang disebut acara (misalnya "Kids Dash 6-10, 5K 12+, 10K 17+" berarti 3). Jika tidak ada yang disebut, itu satu tingkat yang terbuka untuk semua: `1`. Paket tiket dan harga bukan kategori. `unclear` untuk postingan yang bukan acara. |
| `age_written` | `yes` jika ada angka usia yang tertulis (angka di samping kata usia), selain itu `no`. Jangan menyimpulkan usia dari "SD" atau "mahasiswa". |
| `cost_tier` | `free`, `low`, `medium`, `high`, atau `unspecified`. Rendah kira-kira di bawah Rp 50.000, sedang sampai Rp 250.000, tinggi di atas itu, atau setara. Harga boleh dibaca dari gambar. |
| `cost_source` | Dari mana harga dibaca: `caption`, `image` (harga hanya ada di gambar), atau `none` (tidak ada harga). Model hanya membaca caption, jadi biaya dinilai pada baris `caption` dan `none`. |
| `sensitive` | `none`, atau salah satu dari `religion`, `politics_civic`, `health_condition`, `sexuality`, `ethnicity`: topik acara, jika termasuk di antaranya. Buka puasa bersama di masjid adalah `religion`; kelas kebugaran `none`; skrining diabetes `health_condition`. |
| `unsure` | `yes` atau `no`. |
| `notes` | Satu baris singkat bila Anda menulis `unclear` atau `unsure`. |

## Negara audiens: putuskan dengan urutan ini

1. **Apakah postingan menyebut siapa yang boleh ikut atau ditujukan untuk siapa?** Negara yang disebut, "seluruh Indonesia", "se-ASEAN", "open worldwide": itulah jawabannya (`id`, negara tersebut, atau `international`).
2. **Jika tidak disebut, postingan ditulis untuk siapa?** Lihat bahasa bersama dengan lokasi akun. Postingan berbahasa Indonesia dari akun Indonesia ditujukan untuk Indonesia (`id`), **meskipun acaranya di luar negeri** (misalnya akun Indonesia menulis dalam bahasa Indonesia tentang turnamen bulu tangkis di Denmark). Mata uang (Rp atau RM), nomor telepon (+62, +60), zona waktu (WIB, MYT), dan kata-kata lokal membantu.
3. **Jika bahasanya dipakai banyak negara** (Inggris, Spanyol, Arab, Portugis, dan Melayu yang dekat dengan Indonesia), bahasa saja tidak cukup. Perlu petunjuk kedua: mata uang, kode telepon, lokasi akun, zona waktu. Jika tidak ada, tulis `unclear`.
4. **Acara daring tanpa audiens yang disebut** adalah `international`.
5. **Hanya jika tidak ada petunjuk di atas**, pakai negara tempat acara berlangsung.

## geo_scope

| Nilai | Arti | Bukan ini |
|---|---|---|
| `venue_local` | Orang di sekitar lingkungan lokasi acara. | |
| `city` | Satu kota atau kabupaten. | |
| `region` | Satu provinsi, atau beberapa wilayah yang disebut ("se-DIY dan Jawa Tengah"). | |
| `national` | Postingan mengundang orang dari seluruh negara ("seluruh Indonesia", "tingkat nasional", peserta dari banyak kota). Lomba di kampus lokal yang mengundang seluruh negara adalah `national`. | "Terbuka untuk umum" atau "gratis masuk" menyatakan siapa yang boleh datang, bukan seberapa jauh tempat tinggalnya: bukan `national`. Tempat bernama "Galeri Nasional" hanyalah nama lokasi. |
| `international` | Beberapa negara atau satu benua. | |
| `online` | Kehadiran jarak jauh, terbuka tanpa melihat lokasi. | Acara di tempat lokal yang juga disiarkan langsung bukan `online`. |
| `unspecified` | Postingan tidak memberi dasar. Postingan tanpa tempat dan tanpa audiens, hanya "daftar lewat link di bio". Juga postingan yang hanya mengajak mengikuti (tidak ada yang diundang hadir). | |

## Contoh (karangan, bukan postingan asli)

| Postingan (ringkasan) | audience_country | geo_scope | eligibility | track_count | Alasan |
|---|---|---|---|---|---|
| Caption Indonesia dari akun mal: "Bazaar kuliner 12-14 Okt, Plaza X, gratis masuk" | `id` | `venue_local` | `open_to_public` | 1 | Tidak ada yang lebih luas disebut; ditulis untuk orang di sekitar mal. |
| Caption Indonesia: "Lomba esai tingkat nasional, terbuka untuk mahasiswa seluruh Indonesia", di kampus Surabaya | `id` | `national` | `open_to_public` | 1 | Seluruh negara diundang; kampus hanya lokasi. |
| Caption Indonesia dari kurator Indonesia: "Jadwal Denmark Open 2026, dukung wakil Indonesia!" | `id` | `unspecified` | `open_to_public` | 1 | Ditulis untuk pengikut Indonesia padahal acaranya di Denmark. Tidak ada yang diundang hadir, jadi tidak ada cakupan kehadiran: postingan sekadar mengikuti diberi `unspecified`; audiensnya tetap `id`. |
| Caption Inggris, harga dalam Rp, jam WIB, akun Bali: "Sunset yoga for expats, Rp 150k" | `id` | `city` | `open_to_public` | 1 | Bahasa Inggris saja tidak menunjukkan negara; Rp, WIB, dan akunnya menunjukkan Indonesia. |
| Caption Inggris, harga dalam S$, akun Singapura | `sg` | `city` | `open_to_public` | 1 | Bahasa sama, petunjuk berbeda. |
| Caption Inggris, tanpa harga, tanpa petunjuk tempat atau akun | `unclear` | `unspecified` | `open_to_public` | 1 | Bahasa bersama dan tanpa petunjuk kedua: jangan menebak. |
| "Kids Dash 6-10 th, 5K 12+, 10K 17+, Master 45+" | sesuai petunjuk lain | sesuai petunjuk lain | `open_to_public` | 4 | Empat kategori terpisah; usia tertulis. |
| "Webinar karir untuk mahasiswa Yogyakarta via Zoom" | `id` | `region` atau `city` (tulis yang didukung teks) | `open_to_public` | 1 | Daring, tetapi audiensnya disebut (mahasiswa Yogyakarta). |

## Setelah selesai

Simpan lembar, beri tahu pemilik, baru kemudian dibandingkan. Perbedaan jawaban itu wajar; pemilik memutuskan tiap perbedaan satu kali, setelah kedua lembar final.
