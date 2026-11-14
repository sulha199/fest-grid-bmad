# Copy keys, English and Indonesian (Epic 10 job screens)

Companion to `EXPERIENCE.md`. Each block is valid JSON that can be merged into `apps/web/locales/en.json` and
`apps/web/locales/id.json`. Rules the story author must keep:

- Plain words. No vendor name, no raw error, no caption, no URL in any key an ordinary user can see.
- ICU plurals as the existing files do (`{count, plural, one {...} other {...}}`). Indonesian has one plural form, so it uses `other` only (or no plural at all).
- Dates and times are formatted by code with the active locale (`useFormatter`/`Intl`), and passed in as already-formatted strings (`{time}`, `{duration}`). Durations use `Intl.NumberFormat` with `style: 'unit'`. Never interpolate a raw ISO string or number.
- Lists of missing images use `Intl.ListFormat` for the locale.
- Keys marked `[OPEN D1]`, `[OPEN D3]`, `[OPEN D4]` belong to the owner's lookup-fallback decisions and are **placeholders that are not rendered** until those decisions are made (see EXPERIENCE.md, "Open slots").
- Reason codes are looked up as `reason.<CODE>`. An unknown code falls back to `reason.GENERIC`.
- Namespaces: new `Jobs` (Story 10.4), new `SubscriptionCap` (Story 10.3a, namespace fixed by that story), existing `ReextractPreview` extended (Story 10.6a, fixed here). Small additions to `Metadata` and `UserMenu`.
- Paging labels come from the existing `Pagination` namespace, unchanged.
- Two keys were added while building Story 10.4 and are in the blocks below: `Jobs.jobLoadError` (the single-job load error, "We could not load this job."; `loadError` is the list wording) and `Jobs.type.OTHER` (the label of a job type the copy has no entry for, from `JobType.OTHER`).

## 1. `Jobs` namespace (Story 10.4)

### English

```json
{
  "Jobs": {
    "pageTitle": "Jobs",
    "pageDescription": "Follow the work running in the background, like adding accounts and extracting posts.",
    "backToJobs": "Jobs",
    "activeHeading": "In progress",
    "activeEmpty": "Nothing is running right now.",
    "historyHeading": "Finished",
    "emptyTitle": "No jobs yet",
    "emptyBody": "When you add an account or extract posts, you can follow the work here.",
    "filteredEmptyTitle": "No jobs match these filters",
    "clearFilters": "Clear filters",
    "loadError": "We could not load your jobs.",
    "jobLoadError": "We could not load this job.",
    "tryAgain": "Try again",
    "reconnecting": "Reconnecting. Showing the last known progress.",
    "notFound": "This job was not found.",
    "filters": {
      "scopeLabel": "Show",
      "scopeMine": "My jobs",
      "scopeAll": "All users",
      "includeSystem": "Include system jobs"
    },
    "row": {
      "openDetails": "Open details: {title}, {status}",
      "startedAt": "Started {time}",
      "runningFor": "Running for {duration}",
      "tookDuration": "Took {duration}",
      "queuePosition": "{position, plural, =1 {Next in line} other {Number # in line}}",
      "nextTry": "Next try {time}",
      "startedBy": "Started by {name}",
      "systemJob": "System job"
    },
    "type": {
      "SUBSCRIBE": "Adding an account",
      "PROFILE_LOOKUP": "Looking up an account",
      "ACCOUNT_REFRESH": "Checking an account for new posts",
      "CORRECTION": "Correcting an event",
      "EXTRACT_FROM_URL": "Extracting from a post link",
      "EXTRACT_SELECTED_POSTS": "Extracting selected posts",
      "REEXTRACT_REFRESH": "Re-extracting a post",
      "ADMIN_OPERATION": "Moderator operation",
      "OTHER": "Background job"
    },
    "subject": {
      "account": "@{handle}",
      "posts": "{count, plural, one {# post} other {# posts}}",
      "post": "Post {code}",
      "unknown": "Unknown"
    },
    "status": {
      "QUEUED": "Waiting for a place",
      "RUNNING": "In progress",
      "WAITING": "Waiting",
      "SUCCEEDED": "Done",
      "SUCCEEDED_WITH_LIMITS": "Done, with limits",
      "FAILED": "Failed",
      "EXPIRED": "Expired",
      "CANCELLED": "Cancelled"
    },
    "chip": {
      "ariaLabel": "Show progress: {title}. {status}",
      "queued": "Waiting for a place (#{position})",
      "running": "In progress: step {current} of {total}",
      "runningNoSteps": "In progress",
      "waiting": "Waiting",
      "waitingUntil": "Waiting until {time}",
      "done": "Done",
      "doneWithLimits": "Done, with limits",
      "failed": "Failed",
      "expired": "Expired",
      "cancelled": "Cancelled"
    },
    "dialog": {
      "description": "You can minimize this and keep using the app. The work continues in the background.",
      "minimize": "Minimize",
      "close": "Close",
      "seeAllInJobs": "See all in Jobs",
      "viewDetails": "View details",
      "leavingNote": "Leaving this page does not stop it.",
      "elapsed": "Running for {duration}",
      "stepsLabel": "Steps",
      "stepOf": "Step {current} of {total}",
      "stepStateDone": "done",
      "stepStateCurrent": "in progress",
      "stepStatePending": "not started",
      "stepStateSkipped": "skipped",
      "countDetail": "{done} of {total} finished"
    },
    "queued": {
      "title": "Waiting for a free place",
      "body": "You can run {limit} jobs at once and all {limit} places are in use. This one will start by itself.",
      "expires": "If it has not started by {time}, it will be dropped."
    },
    "waiting": {
      "title": "Waiting",
      "retryAt": "Waiting to try again at {time}.",
      "result": "Waiting for the answer to arrive. This can take a few minutes.",
      "extraction": "Waiting for the posts to finish extracting ({done} of {total} done).",
      "extractionRetryAt": "Waiting to retry a post at {time}.",
      "noPlaceHeld": "You can start other jobs in the meantime."
    },
    "outcome": {
      "succeededTitle": "Done",
      "limitsTitle": "Finished with what we had",
      "failedTitle": "Could not finish",
      "expiredTitle": "Stopped",
      "cancelledTitle": "Cancelled",
      "lateResult": "The answer arrived late but was still used.",
      "openAccount": "Open the account",
      "openPreview": "Open the preview",
      "viewEvents": "See the events",
      "eventsFromPosts": "{events, plural, one {# event} other {# events}} from {posts, plural, one {# post} other {# posts}}",
      "took": "Took {duration}",
      "started": "Started {time}",
      "finished": "Finished {time}"
    },
    "reason": {
      "ACCOUNT_NOT_FOUND": "We could not find this account. Check the spelling and try another handle.",
      "ACCOUNT_PRIVATE": "This account is private, so its posts cannot be read.",
      "NO_PROVIDER_REACHABLE": "We could not reach the platform right now. Try again in a few minutes.",
      "PROVIDER_OVER_QUOTA": "The service is busy at the moment. Try again later.",
      "ACCOUNT_TYPE_NOT_SCRAPED": "This type of account is not scraped, so nothing was fetched.",
      "POST_UNAVAILABLE": "The post is no longer available on the platform.",
      "COOLDOWN": "This was tried a moment ago. You can try again at {time}.",
      "TIMED_OUT": "It took too long and was stopped. Try again.",
      "CANCELLED": "It was cancelled.",
      "WAITED_TOO_LONG": "It waited more than {minutes} minutes for a free place and was dropped. Try again when your other jobs have finished.",
      "SOME_POSTS_NOT_EXTRACTED": "Some posts could not be extracted. You can retry them.",
      "REFRESH_IN_PROGRESS": "Another request is fetching this post right now. Try again in a minute.",
      "REFRESH_DID_NOT_HEAL_IMAGES": "A provider answered, but its images could not be used, so the stored images were used.",
      "POST_NOT_FOUND": "The post was removed while this was waiting.",
      "CHAIN_IN_FLIGHT": "This post is already being extracted. Try again when that finishes.",
      "QUOTA_EXHAUSTED": "No AI key had quota left. Try again tomorrow.",
      "EXTRACTION_FAILED": "We could not finish reading this post. Try again.",
      "VENDOR_RUN_FAILED": "The platform did not return what we needed. Try again.",
      "GENERIC": "Something went wrong on our side. Try again, and if it keeps happening, tell us."
    },
    "actions": {
      "retry": "Retry",
      "retryAt": "Retry at {time}",
      "retryStarted": "Started again.",
      "retryReused": "This is already running.",
      "startQueueFull": "Too many jobs are waiting ({max}). Open Jobs to see them.",
      "startQueueFullLink": "Open Jobs"
    },
    "moderator": {
      "detailsSummary": "Technical details (moderators)",
      "attemptsHeading": "Provider attempts",
      "noAttempts": "No provider was tried.",
      "attemptProvider": "Provider",
      "attemptOutcome": "Result",
      "attemptBudget": "Time given",
      "attemptElapsed": "Time used",
      "attemptReason": "Reason",
      "engineReason": "Engine reason code",
      "engineMessage": "Engine message",
      "jobId": "Job ID",
      "trigger": "Started by",
      "triggerUser": "A user",
      "triggerSystem": "The system",
      "provider": { "APIFY": "Apify", "BRIGHT_DATA": "Bright Data" },
      "outcome": {
        "SUCCEEDED": "Succeeded",
        "FAILED": "Failed",
        "EMPTY": "Returned nothing",
        "TIMED_OUT": "Ran out of time",
        "OVER_QUOTA": "Over quota",
        "SKIPPED": "Skipped"
      }
    },
    "phase": {
      "generic": { "working": "Working on it" },
      "REEXTRACT_REFRESH": {
        "refresh": "Fetching fresh images",
        "preview": "Reading the post and finding events"
      },
      "SUBSCRIBE": {
        "lookup": "Finding the account",
        "classify": "Checking what kind of account it is",
        "firstScrape": "Fetching its first posts"
      },
      "PROFILE_LOOKUP": { "lookup": "Finding the account" },
      "ACCOUNT_REFRESH": { "scrape": "Fetching new posts" },
      "EXTRACT_SELECTED_POSTS": {
        "start": "Queueing the posts",
        "extract": "Extracting events"
      },
      "EXTRACT_FROM_URL": {
        "fetch": "Fetching the post",
        "extract": "Extracting events"
      },
      "CORRECTION": {
        "fetch": "Fetching the post",
        "apply": "Preparing the correction"
      },
      "ADMIN_OPERATION": {
        "dryRun": "Checking what would change",
        "apply": "Applying the change"
      }
    },
    "announce": {
      "started": "{title} started.",
      "queued": "{title} is waiting for a free place. {position}",
      "running": "{title} is now in progress.",
      "step": "{title}: step {current} of {total}, {step}.",
      "waiting": "{title} is waiting. {reason}",
      "succeeded": "{title} is done.",
      "limits": "{title} finished with limits. {reason}",
      "failed": "{title} failed. {reason}",
      "expired": "{title} was stopped. {reason}",
      "cancelled": "{title} was cancelled.",
      "minimized": "Progress minimized. The job keeps running.",
      "reopened": "Progress opened.",
      "listUpdated": "{count, plural, one {# job updated} other {# jobs updated}}"
    },
    "lookup": {
      "leaveNote": "[OPEN D1] You can leave this page. We will tell you when it is done.",
      "slow": "[OPEN D3] This is taking longer than usual. Still looking for {handle}.",
      "voteCounted": "[OPEN D4] Your vote was counted.",
      "voteConfirm": "[OPEN D4] Confirm your vote for this account.",
      "voteUndo": "[OPEN D4] Undo vote"
    }
  }
}
```

### Indonesian

```json
{
  "Jobs": {
    "pageTitle": "Tugas",
    "pageDescription": "Pantau proses yang berjalan di latar belakang, seperti menambah akun dan mengekstrak postingan.",
    "backToJobs": "Tugas",
    "activeHeading": "Sedang berjalan",
    "activeEmpty": "Tidak ada yang berjalan saat ini.",
    "historyHeading": "Selesai",
    "emptyTitle": "Belum ada tugas",
    "emptyBody": "Saat Anda menambah akun atau mengekstrak postingan, Anda dapat memantau prosesnya di sini.",
    "filteredEmptyTitle": "Tidak ada tugas yang cocok dengan filter ini",
    "clearFilters": "Hapus filter",
    "loadError": "Kami tidak dapat memuat tugas Anda.",
    "jobLoadError": "Kami tidak dapat memuat tugas ini.",
    "tryAgain": "Coba lagi",
    "reconnecting": "Menyambung kembali. Menampilkan kemajuan terakhir yang diketahui.",
    "notFound": "Tugas ini tidak ditemukan.",
    "filters": {
      "scopeLabel": "Tampilkan",
      "scopeMine": "Tugas saya",
      "scopeAll": "Semua pengguna",
      "includeSystem": "Sertakan tugas sistem"
    },
    "row": {
      "openDetails": "Buka detail: {title}, {status}",
      "startedAt": "Dimulai {time}",
      "runningFor": "Berjalan selama {duration}",
      "tookDuration": "Memakan waktu {duration}",
      "queuePosition": "{position, plural, =1 {Berikutnya dalam antrean} other {Nomor # dalam antrean}}",
      "nextTry": "Percobaan berikutnya {time}",
      "startedBy": "Dimulai oleh {name}",
      "systemJob": "Tugas sistem"
    },
    "type": {
      "SUBSCRIBE": "Menambahkan akun",
      "PROFILE_LOOKUP": "Mencari akun",
      "ACCOUNT_REFRESH": "Memeriksa postingan baru dari akun",
      "CORRECTION": "Mengoreksi acara",
      "EXTRACT_FROM_URL": "Mengekstrak dari tautan postingan",
      "EXTRACT_SELECTED_POSTS": "Mengekstrak postingan terpilih",
      "REEXTRACT_REFRESH": "Mengekstrak ulang postingan",
      "ADMIN_OPERATION": "Operasi moderator",
      "OTHER": "Proses latar belakang"
    },
    "subject": {
      "account": "@{handle}",
      "posts": "{count} postingan",
      "post": "Postingan {code}",
      "unknown": "Tidak diketahui"
    },
    "status": {
      "QUEUED": "Menunggu giliran",
      "RUNNING": "Sedang berjalan",
      "WAITING": "Menunggu",
      "SUCCEEDED": "Selesai",
      "SUCCEEDED_WITH_LIMITS": "Selesai, dengan batasan",
      "FAILED": "Gagal",
      "EXPIRED": "Kedaluwarsa",
      "CANCELLED": "Dibatalkan"
    },
    "chip": {
      "ariaLabel": "Tampilkan kemajuan: {title}. {status}",
      "queued": "Menunggu giliran (nomor {position})",
      "running": "Berjalan: langkah {current} dari {total}",
      "runningNoSteps": "Sedang berjalan",
      "waiting": "Menunggu",
      "waitingUntil": "Menunggu sampai {time}",
      "done": "Selesai",
      "doneWithLimits": "Selesai, dengan batasan",
      "failed": "Gagal",
      "expired": "Kedaluwarsa",
      "cancelled": "Dibatalkan"
    },
    "dialog": {
      "description": "Anda dapat memperkecil ini dan terus memakai aplikasi. Prosesnya tetap berjalan di latar belakang.",
      "minimize": "Perkecil",
      "close": "Tutup",
      "seeAllInJobs": "Lihat semua di Tugas",
      "viewDetails": "Lihat detail",
      "leavingNote": "Meninggalkan halaman ini tidak menghentikannya.",
      "elapsed": "Berjalan selama {duration}",
      "stepsLabel": "Langkah",
      "stepOf": "Langkah {current} dari {total}",
      "stepStateDone": "selesai",
      "stepStateCurrent": "sedang berjalan",
      "stepStatePending": "belum dimulai",
      "stepStateSkipped": "dilewati",
      "countDetail": "{done} dari {total} selesai"
    },
    "queued": {
      "title": "Menunggu tempat kosong",
      "body": "Anda dapat menjalankan {limit} proses sekaligus dan semua {limit} tempat sedang terpakai. Proses ini akan mulai sendiri.",
      "expires": "Jika belum mulai sebelum {time}, proses ini akan dihentikan."
    },
    "waiting": {
      "title": "Menunggu",
      "retryAt": "Menunggu untuk mencoba lagi pukul {time}.",
      "result": "Menunggu jawaban datang. Ini bisa memakan waktu beberapa menit.",
      "extraction": "Menunggu postingan selesai diekstrak ({done} dari {total} selesai).",
      "extractionRetryAt": "Menunggu untuk mencoba ulang satu postingan pukul {time}.",
      "noPlaceHeld": "Sementara itu, Anda dapat memulai proses lain."
    },
    "outcome": {
      "succeededTitle": "Selesai",
      "limitsTitle": "Selesai dengan data yang ada",
      "failedTitle": "Tidak dapat diselesaikan",
      "expiredTitle": "Dihentikan",
      "cancelledTitle": "Dibatalkan",
      "lateResult": "Jawaban datang terlambat tetapi tetap dipakai.",
      "openAccount": "Buka akun",
      "openPreview": "Buka pratinjau",
      "viewEvents": "Lihat acaranya",
      "eventsFromPosts": "{events} acara dari {posts} postingan",
      "took": "Memakan waktu {duration}",
      "started": "Dimulai {time}",
      "finished": "Selesai {time}"
    },
    "reason": {
      "ACCOUNT_NOT_FOUND": "Kami tidak menemukan akun ini. Periksa ejaannya dan coba nama pengguna lain.",
      "ACCOUNT_PRIVATE": "Akun ini privat, sehingga postingannya tidak dapat dibaca.",
      "NO_PROVIDER_REACHABLE": "Kami tidak dapat menjangkau platform saat ini. Coba lagi dalam beberapa menit.",
      "PROVIDER_OVER_QUOTA": "Layanan sedang sibuk saat ini. Coba lagi nanti.",
      "ACCOUNT_TYPE_NOT_SCRAPED": "Jenis akun ini tidak diambil datanya, jadi tidak ada yang diambil.",
      "POST_UNAVAILABLE": "Postingan ini sudah tidak tersedia di platform.",
      "COOLDOWN": "Ini baru saja dicoba. Anda dapat mencoba lagi pukul {time}.",
      "TIMED_OUT": "Prosesnya terlalu lama dan dihentikan. Coba lagi.",
      "CANCELLED": "Proses ini dibatalkan.",
      "WAITED_TOO_LONG": "Proses ini menunggu lebih dari {minutes} menit untuk mendapat tempat dan dihentikan. Coba lagi setelah proses Anda yang lain selesai.",
      "SOME_POSTS_NOT_EXTRACTED": "Beberapa postingan tidak dapat diekstrak. Anda dapat mencobanya lagi.",
      "REFRESH_IN_PROGRESS": "Permintaan lain sedang mengambil postingan ini. Coba lagi dalam semenit.",
      "REFRESH_DID_NOT_HEAL_IMAGES": "Penyedia menjawab, tetapi gambarnya tidak dapat dipakai, sehingga gambar yang tersimpan dipakai.",
      "POST_NOT_FOUND": "Postingan dihapus selagi proses ini menunggu.",
      "CHAIN_IN_FLIGHT": "Postingan ini sedang diekstrak. Coba lagi setelah selesai.",
      "QUOTA_EXHAUSTED": "Tidak ada kunci AI yang kuotanya tersisa. Coba lagi besok.",
      "EXTRACTION_FAILED": "Kami tidak dapat menyelesaikan pembacaan postingan ini. Coba lagi.",
      "VENDOR_RUN_FAILED": "Platform tidak mengembalikan data yang kami butuhkan. Coba lagi.",
      "GENERIC": "Terjadi masalah di pihak kami. Coba lagi; jika terus terjadi, beri tahu kami."
    },
    "actions": {
      "retry": "Coba lagi",
      "retryAt": "Coba lagi pukul {time}",
      "retryStarted": "Dimulai lagi.",
      "retryReused": "Ini sudah berjalan.",
      "startQueueFull": "Terlalu banyak proses yang menunggu ({max}). Buka Tugas untuk melihatnya.",
      "startQueueFullLink": "Buka Tugas"
    },
    "moderator": {
      "detailsSummary": "Detail teknis (moderator)",
      "attemptsHeading": "Percobaan penyedia",
      "noAttempts": "Tidak ada penyedia yang dicoba.",
      "attemptProvider": "Penyedia",
      "attemptOutcome": "Hasil",
      "attemptBudget": "Waktu yang diberikan",
      "attemptElapsed": "Waktu yang dipakai",
      "attemptReason": "Alasan",
      "engineReason": "Kode alasan mesin",
      "engineMessage": "Pesan mesin",
      "jobId": "ID tugas",
      "trigger": "Dimulai oleh",
      "triggerUser": "Pengguna",
      "triggerSystem": "Sistem",
      "provider": { "APIFY": "Apify", "BRIGHT_DATA": "Bright Data" },
      "outcome": {
        "SUCCEEDED": "Berhasil",
        "FAILED": "Gagal",
        "EMPTY": "Tidak mengembalikan apa pun",
        "TIMED_OUT": "Kehabisan waktu",
        "OVER_QUOTA": "Melebihi kuota",
        "SKIPPED": "Dilewati"
      }
    },
    "phase": {
      "generic": { "working": "Sedang diproses" },
      "REEXTRACT_REFRESH": {
        "refresh": "Mengambil gambar terbaru",
        "preview": "Membaca postingan dan mencari acara"
      },
      "SUBSCRIBE": {
        "lookup": "Mencari akun",
        "classify": "Memeriksa jenis akun",
        "firstScrape": "Mengambil postingan pertamanya"
      },
      "PROFILE_LOOKUP": { "lookup": "Mencari akun" },
      "ACCOUNT_REFRESH": { "scrape": "Mengambil postingan baru" },
      "EXTRACT_SELECTED_POSTS": {
        "start": "Memasukkan postingan ke antrean",
        "extract": "Mengekstrak acara"
      },
      "EXTRACT_FROM_URL": {
        "fetch": "Mengambil postingan",
        "extract": "Mengekstrak acara"
      },
      "CORRECTION": {
        "fetch": "Mengambil postingan",
        "apply": "Menyiapkan koreksi"
      },
      "ADMIN_OPERATION": {
        "dryRun": "Memeriksa apa yang akan berubah",
        "apply": "Menerapkan perubahan"
      }
    },
    "announce": {
      "started": "{title} dimulai.",
      "queued": "{title} menunggu tempat kosong. {position}",
      "running": "{title} kini berjalan.",
      "step": "{title}: langkah {current} dari {total}, {step}.",
      "waiting": "{title} menunggu. {reason}",
      "succeeded": "{title} selesai.",
      "limits": "{title} selesai dengan batasan. {reason}",
      "failed": "{title} gagal. {reason}",
      "expired": "{title} dihentikan. {reason}",
      "cancelled": "{title} dibatalkan.",
      "minimized": "Kemajuan diperkecil. Prosesnya tetap berjalan.",
      "reopened": "Kemajuan dibuka.",
      "listUpdated": "{count} tugas diperbarui"
    },
    "lookup": {
      "leaveNote": "[OPEN D1] Anda dapat meninggalkan halaman ini. Kami akan memberi tahu saat selesai.",
      "slow": "[OPEN D3] Ini memakan waktu lebih lama dari biasanya. Masih mencari {handle}.",
      "voteCounted": "[OPEN D4] Suara Anda sudah dihitung.",
      "voteConfirm": "[OPEN D4] Konfirmasi suara Anda untuk akun ini.",
      "voteUndo": "[OPEN D4] Batalkan suara"
    }
  }
}
```

Notes on the phase keys: `REEXTRACT_REFRESH` phases are real (`refresh`, `preview`, from the engine). The others are the **proposed step lists** each adoption story (10.7, 10.9, 10.10, 10.11, 10.12, 10.12a) confirms or renames when it defines its handler's phases; a type that declares none shows `phase.generic.working`. A phase that is not in the table also falls back to `generic.working`.

## 2. `SubscriptionCap` namespace (Story 10.3a)

### English

```json
{
  "SubscriptionCap": {
    "title": "You have reached your limit",
    "body": "{reserved, plural, =0 {You have {active, plural, one {# account} other {# accounts}} added. The limit is {cap}.} one {You have {active, plural, one {# account} other {# accounts}} added and # more being added. The limit is {cap}.} other {You have {active, plural, one {# account} other {# accounts}} added and # more being added. The limit is {cap}.}}",
    "hint": "Remove an account you no longer need to make room. If an account being added fails, its place is freed.",
    "blockedNote": "Adding another account is paused until you are under the limit.",
    "upgradeButton": "Upgrade",
    "comingSoonBadge": "Coming soon",
    "comingSoonNote": "Paid plans with a higher limit are not available yet.",
    "afterClickNote": "Thanks for your interest. Paid plans are not available yet.",
    "manageLink": "Manage subscribed accounts",
    "dialogTitle": "You have reached your limit",
    "closeButton": "Close",
    "restoreFailedToast": "Could not restore the account. You have reached your limit of {cap}.",
    "announce": "Limit reached. {body}"
  }
}
```

### Indonesian

```json
{
  "SubscriptionCap": {
    "title": "Anda telah mencapai batas",
    "body": "{reserved, plural, =0 {Anda memiliki {active} akun yang sudah ditambahkan. Batasnya {cap}.} other {Anda memiliki {active} akun yang sudah ditambahkan dan {reserved} lagi sedang ditambahkan. Batasnya {cap}.}}",
    "hint": "Hapus akun yang tidak lagi Anda perlukan untuk memberi ruang. Jika akun yang sedang ditambahkan gagal, tempatnya dikosongkan kembali.",
    "blockedNote": "Menambah akun lain dijeda sampai jumlah Anda di bawah batas.",
    "upgradeButton": "Tingkatkan",
    "comingSoonBadge": "Segera hadir",
    "comingSoonNote": "Paket berbayar dengan batas lebih tinggi belum tersedia.",
    "afterClickNote": "Terima kasih atas minat Anda. Paket berbayar belum tersedia.",
    "manageLink": "Kelola akun yang diikuti",
    "dialogTitle": "Anda telah mencapai batas",
    "closeButton": "Tutup",
    "restoreFailedToast": "Akun tidak dapat dipulihkan. Anda telah mencapai batas {cap} akun.",
    "announce": "Batas tercapai. {body}"
  }
}
```

Interpolation: `active`, `reserved` and `cap` are numbers from the error's `extensions`; they are formatted by next-intl with the active locale. Accessible name of the Upgrade button: `upgradeButton` plus its description `comingSoonNote`.

## 3. `ReextractPreview` additions (Story 10.6a)

New keys on the existing namespace. Remove `running` ("Extracting. This can take up to a minute."): the shared progress view replaces it. Keep `imagesShortfall` only until the banner replaces its one use, then remove it. `dialogTitle`, `retry` (the failed-state "Try again") and `genericError` stay.

### English

```json
{
  "ReextractPreview": {
    "progressTitle": "Re-extracting this post",
    "chipPreviewReady": "Preview ready",
    "chipPreviewLimits": "Preview ready (some images missing)",
    "openPreview": "Open preview",
    "bannerTitle": "{read} of {available} images were read",
    "bannerMissing": "Not read: {list}.",
    "imageCover": "the cover",
    "imageSlideSingle": "slide {n}",
    "imageSlideRange": "slides {from} to {to}",
    "bannerOverCap": "Only the first {cap} slides are read in a preview.",
    "causeExpiredRefreshFailed": "The image links have expired and refreshing them failed.",
    "causeNotHealed": "A provider answered, but its images could not be used, so the stored links, which have expired, were used.",
    "causeRefreshRunning": "The refresh is still running. If it finishes later, the fresh images are saved to the post.",
    "causeCooldown": "The images were refreshed less than 10 minutes ago, so a new refresh was not tried. You can try again at {time}.",
    "causeNotScraped": "This account is not scraped, so its images were not refreshed.",
    "causePostGone": "The post is no longer available on the platform.",
    "causeInFlight": "Another request is fetching this post right now.",
    "causeTimedOut": "Refreshing the images took too long.",
    "causeNoProvider": "No provider could be reached to refresh the images.",
    "causeOverQuota": "Every provider has used up its quota, so the images were not refreshed.",
    "bannerApplyNote": "You can still apply this preview. Events shown only on unread images will be missing.",
    "bannerRetry": "Retry",
    "bannerRetryAt": "Retry at {time}",
    "bannerRetryHint": "Retrying fetches the images again, then reads the post again.",
    "attachTooOld": "This preview is too old to apply. Start a new one.",
    "startNew": "Re-extract again"
  }
}
```

### Indonesian

```json
{
  "ReextractPreview": {
    "progressTitle": "Mengekstrak ulang postingan ini",
    "chipPreviewReady": "Pratinjau siap",
    "chipPreviewLimits": "Pratinjau siap (sebagian gambar hilang)",
    "openPreview": "Buka pratinjau",
    "bannerTitle": "{read} dari {available} gambar dibaca",
    "bannerMissing": "Tidak terbaca: {list}.",
    "imageCover": "sampul",
    "imageSlideSingle": "slide {n}",
    "imageSlideRange": "slide {from} sampai {to}",
    "bannerOverCap": "Pratinjau hanya membaca {cap} slide pertama.",
    "causeExpiredRefreshFailed": "Tautan gambar sudah kedaluwarsa dan pembaruannya gagal.",
    "causeNotHealed": "Penyedia menjawab, tetapi gambarnya tidak dapat dipakai, sehingga tautan tersimpan yang sudah kedaluwarsa dipakai.",
    "causeRefreshRunning": "Pembaruan masih berjalan. Jika selesai nanti, gambar terbaru disimpan ke postingan.",
    "causeCooldown": "Gambar baru diperbarui kurang dari 10 menit lalu, jadi pembaruan baru tidak dicoba. Anda dapat mencoba lagi pukul {time}.",
    "causeNotScraped": "Akun ini tidak diambil datanya, jadi gambarnya tidak diperbarui.",
    "causePostGone": "Postingan ini sudah tidak tersedia di platform.",
    "causeInFlight": "Permintaan lain sedang mengambil postingan ini.",
    "causeTimedOut": "Memperbarui gambar memakan waktu terlalu lama.",
    "causeNoProvider": "Tidak ada penyedia yang dapat dijangkau untuk memperbarui gambar.",
    "causeOverQuota": "Semua penyedia telah menghabiskan kuotanya, jadi gambar tidak diperbarui.",
    "bannerApplyNote": "Anda tetap dapat menerapkan pratinjau ini. Acara yang hanya tampil di gambar yang tidak terbaca akan hilang.",
    "bannerRetry": "Coba lagi",
    "bannerRetryAt": "Coba lagi pukul {time}",
    "bannerRetryHint": "Mencoba lagi akan mengambil gambar kembali, lalu membaca postingan lagi.",
    "attachTooOld": "Pratinjau ini terlalu lama untuk diterapkan. Mulai yang baru.",
    "startNew": "Ekstrak ulang lagi"
  }
}
```

Which cause key the banner uses is chosen from the job's refresh outcome (graphql-read-shape.md, `JobRefreshReport`): `NO_PROVIDER_REACHABLE` -> `causeNoProvider` joined with `causeExpiredRefreshFailed` when links expired; `PROVIDER_OVER_QUOTA` -> `causeOverQuota`; `TIMED_OUT` -> `causeTimedOut`; `lateResultPending` -> `causeRefreshRunning`; `COOLDOWN` -> `causeCooldown`; `NOT_SCRAPED` -> `causeNotScraped`; `POST_UNAVAILABLE` -> `causePostGone`; `IN_FLIGHT` -> `causeInFlight`; refreshed but nothing saved -> `causeNotHealed`. Two sentences may be shown together (the cause and, when links expired, "the image links have expired and refreshing them failed").

## 4. Small additions

`Metadata` (apps/web/locales):

| Key | English | Indonesian |
|---|---|---|
| `jobsTitle` | Jobs \| FestDaily | Tugas \| FestDaily |
| `jobsDescription` | Follow the work running in the background on FestDaily. | Pantau proses yang berjalan di latar belakang di FestDaily. |
| `jobDetailTitle` | Job details \| FestDaily | Detail tugas \| FestDaily |
| `jobDetailDescription` | See the progress and result of one job. | Lihat kemajuan dan hasil satu tugas. |

`UserMenu`:

| Key | English | Indonesian |
|---|---|---|
| `jobs` | Jobs | Tugas |
| `jobsBadgeLabel` (Story 10.13, notify when a job finishes) | `{count, plural, one {# job finished since you last looked} other {# jobs finished since you last looked}}` | `{count} tugas selesai sejak terakhir Anda melihat` |
