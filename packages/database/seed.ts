import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  apiKeys,
  events,
  posts,
  schedules,
  subscriptions,
  userLocations,
  users,
  socialMediaAccountProfiles,
  reports,
  scraperActorRuns,
  unprocessedScraperPayloads,
  parserVersionRegistry,
} from './schema';
import { loadDatabaseEnv } from './env';
import { getTablesInDeleteOrder } from './delete-order';

const FIXTURE_USERS = [
  {
    id: '8d01845c-dc75-4e71-890d-49893bfa366e',
    email: 'shulha.y@gmail.com',
    name: 'Shulha Yahya',
    avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKEXBNmDikdKpUoR0tEbZiT7EcBsFOSZ7j6PeyFLxxvhmo=s96-c',
    role: 'moderator' as const,
  },
  {
    id: 'b340aae2-ea44-43e7-9745-2b9c38f8f892',
    email: 'festdailyapps@gmail.com',
    name: 'FestDaily Apps',
    avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKTsMqAPgUw06qKWJ2RRoD3FMEJBaXXQkXyR_RCCz05xSAm=s96-c',
    role: 'user' as const,
  },
];

const FIXTURE_USER_LOCATIONS = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    name: 'Home Jakarta',
    latitude: -6.2088,
    longitude: 106.8456,
    radius: 5000,
    locationDetails: {
      coordinates: { latitude: -6.2088, longitude: 106.8456 },
      formattedAddress: 'Jakarta, Indonesia',
      placeName: 'Jakarta',
      provider: 'GEOAPIFY' as const
    },
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    name: 'Work Bandung',
    latitude: -6.9175,
    longitude: 107.6191,
    radius: 8000,
    locationDetails: {
      coordinates: { latitude: -6.9175, longitude: 107.6191 },
      formattedAddress: 'Bandung, West Java, Indonesia',
      placeName: 'Bandung',
      provider: 'GEOAPIFY' as const
    },
  },
];

const FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    accountId: 'ig_jkt_events',
    platform: 'instagram',
    displayName: 'Jakarta City Events',
    username: 'jktcity.events',
    profileImageUrl: 'https://images.example.com/profiles/jktcity-events.png',
    description: 'Curated arts and music events around Jakarta.',
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    accountId: 'ig_bdg_family',
    platform: 'instagram',
    displayName: 'Bandung Family Weekend',
    username: 'bdg.family.weekend',
    profileImageUrl: 'https://images.example.com/profiles/bdg-family-weekend.png',
    description: 'Family-friendly community activities and workshops.',
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    accountId: '2237970730',
    platform: 'instagram',
    displayName: 'Pakuwon Mall Jogja',
    username: 'pakuwonmall.jogja',
    profileImageUrl: 'https://images.example.com/profiles/pakuwonmall.jogja.png',
    description: 'Pakuwon Mall Jogja - The largest shopping mall in Yogyakarta.',
  },
  {
    id: '70000000-0000-0000-0000-000000000004',
    accountId: '7299244171',
    platform: 'instagram',
    displayName: 'Museum Mandala Bhakti Wanitatama',
    username: 'wanitatamajogja',
    profileImageUrl: 'https://images.example.com/profiles/wanitatamajogja.png',
    description: 'Wanitatama Museum, Hotel & Convention - Yogyakarta.',
  },
  {
    id: '70000000-0000-0000-0000-000000000005',
    accountId: '77287654816',
    platform: 'instagram',
    displayName: 'Chaanakya Ekadanta Academy',
    username: 'chaanakyaekadanta_academy',
    profileImageUrl: 'https://images.example.com/profiles/chaanakyaekadanta_academy.png',
    description: 'Chaanakya Ekadanta Academy.',
  },
];

const FIXTURE_SUBSCRIPTIONS = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[1].id,
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    userId: FIXTURE_USERS[0].id,
    accountId: '70000000-0000-0000-0000-000000000003',
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000004',
    userId: FIXTURE_USERS[1].id,
    accountId: '70000000-0000-0000-0000-000000000003',
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000005',
    userId: FIXTURE_USERS[0].id,
    accountId: '70000000-0000-0000-0000-000000000004',
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000006',
    userId: FIXTURE_USERS[1].id,
    accountId: '70000000-0000-0000-0000-000000000004',
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000007',
    userId: FIXTURE_USERS[0].id,
    accountId: '70000000-0000-0000-0000-000000000005',
    isNewlyAdded: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000008',
    userId: FIXTURE_USERS[1].id,
    accountId: '70000000-0000-0000-0000-000000000005',
    isNewlyAdded: true,
  },
];

const FIXTURE_API_KEYS = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    userId: FIXTURE_USERS[0].id,
    keyEncrypted: 'enc:key:alice:gemini:v1',
    keyLast4: 'key1',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    userId: FIXTURE_USERS[1].id,
    keyEncrypted: 'enc:key:bob:gemini:v1',
    keyLast4: 'key2',
    provider: 'gemini',
    isValid: true,
    invalidAttempts: 0,
  },
];

export const FIXTURE_POSTS = [
  {
    id: '60000000-0000-0000-0000-000000000001',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    platform: 'instagram',
    postUrl: 'https://instagram.com/jktcity.events/p/C1PASTJAZZ',
    imageUrl: 'https://media.storiesig.info/get?__sig=gMaHPAeSedQwJs90ezjNqg&__expires=1786891296&uri=https%3A%2F%2Fscontent-iad3-2.cdninstagram.com%2Fv%2Ft51.82787-15%2F764373463_18547291300074731_6625151285942470618_n.jpg%3Fstp%3Ddst-jpg_e35_p640x640_sh2.08_tt6%26efg%3DeyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMDgwLnNkci5yZWd1bGFyX3Bob3RvLmMyIn0%26_nc_ht%3Dscontent-iad3-2.cdninstagram.com%26_nc_cat%3D111%26_nc_oc%3DQ6cZ2gG71lr_0Zb9-3GQQMgXrgOfqprj1bN72lJjL9t8PV5TDeQlJpiFr0US1QmP8hxSHDu3xKzssWbppMxGXy8HVq3J%26_nc_ohc%3D7ImEO91qAUEQ7kNvwHa-x-l%26_nc_gid%3D495il2AOsdCk-Cv_ZgGa5A%26edm%3DAPU89FABAAAA%26ccb%3D7-5%26oh%3D00_AQGD7e1pO4B_AdvRx3t2xbOzv_IZVBCq4GLAhDrxkr5FTA%26oe%3D6A87AFB2%26_nc_sid%3Dbc0c2c&filename=764373463_18547291300074731_6625151285942470618_n.jpg',
    isExtracted: true,
    publishedAt: new Date('2025-01-20T10:00:00Z'),
    content: 'Get ready for an amazing Past Jazz Night 2025! #jazz #jakarta',
  },
  {
    id: '60000000-0000-0000-0000-000000000002',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    platform: 'instagram',
    postUrl: 'https://instagram.com/jktcity.events/p/C2ONGOING',
    imageUrl: 'https://instagram.fjog3-1.fna.fbcdn.net/v/t51.82787-15/774514171_18549917302074731_871993300237572_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2MzE4NzEyMDQ0MTM3NDk5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=bzLIjr247pcQ7kNvwE4A2bO&_nc_oc=AdoTUcJcRmj4kpDJwODS3wtkdhw8hgCgn8aG0xKcgZTX_7R9RkTy8dfc3UzcaiOeeeY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fjog3-1.fna&_nc_gid=3iRx6urxFBGuqtGdl6KjAA&_nc_ss=7a22e&oh=00_AQH5aWDuo6ILXcschT7sh9HpWw31kksQvdvzCg0yNvmURA&oe=6A87B9A9',
    isExtracted: true,
    publishedAt: new Date('2025-12-10T10:00:00Z'),
    content: 'The Ongoing Culture Fest 2026-2027 is finally here. #culture #festival',
  },
  {
    id: '60000000-0000-0000-0000-000000000003',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[1].id,
    platform: 'instagram',
    postUrl: 'https://instagram.com/bdg.family.weekend/p/C3UPCOMING',
    imageUrl: 'https://instagram.fjog3-1.fna.fbcdn.net/v/t51.82787-15/775824879_18550742479074731_9080506194245506423_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk2NTA0ODUyNzEyMjE5NzUyNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=dRV9sXct_V8Q7kNvwGKs8ZF&_nc_oc=AdqyrS2eqF60hKXWuYfXt8wV762DunR3AzHxB_5Or8Osu-n2gABO0JmTSRHLiAWDn3k&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=instagram.fjog3-1.fna&_nc_gid=3iRx6urxFBGuqtGdl6KjAA&_nc_ss=7a22e&oh=00_AQFTjCzqMHUxZfR3Gu6AwtcTYyZtuBIkkLOKznAw7hEsLA&oe=6A87BF28',
    isExtracted: true,
    publishedAt: new Date('2027-10-15T10:00:00Z'),
    content: 'Join us at the Upcoming Family Workshop 2027! Fun for all ages. #family #bandung',
  },
  {
    id: '60000000-0000-0000-0000-000000000004',
    accountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    platform: 'instagram',
    postUrl: 'https://instagram.com/jktcity.events/p/C4CANCELLATION',
    imageUrl: 'https://images.example.com/events/cancellation-threshold-test.jpg',
    isExtracted: true,
    publishedAt: new Date('2027-11-01T10:00:00Z'),
    content: 'Cancellation test post content. #cancellation',
  },
  {
    id: '60000000-0000-0000-0000-000000000005',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcQXaSEkf59/',
    imageUrl: 'https://scontent-mxp1-1.cdninstagram.com/v/t51.82787-15/775245008_18551962144074731_7220987309412874414_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2Nzc3Mzk3NzczMjI5Nzc2NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTI3Ny5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=M7GmNRSQlY4Q7kNvwFssj7w&_nc_oc=Ado3v_alYrNWuzbGSsTHrmcwChb6QvXnjJ7pOMcQruAQlsv8Aon-PJxhtCX4XAgtDIc&_nc_zt=23&_nc_ht=scontent-mxp1-1.cdninstagram.com&_nc_gid=yNXeyLuNCsmNNqsooQaTvw&_nc_ss=7ca8c&oh=00_AQHvixi6RdZJ38u0HSgvmLHYutIFQ-J79Clr4VTkmwAMJg&oe=6A8CFFB4',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T08:46:09.000Z'),
    content: "READY TO DANCE & COMPETE?\n\nSaatnya tunjukkan skill terbaikmu di PAKUWON DANCE COMPETITION!\n\n\ud83c\udfc6 TOTAL PRIZE Rp4.500.000!\n\ud83d\udc67 Kids: 4\u20139 tahun\n\ud83d\udc6f\u200d\u2642\ufe0f Teens: 10\u201315 tahun\n\ud83d\udcc5 19 September 2026\n\ud83d\udccd Society Atrium, UG Floor\n\nBeginner maupun professional, semua boleh ikut! \u2728\n\nJangan cuma jadi penonton, show us your best moves and compete for the prizes! \ud83c\udfc6\n\n\ud83d\udcf2 REGISTER NOW!\nHubungi Dream Star via WhatsApp:\n0822-6536-0331\n\nSave the date, grab your crew, and let\u2019s dance!\n\n#pakuwonmalljogja",
  },
  {
    id: '60000000-0000-0000-0000-000000000006',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcQWu5WR7YQ/',
    imageUrl: 'https://instagram.frtm1-3.fna.fbcdn.net/v/t51.82787-15/770618056_18551961649074731_4225604655960954707_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk2Nzc3MTI1MTQwOTY2MzUwNA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTYwMS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=qmUuh6kgIEAQ7kNvwFVcufN&_nc_oc=AdqI_uaZFE_Jgwkp90_BkfhgopNzcPZNn2NBKzlPoLMpT11xGkaEVdIAQIEAhYsCBXc&_nc_zt=23&_nc_ht=instagram.frtm1-3.fna&_nc_gid=xn4s_xrIwqiytRHq8VWu_A&_nc_ss=72689&oh=00_AQFMaiv9vWbrAa3Z_fDCSHNuo7WIT4oj18Yulbp4q4efNA&oe=6A8D0063',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T08:40:19.000Z'),
    content: "GET READY TO DANCE! \u2728\ud83d\udc83\nSaatnya seru-seruan bareng di DANCEPHORIA! \ud83c\udfb6\ud83d\udd25 Hadir dengan rangkaian acara yang bikin kamu nggak cuma jadi penonton, tapi ikut merasakan euforia dance yang penuh energi!\n\nCatat tanggalnya : \n\ud83d\udcc5 11\u201320 September 2026\n\ud83d\udccd UG Atrium, Pakuwon Mall Jogja\n\nNikmati berbagai keseruan mulai dari:\n\ud83d\udc83 Dance Meet Up\n\ud83d\udd25 Dance Performance\n\ud83c\udfc6 Dance Competition\n\ud83e\udd1d Dance Collaboration\n\nSee you on the dance floor! \ud83e\udea9\ud83d\udc83\n\n#pakuwonmalljogja #jogjainfo #jogjaevent #jogjaviral #dancejogja",
  },
  {
    id: '60000000-0000-0000-0000-000000000007',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/Dbm3x30EwWu/',
    imageUrl: 'https://instagram.fqro5-1.fna.fbcdn.net/v/t51.82787-15/764373463_18547291300074731_6625151285942470618_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk1NjA5NDM1MTE4NDc5NzcyOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=ajBzTtsxie4Q7kNvwFIYacG&_nc_oc=AdosdNu1l98NreHc52liCd8Gu62QjkNDsaA6H97lRzrt30kbHQeIZkNdcTNanJ5Zaio&_nc_zt=23&_nc_ht=instagram.fqro5-1.fna&_nc_gid=cEmB_geLPQVVGsSijdzjpw&_nc_ss=72a8c&oh=00_AQEI44QYkHb5GWVFQNCYtpCXILEKgfJTnTrNTEe5HUtcXA&oe=6A8CF5B2',
    isExtracted: false,
    publishedAt: new Date('2026-08-04T06:00:53.000Z'),
    content: "GET READY FOR INDONESIA SHOPPING FESTIVAL! \ud83d\udecd\ufe0f\n\nSaatnya belanja lebih hemat dan makin beruntung! \ud83e\udd29 Nikmati promo spesial dari berbagai tenant favorit dengan diskon hingga 80%, sekaligus dapatkan kesempatan memenangkan Grand Prize yang spektakuler!\n\n\ud83d\uddd3\ufe0f 7\u201323 Agustus 2026\n\ud83c\udf9f\ufe0f Tukarkan struk belanja minimal Rp100.000 untuk mendapatkan kupon undian berhadiah.\n\nJangan lewatkan promo-promo terbaik dari tenant favoritmu, belanja sepuasnya, dan siapa tahu kamu jadi pemenang berikutnya! \u2728\n\n#pakuwonmalljogja",
  },
  {
    id: '60000000-0000-0000-0000-000000000008',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcQWAFYES9p/',
    imageUrl: 'https://scontent-ssn1-1.cdninstagram.com/v/t51.82787-15/777382078_18551960650074731_7610862841707220121_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2Nzc2NzgxMjQwNzUwODc2Mw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=UsilD2qHUeIQ7kNvwHJq9lM&_nc_oc=AdrqANIstUJPGho9sxUyTLWVdJOW-mOklREdbete7Bcp54nLhe2EOV4OEvcwhu5SBsUdV5YJEUhUbfsU53RKRkzW&_nc_zt=23&_nc_ht=scontent-ssn1-1.cdninstagram.com&_nc_gid=aQ9-B5ZRnUI4y00eEMBIaQ&_nc_ss=72689&oh=00_AQHZ421s-pfBViiB4dPF30BWjx4YgB-a_uKwiYVUwsKxtg&oe=6A8D0B74',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T08:33:50.000Z'),
    content: "Kemerdekaan dan perayaannya masih berlanjut di Ta Wan\n\nJumat, 21 Agustus 2026, Bubur Ayam Ta Wan bisa kamu nikmati hanya dengan Rp8.100*.\n\nCuma satu hari, jadi jangan sampai kelewatan. Yuk, nikmati semangkuk bubur yang hangat dan nikmat di suasana kemerdekaan\n\n*Hanya berlaku untuk dine-in\n\n*Berlaku di seluruh Ta Wan regular & Little Ta Wan\n\n*Berlaku 1x transaksi per bill\n\n*Tanpa minimum pembelian\n\n*Promo berlaku selama persediaan masih ada\n\n*Harga belum termasuk pajak dan biaya servis\n\n*Promo tidak dapat digabungkan dengan promo lainnya\n\n#Hangatkankebersamaan #momentawan #Merdeka Dalam Kebersamaan #buburtawan #pakuwonmalljogja",
  },
  {
    id: '60000000-0000-0000-0000-000000000009',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DbnutlCzYOL/',
    imageUrl: 'https://instagram.fbio3-2.fna.fbcdn.net/v/t51.82787-15/764693584_18547370830074731_2050476874872495205_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk1NjMzNjIzOTk1OTcwNDQ1OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMzA3Mi5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=KQtO-grDH34Q7kNvwFOLpnc&_nc_oc=AdoN48_l4mL0D7SsG82fuK3s-it0cMWYV0kUJ8n9XuP8q0s0UsxfMpWZjaZvW0WmH78&_nc_zt=23&_nc_ht=instagram.fbio3-2.fna&_nc_gid=RJyvc_yK5ZU8sc_-_klAww&_nc_ss=7ca8c&oh=00_AQH_BkgzinRpEBX9aGRdz64xTDRB6crx4k6O43SY_5TiEQ&oe=6A8CF6C4',
    isExtracted: false,
    publishedAt: new Date('2026-08-04T14:07:36.000Z'),
    content: "Malaysia Healthcare Expo Yogyakarta hadir kembali di Pakuwon Mall Jogja!\ud83c\uddf2\ud83c\uddfe\ud83c\udfe5\n\nCari informasi seputar medical check-up, pengobatan, hingga medical tourism langsung dari rumah sakit ternama di Malaysia!\n\nCatat tanggalnya! \n\ud83d\uddd3 20\u201323 Agustus 2026\n\ud83d\udccd Grand Atrium, Ground Floor\n\nJangan lewatkan kesempatan untuk merencanakan perjalanan kesehatan Anda dengan mudah dan nyaman \ud83e\udd0d\n\n#pakuwonmalljogja",
  },
  {
    id: '60000000-0000-0000-0000-000000000010',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcQStr3EZAs/',
    imageUrl: 'https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/781153363_18551956849074731_5300241335318036746_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2Nzc1MzM1MTcxMzkwMjc1NA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3OS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=7tKbT2_rGdoQ7kNvwHr8UBA&_nc_oc=AdohSHGbMh6ex50zdHzMJWUvUdwvr5v4oAERzQpPYzBkGav4al0EWTF6TJP1qSpBKYE&_nc_zt=23&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_gid=xHbKvtMTBDCAcYQLzb99Pg&_nc_ss=72a8c&oh=00_AQHfmKiXTw2X2orw2DvTGrc5K38yWXKY6hseNx6QBTj8xA&oe=6A8D0A92',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T08:05:06.000Z'),
    content: "Every destination tells a different story.\nWhether it\u2019s a business meeting, a weekend getaway, or your next international adventure, travel with luggage that\u2019s designed to keep up with every journey.\nBecause great journeys begin with great companions.\n\n\ud83e\uddf3: TravelTime BOURBON COLLECTION (available in 20\u201d, 24\u201d, 28\u201d | Black, Coffee, Dark Grey, Red, Rose Gold)\n.\n#TravelTime #TravelTimeLuggage #PremiumLuggage #pakuwonmalljogja",
  },
  {
    id: '60000000-0000-0000-0000-000000000011',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcQS0dJTLhW/',
    imageUrl: 'https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/775243992_18551956981074731_2985253200263854130_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ig_cache_key=Mzk2Nzc1NDA0MTI1NzkzMjg4Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMjgxNS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=dveb7PEPAUAQ7kNvwFcw7NT&_nc_oc=AdrFlTjHrnzDJpuzupoI94CaTeKNr19th7d13eDfyAMVgp5xxtT_VxRfAFNHDs_CwLnDX2gd2fcgo2AbU2ZDgEVn&_nc_zt=23&_nc_ht=scontent-ams2-1.cdninstagram.com&_nc_gid=-SOhWTHbsWRqrTEbDg9lcQ&_nc_ss=72689&oh=00_AQFs8hfD1m3pmVUFfHQIRCh3lfXKsUaFn1wnDQj2ceDUhw&oe=6A8D1B3A',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T08:08:13.000Z'),
    content: "Mau nonton konsernya Dato' Sri Siti Nurhaliza GRATIS? \ud83c\udf9f\ufe0f\u2728\n\nCaranya gampang banget! Cukup melakukan pembelian paket kesehatan minimal RM450 di booth hospitals pilihan kamu selama MHExpo Yogyakarta berlangsung dari 20-23 Agustus 2026, dan kamu berkesempatan buat dapetin tiket konsernya!\n\nYuk, langsung kunjungi MHExpo Yogyakarta 2026 dan jemput tiket keberuntunganmu! \ud83d\udc96\n\n#HealingMeetsHospitality #MYMT2026 #ExperienceMalaysiaHealthcare #MHExpo2026 #pakuwonmalljogja",
  },
  {
    id: '60000000-0000-0000-0000-000000000012',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcQWMpdRG-8/',
    imageUrl: 'https://scontent-icn2-1.cdninstagram.com/v/t51.82787-15/770775461_18551960917074731_9079541194228508223_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2Nzc2ODg5Nzg4NDgxMTE5Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTQ0MS5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=-iRWm1pJYFcQ7kNvwHIm1Tg&_nc_oc=AdoRyJDrDEFNCtab5qnd_W0q9AVAB5ZK_zTbSL8oBv2uoX80fRRE-_bOKF-g2pqSLWw&_nc_zt=23&_nc_ht=scontent-icn2-1.cdninstagram.com&_nc_gid=Hcu4uKpu7pEvhgnvKSfrPg&_nc_ss=72689&oh=00_AQHYRaRY8pOc1MKq_7dDTelAlO3pcK2KDGpbJC06byKMag&oe=6A8CFA0D',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T08:36:39.000Z'),
    content: "\ud83c\udfae LEVEL UP YOUR GAMING EXPERIENCE! \ud83c\udfa7\ud83d\udd25\n\nSaatnya main lebih seru dengan JETE X CEG2 Series Gaming TWS!\n\n\u26a1 45ms Low Latency Mode \u2014 respons audio lebih cepat, minim delay saat gaming\n\ud83c\udfa7 10mm Audio Driver \u2014 suara lebih powerful & immersive\n\ud83c\udf99\ufe0f 2 ENC Mic \u2014 komunikasi lebih jernih saat mabar\n\ud83d\udcf6 Bluetooth 6.0 \u2014 koneksi lebih stabil\n\n\ud83d\udd25 SPECIAL PROMO: DISKON 50%!\n\nJangan sampai kelewatan! Buruan kunjungi JETE Official Store dan upgrade pengalaman gaming-mu sekarang! \ud83c\udfae\n\n#JETE #JETEIndonesia #JETEX #GamingTWS #CEG2Series GamingGear",
  },
  {
    id: '60000000-0000-0000-0000-000000000013',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/Dbe7QFox9_V/',
    imageUrl: 'https://scontent-bos5-1.cdninstagram.com/v/t51.82787-15/762404551_18546413440074731_2761473844030928548_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk1Mzg1ODExMzE4NjU1MzgxMw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=ZpUXGLoqVMEQ7kNvwFK1kj8&_nc_oc=Adrm5YUn3Ug5_LjXFXLYCaYqIUgVYS7GCXJBAzjMIL43sG1_atKnAijmNI9ljwQzfyo&_nc_zt=23&_nc_ht=scontent-bos5-1.cdninstagram.com&_nc_gid=NBJTiCH16Zzu1G2Y_FRzRg&_nc_ss=7ca8c&oh=00_AQG0t6dY0GPi1aL13zcrwESidZQGJ7OF1s3QcL0acg8QSg&oe=6A8CEF00',
    isExtracted: false,
    publishedAt: new Date('2026-08-01T03:58:43.000Z'),
    content: "Agustus makin seru di Pakuwon Mall Jogja \ud83d\ude0d\u2728\n\nCatat tanggalnya dan jangan sampai ketinggalan berbagai event seru sepanjang bulan ini! \n\nYuk, ajak keluarga dan temanmu menikmati berbagai promo, pameran, dan event seru hanya di Pakuwon Mall Jogja \u2764\ufe0f",
  },
  {
    id: '60000000-0000-0000-0000-000000000014',
    accountId: '70000000-0000-0000-0000-000000000003',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcQW117Rd8P/',
    imageUrl: 'https://instagram.fgdl3-1.fna.fbcdn.net/v/t51.71878-15/778928605_1071581545572069_2004853801566420725_n.jpg?stp=dst-jpg_e15_tt6&_nc_cat=107&ig_cache_key=Mzk2Nzc3MTcyODc3MTY2OTc3NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjY0MC5zZHIudmlkZW9fZGVmYXVsdF9jb3Zlcl9mcmFtZS5DMyJ9&_nc_ohc=ZFeIjSH91aYQ7kNvwE1Fhoa&_nc_oc=Ado4o9X1pM7sNpCuv6Abe2PtlFt9Jy3MTsQ5TyA_96vop5Blz3XGGObDq__l0moJqjE&_nc_zt=23&_nc_ht=instagram.fgdl3-1.fna&_nc_gid=ptaCp_ac139q5jKYu9VwHQ&_nc_ss=7ca8c&oh=00_AQFo9Q_SFNvOGWQWVknx8kKgzsKlk9W_kwHvhWAKePg44A&oe=6A8D2105',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T08:45:09.000Z'),
    content: "Malaysia Healthcare Expo is Back! \u2728\ud83c\udfe5\nKembali hadir di Pakuwon Mall Jogja! Jangan lewatkan kesempatan untuk menemukan berbagai informasi dan pilihan layanan kesehatan berkualitas dari Malaysia dalam satu tempat \u2764\ufe0f\n\n\ud83d\udcc5 20\u201323 August 2026\n\ud83d\udccd Grand Atrium, Pakuwon Mall Jogja\n\nSave the date and discover your healthcare options! \u2728\n\n#pakuwonmalljogja #healthexpo #malaysiahealthcare #jogjainfo #jogjaviral",
  },
  {
    id: '60000000-0000-0000-0000-000000000015',
    accountId: '70000000-0000-0000-0000-000000000004',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcAuW69BJCo/',
    imageUrl: 'https://instagram.fyvr2-1.fna.fbcdn.net/v/t51.82787-15/773785762_18361941919244172_6806751327657843244_n.webp?_nc_cat=104&ig_cache_key=Mzk2MzM3MTU1NzM1NDc3MDYwMA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=akbSykFQTfEQ7kNvwFsf2od&_nc_oc=Adq40I1c7u6APEjX4exbRVO6TrklJxJSvUgd1sad0KN5vQRmLsW7Hea_f9ZN6Zmhwc0G4lCA-US1GyMZ_cez9Naw&_nc_zt=23&_nc_ht=instagram.fyvr2-1.fna&_nc_gid=o5c_mj6QNjtnGHvVGFdhjw&_nc_ss=72a8c&oh=00_AQHE5KY_AsiqFyVB0EWeIlWut6T2tHxQj-zyYbRavccg7Q&oe=6A8CBA34',
    isExtracted: false,
    publishedAt: new Date('2026-08-14T06:58:52.000Z'),
    content: "We're Hiring Marketing & Admin Specialist Wanitatama Museum, Hotel & Convention \n\nLowongan dapat ditutup sewaktu-waktu apabila kuota mencukupi\n\nSegera kirim berkas lamaran ke :\n\ud83d\udce9mbwsekregm@gmail.com\n\ud83d\udcf20882 0080 66086\n\n\ud83d\udccdMandala Bhakti Wanitatama\nLaksda Adisucipto No.88 Depok, Sleman, Yogyakarta\n\n#lowongankerja #marketingdigital #adminspecialist #lowonganmarketing #lowonganadmin",
  },
  {
    id: '60000000-0000-0000-0000-000000000016',
    accountId: '70000000-0000-0000-0000-000000000004',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DbKWRHPBR5z/',
    imageUrl: 'https://scontent-fco2-1.cdninstagram.com/v/t51.82787-15/754070238_18358863877244172_2439369266085649785_n.webp?_nc_cat=103&ig_cache_key=Mzk0ODA2NTk1NjM2NjE5NjMzOQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTQ0MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=_HwWbkn5_X8Q7kNvwH-7qPB&_nc_oc=Ado2d26DBUrkBgekF_f1y93oYe4GUilE3ZxpCTte5Z22IznAJicRMsyntGopDOhj7r8&_nc_zt=23&_nc_ht=scontent-fco2-1.cdninstagram.com&_nc_gid=fbjRoYWGPTBphUltnJHNTQ&_nc_ss=72a8c&oh=00_AQGhoyqDsD11AA-K0aHZHJdsoPq4K7roKAqMZS19nZjUCA&oe=6A8CB666',
    isExtracted: false,
    publishedAt: new Date('2026-07-24T04:09:22.000Z'),
    content: "\ud83d\udd0dWANITATAMA MUSEUM, HOTEL & CONVENTION MEMBUKA LOWONGAN KERJA BAGI KAMU YANG MENYUKAI BIDANG PENATAAN TAMAN\n\nKirim Berkas ke :\nmbwsekregm@gmail.com\n\nInformasi  lebih lanjut: \n0882008066086",
  },
  {
    id: '60000000-0000-0000-0000-000000000017',
    accountId: '70000000-0000-0000-0000-000000000004',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DZWYvuOh1OK/',
    imageUrl: 'https://instagram.frec15-1.fna.fbcdn.net/v/t51.71878-15/719451792_1538476960980385_7023933372527785358_n.jpg?stp=dst-jpegr_e15_tt6&_nc_cat=104&ig_cache_key=MzkxNTQyNTc1ODYxMjc3MTcyMjEzMzc5OTcwMzE4NDgwMTY%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNMSVBTLnhwaWRzLjY0MC5oZHIudmlkZW9fbmZyYW1lX2NvdmVyX2ZyYW1lLkMzIn0%3D&_nc_ohc=icZhbpNejOcQ7kNvwGYIown&_nc_oc=AdpbbBliaxaQ2gBK9vd0WF50cJwli0g6dsBSKmxbxveConK-FjtqUBE6krldiurf0BI&_nc_zt=23&se=-1&_nc_ht=instagram.frec15-1.fna&_nc_gid=J8YziAbSHzh2QwbSGcmi8g&_nc_ss=7ca8c&oh=00_AQE09Ju79NfLEjqLoP5aj2KbJ76i716nxkWK5HtuVVjntw&oe=6A8CB739',
    isExtracted: false,
    publishedAt: new Date('2026-06-09T03:30:20.000Z'),
    content: "Booking paket wedding di Wanitatama sudah free meeting room lohhh\u2026. dan kalian juga bisa pesan menu coffee break, buffet, atau alacarte di Cafe Museum \n\nYuk segera Booking dan kepoin semua menu di Cafe Museum, ada banyak pilihan menu yang bisa kamu pilih\u2026 \ud83e\udd50\ud83e\uddcb\u2615\ufe0f @cafemuseums \n\n\ud83d\udccdCafe Museum\nMandala Bhakti Wanitatama\n\nInformasi & Reservasi\nNuri : 0822 3484 8734\nGres : 0888 8065 911\n\n#wanitatamajogja #gedungpernikahanjogja #penginapanmurahjogja #conventions #cafedate",
  },
  {
    id: '60000000-0000-0000-0000-000000000018',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcPdyIOTYfR/',
    imageUrl: 'https://scontent-cdg4-2.cdninstagram.com/v/t51.82787-15/779865192_17897725584582817_955407365744701485_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk2NzUyMDc4NDg4OTI1MTc5Mw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BMmI3ccRnuoQ7kNvwGXW9qP&_nc_oc=AdqyOhEpCN2uOGR_brZ3IVtW6WfmcDpcxA30TdoZsGQN2Z-7cbHiHQjPFoWZ94En1e5CO_V0X1oS9VF844zYhdaz&_nc_zt=23&_nc_ht=scontent-cdg4-2.cdninstagram.com&_nc_gid=d7sfcvM1Kd_ZjIUx4DQs5g&_nc_ss=7c689&oh=00_AQH3g_nNBZ0uHT_kERWh4JQwlG1w4P2nLi_UpqyIOZQnOA&oe=6A8C73C8',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T00:22:47.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD FLORES 2\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Jumat, 30 Oktober 2026\n\ud83c\udfe2 Ganendra Academy\n\ud83d\udcb0 Biaya Rp. 85.000/mapel\n\n\ud83d\udcdd Pendaftaran Menghubungi CP Ganendra Academy 081285191309\n\n\ud83d\udcb3  Pembayaran Transfer ke  Rekening Mandiri Cecep Nurnawadin 1810002831411\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan\nhttps://bit.ly/JuknisPelaksanaanCEO2026\n\ud83d\udcddLatihal Soal \nhttps://bit.ly/LatihanSoalCEO2026\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Ganendra Academy 081285191309\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000019',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcKnS_8K9cx/',
    imageUrl: 'https://instagram.flba3-2.fna.fbcdn.net/v/t51.82787-15/772840583_17897286627582817_8521558223782952786_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2NjE1NTI1MTI3Mjg5ODM1Mw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=PaDxqvOGCbAQ7kNvwHAO1Hx&_nc_oc=Ado03gVHk2WDyvGzbz3o-Vjv66mY5SyBtUNxQvb1953NcZpQc7BNHMOXr9t6m1F9-adwXzBeoJzCIYmQlksTlZqH&_nc_zt=23&_nc_ht=instagram.flba3-2.fna&_nc_gid=CpSKcjOlf20TIbBQNbDgpg&_nc_ss=72689&oh=00_AQEmIxPZJ3VExntNyUzzFo25pC96zuQmRMOKH8AIY5oXwA&oe=6A8C5028',
    isExtracted: false,
    publishedAt: new Date('2026-08-18T03:13:57.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD KARTASURA\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Minggu, 11 Oktober 2026\n\ud83c\udfe2 MI Muhammadiyah PK Surakarta\n\ud83d\udcb0 Biaya Rp. 65.000/mapel\n\n\ud83d\udcdd Pendaftaran silahkan hubungi Ibu Dian 081225435026\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan & latihan soal\ud83d\udc49\ud83c\udffb https://bit.ly/InformasiPelaksanaanCEO\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Ibu Dian\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000020',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcPdwM-zTvD/',
    imageUrl: 'https://instagram.ftrn5-1.fna.fbcdn.net/v/t51.82787-15/781425573_17897725557582817_3336893377502989807_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=105&ig_cache_key=Mzk2NzUyMDY1MjU1ODk0MTEyMw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=VgUHylbbTJQQ7kNvwHw76q1&_nc_oc=Adq0SqXQa0d7qcFw_6ftTi0t-4UEiItnpoVRlralsg3N67uVKfb4TKNI9TYCONtOHBw&_nc_zt=23&_nc_ht=instagram.ftrn5-1.fna&_nc_gid=GOuCboY9WRnsS7__qkfFBA&_nc_ss=72a8c&oh=00_AQEVDW4Z0PVK4YUtkaAFNzDmd3ZelRuUKVLvSOyE7V1goQ&oe=6A8C7721',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T00:22:29.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD FLORES 1\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Minggu, 25 Oktober 2026\n\ud83c\udfe2 Madrasah Aliyah Negeri Ende\n\ud83d\udcb0 Biaya Rp. 85.000/mapel\n\n\ud83d\udcdd Pendaftaran Menghubungi CP Ganendra Academy 081285191309\n\n\ud83d\udcb3  Pembayaran Transfer ke  Rekening Mandiri Cecep Nurnawadin 1810002831411\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan\nhttps://bit.ly/JuknisPelaksanaanCEO2026\n\ud83d\udcddLatihal Soal \nhttps://bit.ly/LatihanSoalCEO2026\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Ganendra Academy 081285191309\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000021',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcPd1CLTEsG/',
    imageUrl: 'https://instagram.fmel17-1.fna.fbcdn.net/v/t51.82787-15/778048505_17897725650582817_2904088858585475745_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2NzUyMDk4NDU1NDgxODMxMA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=3H37HQKTtJAQ7kNvwEbE27d&_nc_oc=AdofOw6B5Od6GaZXOkpqljb8s7CtaJSdYn_iEGjd94FcAZKhAwcW3B88OmolLSln6PagFsMFT9hfKRYjYa91-474&_nc_zt=23&_nc_ht=instagram.fmel17-1.fna&_nc_gid=Xmo7fNecIE06ALrOns9xgA&_nc_ss=72689&oh=00_AQECDpVKVRVFCpQ0Dnr0hmPgfYHULCZiEuwrMwDR0gzHew&oe=6A8C6392',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T00:23:06.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD KUPANG\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Sabtu, 10 Oktober 2026\n\ud83c\udfe2 Trinity Elpida International School\n\ud83d\udcb0 Biaya Rp. 100.000/mapel\n\n\ud83d\udcdd Pendaftaran Menghubungi Miss Haje 0823-4232-7690\n\n\ud83d\udcb3  Pembayaran Transfer ke  Rekening Mandiri Cecep Nurnawadin 1810002831411\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan\nhttps://bit.ly/JuknisPelaksanaanCEO2026\n\ud83d\udcddLatihal Soal \nhttps://bit.ly/LatihanSoalCEO2026\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Miss Haje 0823-4232-7690\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000022',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcP7qRYqm7s/',
    imageUrl: 'https://scontent-hou1-1.cdninstagram.com/v/t51.82787-15/778426287_17897753193582817_1989184697030912783_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk2NzY1MjE4NjM2NjMwODA3Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=kTv5fdvBtqsQ7kNvwGhgP0G&_nc_oc=Adrg-_ex8PWPuFhOXlnaFt8inW7VlhX-B1S-4flpp9Q1uTZ_FysZf9ex6Pac316FYB7XnGPmvHKQn28VXZ2o0EWU&_nc_zt=23&_nc_ht=scontent-hou1-1.cdninstagram.com&_nc_gid=N9v8gfsNoxE6gnGP3T1Q6w&_nc_ss=72a8c&oh=00_AQHtOELWg_cPRnehtAZuei0AZ-EwqBXEqLNdvxp6vogAJg&oe=6A8C6C31',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T04:44:51.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD PAMEKASAN\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Minggu, 11 Oktober 2026\n\ud83c\udfe2 SD ALQURAN UMMUL QURO\n\ud83d\udcb0 Biaya Rp. 65.000/mapel\n\n\ud83d\udcdd Pendaftaran menghubungi CP Kakak Yasmin 0859-4775-3301\n\n\ud83d\udcb3  Pembayaran Transfer ke  Rekening BCA 1921296130 A.N ISLAMIA YASIN\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan & latihan soal\ud83d\udc49\ud83c\udffb https://bit.ly/InformasiPelaksanaanCEO\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Kaka Yasmin 0859-4775-3301\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000023',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcKoCLxK_-P/',
    imageUrl: 'https://scontent-mad1-1.cdninstagram.com/v/t51.82787-15/778586880_17897287062582817_2858124859962748700_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=100&ig_cache_key=Mzk2NjE1ODQ5Mzc4ODY2Nzc5MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=LGznlJfcJY8Q7kNvwE44eSS&_nc_oc=AdrY1qe8NXFxgOGgPTToL7WMDUCD3iNymmKO5nS2jqWBHHbo8XCxpYXFcFOEZ9_snU4&_nc_zt=23&_nc_ht=scontent-mad1-1.cdninstagram.com&_nc_gid=h_yw2usSfXUpVXrdSj5S5w&_nc_ss=7ca8c&oh=00_AQFugmO251yJ0DljZbWXx2uMJ6TSsCPqgMrYSs9oOmdCcA&oe=6A8C5E3B',
    isExtracted: false,
    publishedAt: new Date('2026-08-18T03:16:56.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD PURWAKARTA\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Minggu, 20 September 2026\n\ud83c\udfe2 SDS PLUS 2 AL MUHAJIRIN PURWAKARTA\n\ud83d\udcb0 Biaya Rp. 65.000/mapel\n\n\ud83d\udcdd Pendaftaran dengan klik \ud83d\udc49https://bit.ly/PenyisihanCEOPurwakarta\n\n\ud83d\udcb3  Pembayaran Transfer ke  SEABANK 901408639421 An DADANG SUPRIYADI\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan & latihan soal\ud83d\udc49\ud83c\udffb https://bit.ly/InformasiPelaksanaanCEO\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Ms Aulia 0898-0621-999\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000024',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcKnrwLKIBZ/',
    imageUrl: 'https://instagram.fein1-1.fna.fbcdn.net/v/t51.82787-15/778140192_17897286600582817_7542742779781640678_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=106&ig_cache_key=Mzk2NjE1Njk1MjMzMTM4Njk2OQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=3fYWO67bVIEQ7kNvwFhiM4c&_nc_oc=AdrPNMGWSZLDNqYeBVXhgzctENS1JLsMKggMlYhfrI39C3GQfgZNJGV6FYXgSRqNkYc&_nc_zt=23&_nc_ht=instagram.fein1-1.fna&_nc_gid=Jsr1kNbzNgX-EMIw-YiTMw&_nc_ss=72a8c&oh=00_AQF1pjFiw7kHo68n2-rrd7T5MlNYAf5ooDIrMk2KdNN4Zg&oe=6A8C7641',
    isExtracted: false,
    publishedAt: new Date('2026-08-18T03:13:51.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD KLATEN\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Minggu, 1 November 2026\n\ud83c\udfe2 SD KRISTA GRACIA\n\ud83d\udcb0 Biaya Rp. 65.000/mapel\n\n\ud83d\udcdd Pendaftaran silahkan hubungi Ibu Susana 08122520620\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan & latihan soal\ud83d\udc49\ud83c\udffb https://bit.ly/InformasiPelaksanaanCEO\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Ibu Susana 08122520620\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000025',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcP8HJCK4Z0/',
    imageUrl: 'https://instagram.fbcn13-1.fna.fbcdn.net/v/t51.82787-15/775243708_17897753616582817_6848438345072586266_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=110&ig_cache_key=Mzk2NzY1NDE3MDI2Mzc4MzAyOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=TM-6ktbJaGgQ7kNvwGXt-DB&_nc_oc=AdpUlf613oKUyKFY_NsexKSTgZQhCTVGGz1gt7qdIz8_NKRb3GleVsdefApb1RvRZBs&_nc_zt=23&_nc_ht=instagram.fbcn13-1.fna&_nc_gid=sTi2eiqQXOWreF78dPHklA&_nc_ss=72a8c&oh=00_AQHuStFOuCcDp27Hafe7qTFjvvMtLtdykbnnkCmzLvhn8A&oe=6A8C672D',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T04:47:47.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD SUMENEP\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Minggu, 18 Oktober 2026\n\ud83c\udfe2 SDK SANG TIMUR SUMENEP\n\ud83d\udcb0 Biaya Rp. 65.000/mapel\n\n\ud83d\udcdd Pendaftaran menghubungi CP Bunda Mia 0853-3593-6786\n\n\ud83d\udcb3  Pembayaran Transfer ke  Rekening BCA 1921296130 A.N ISLAMIA YASIN\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan & latihan soal\ud83d\udc49\ud83c\udffb https://bit.ly/InformasiPelaksanaanCEO\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Bunda Mia 0853-3593-6786\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000026',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcP7NLIKVvD/',
    imageUrl: 'https://scontent-cdg4-3.cdninstagram.com/v/t51.82787-15/777185989_17897752692582817_7017193243040720684_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ig_cache_key=Mzk2NzY1MDE4Njc4MjEzNzI4Mw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=Ship2VxAnOcQ7kNvwFBPndg&_nc_oc=Adp5lJZaXQHZU6IKr4b1UIlXE8Y9a_LPsyMO_p-X55kgFZnE696O8tCNiLisHonueRA&_nc_zt=23&_nc_ht=scontent-cdg4-3.cdninstagram.com&_nc_gid=tTxD2lZ6GEMC7keImAEwOQ&_nc_ss=7ca8c&oh=00_AQHcS376n3iiEt3Siq84H3S7MUbTSY340SQZjT5HRhFD5Q&oe=6A8C6616',
    isExtracted: false,
    publishedAt: new Date('2026-08-20T04:39:55.000Z'),
    content: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD MAKASSAR\n\n\ud83c\udfc6 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n\ud83d\udcccCEO Telah Terdaftar di Puspresnas\n\n\ud83c\udf81 Hadiah Utama CEO\u203c\ufe0f \nGADGET \ud83d\udcbb \ud83d\udcf1Serta uang tunai total puluhan jutaan rupiah\ud83d\udcb8\n\nKategori sesuai Level Tahun ajaran 2026/2027\n\ud83d\udccd Level TK (TK A- TK B)\n\ud83d\udccd Level 1 (1-2 SD)\n\ud83d\udccd Level 2 (3-4 SD)\n\ud83d\udccd Level 3 (5-6 SD)\n\ud83d\udccd Level 4 (7-8-9 SMP)\n\n\ud83d\uddd3 Minggu, 18 Oktober 2026\n\ud83c\udfe2 STELLAH GRACIA SCHOOL MAKASSAR\n\ud83d\udcb0 Biaya Rp. 85.000/mapel\n\n\ud83d\udcdd Pendaftaran Menghubungi CP Pak Sudirman 0822-9183-3539\n\n\ud83d\udcb3  Pembayaran Transfer ke  Rekening BCA 7325607785 A.N SUDIRMAN SSI,\n \n\ud83d\uddd3 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n\ud83d\udcdd Juknis pelaksanaan\nhttps://bit.ly/JuknisCEOMakassar\n\ud83d\udcddLatihal Soal \nhttps://bit.ly/LatihanSoalCEO2026\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel\u203c\ufe0f\n\nCP Pak Sudirman 0822-9183-3539\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
  {
    id: '60000000-0000-0000-0000-000000000027',
    accountId: '70000000-0000-0000-0000-000000000005',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/DcIUxkzRh02/',
    imageUrl: 'https://instagram.fcpq7-1.fna.fbcdn.net/v/t51.82787-15/775523772_18025453436852363_6401878951314487960_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2NTUxMDgzOTU5OTI0MjU1MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTM1MC5zZHIucmVndWxhcl9waG90by5DMyJ9&_nc_ohc=BD7IWCs_-uoQ7kNvwHAm0yM&_nc_oc=AdqRU_0Z5GM5UyTKx2kAevkxqbIBif6EFwiFklXLVjYDqg9vqkRV_dkff_d5EzarQ0M&_nc_zt=23&_nc_ht=instagram.fcpq7-1.fna&_nc_gid=1MHjFu3BNmCualvdhqUXOA&_nc_ss=72a8c&oh=00_AQG9sx6S-AZB78YUXPMtyRwo27z5toGlNaA5BTt3dSKWbg&oe=6A8C62C4',
    isExtracted: false,
    publishedAt: new Date('2026-08-17T05:49:15.000Z'),
    content: "*KOMPETISI NASIONAL*\n*(KOMNAS)* \n\n\ud83d\udccdRayon BANDUNG\n \n*\u2014\u2014\u2014 O F F L I N E \u2014\u2014\u2014*\n\n*Untuk*\n- SD/MI  Kelas 1 -  6\n- SMP/MTs 7 - 9\n\n\ud83d\uddd3\ufe0fHari/Tanggal: \n*Sabtu, 26 September 2026*\n\ud83c\udfec Lokasi : SMK Negeri 3 Bandung\n\ud83d\udcb0 Biaya 60.000/mapel\n\n\ud83c\udfe6 *Pembayaran* Transfer ke Seabank 901408639421 A.N Dadang Supriadi\n\n\ud83d\uddd3\ufe0f *Pendaftaran max H-3 atau jika kuota sudah terpenuhi*\n\n\ud83d\udd8a\ufe0f *Pendaftaran dengan klik*\nhttps://bit.ly/PenyisihanKOMNASBandung2026\n\n\u2b06\ufe0f *Juknis*\nhttps://bit.ly/JuknisKomnas26\n\n\ud83d\uddd2\ufe0f*Contoh Soal KOMNAS* \nhttps://bit.ly/ContohsoalpenyisihanKomnas26\n\n*CP Pak Dadang 0898-8345-885*\n\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6\ud83e\udd47\ud83e\udd48\ud83e\udd49\ud83c\udfc6",
  },
];

const FIXTURE_SCRAPER_ACTOR_RUNS = [
  {
    id: '90000000-0000-0000-0000-000000000001',
    vendor: 'APIFY' as const,
    triggerMode: 'SYNC' as const,
    profileId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].id,
    runId: 'E2E-ACTOR-RUN-001',
    status: 'SUCCEEDED' as const,
    rawInput: {
      username: ['jktcity.events'],
      resultsType: 'posts',
      resultsLimit: 1,
    },
    rawOutput: [
      {
        url: FIXTURE_POSTS[0].postUrl,
        caption: FIXTURE_POSTS[0].content,
        timestamp: FIXTURE_POSTS[0].publishedAt.toISOString(),
        imageUrl: FIXTURE_POSTS[0].imageUrl,
      },
    ],
    itemCount: 1,
    startedAt: new Date('2026-08-20T10:00:00Z'),
    completedAt: new Date('2026-08-20T10:00:01Z'),
  },
  {
    id: '90000000-0000-0000-0000-000000000002',
    vendor: 'APIFY' as const,
    triggerMode: 'SYNC' as const,
    profileId: '70000000-0000-0000-0000-000000000003',
    runId: 'E2E-ACTOR-RUN-002',
    status: 'SUCCEEDED' as const,
    rawInput: {
      username: ['pakuwonmall.jogja'],
      resultsType: 'posts',
      resultsLimit: 10,
    },
    rawOutput: [
      {
        id: "3967774232893587069",
        caption: "READY TO DANCE & COMPETE?\n\nSaatnya tunjukkan skill terbaikmu di PAKUWON DANCE COMPETITION!\n\n🏆 TOTAL PRIZE Rp4.500.000!\n👧 Kids: 4–9 tahun\n👯‍♂️ Teens: 10–15 tahun\n📅 19 September 2026\n📍 Society Atrium, UG Floor\n\nBeginner maupun professional, semua boleh ikut! ✨\n\nJangan cuma jadi penonton, show us your best moves and compete for the prizes! 🏆\n\n📲 REGISTER NOW!\nHubungi Dream Star via WhatsApp:\n0822-6536-0331\n\nSave the date, grab your crew, and let’s dance!\n\n#pakuwonmalljogja",
        url: "https://www.instagram.com/p/DcQXaSEkf59/",
        timestamp: "2026-08-14T19:41:47.000Z",
      }
    ],
    itemCount: 1,
    startedAt: new Date('2026-08-14T19:41:00Z'),
    completedAt: new Date('2026-08-14T19:41:47Z'),
  },
  {
    id: '90000000-0000-0000-0000-000000000003',
    vendor: 'APIFY' as const,
    triggerMode: 'SYNC' as const,
    profileId: '70000000-0000-0000-0000-000000000004',
    runId: 'E2E-ACTOR-RUN-003',
    status: 'SUCCEEDED' as const,
    rawInput: {
      username: ['wanitatamajogja'],
      resultsType: 'posts',
      resultsLimit: 10,
    },
    rawOutput: [
      {
        id: "3963371557354770600",
        caption: "We're Hiring Marketing & Admin Specialist Wanitatama Museum, Hotel & Convention \n\nLowongan dapat ditutup sewaktu-waktu apabila kuota mencukupi\n\nSegera kirim berkas lamaran ke :\n📩mbwsekregm@gmail.com\n📲0882 0080 66086\n\n📍Mandala Bhakti Wanitatama\nLaksda Adisucipto No.88 Depok, Sleman, Yogyakarta\n\n#lowongankerja #marketingdigital #adminspecialist #lowonganmarketing #lowonganadmin",
        url: "https://www.instagram.com/p/DcAuW69BJCo/",
        timestamp: "2026-08-14T06:58:52.000Z",
      }
    ],
    itemCount: 1,
    startedAt: new Date('2026-08-14T06:58:00Z'),
    completedAt: new Date('2026-08-14T06:58:52Z'),
  },
  {
    id: '90000000-0000-0000-0000-000000000004',
    vendor: 'APIFY' as const,
    triggerMode: 'SYNC' as const,
    profileId: '70000000-0000-0000-0000-000000000005',
    runId: 'E2E-ACTOR-RUN-004',
    status: 'SUCCEEDED' as const,
    rawInput: {
      username: ['chaanakyaekadanta_academy'],
      resultsType: 'posts',
      resultsLimit: 10,
    },
    rawOutput: [
      {
        id: "3967520784889251793",
        caption: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD FLORES 2\n\n🏆 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n📌CEO Telah Terdaftar di Puspresnas\n\n🎁 Hadiah Utama CEO‼️ \nGADGET 💻 📱Serta uang tunai total puluhan jutaan rupiah💸\n\nKategori sesuai Level Tahun ajaran 2026/2027\n📍 Level TK (TK A- TK B)\n📍 Level 1 (1-2 SD)\n📍 Level 2 (3-4 SD)\n📍 Level 3 (5-6 SD)\n📍 Level 4 (7-8-9 SMP)\n\n🗓 Jumat, 30 Oktober 2026\n🏢 Ganendra Academy\n💰 Biaya Rp. 85.000/mapel\n\n📝 Pendaftaran Menghubungi CP Ganendra Academy 081285191309\n\n💳  Pembayaran Transfer ke  Rekening Mandiri Cecep Nurnawadin 1810002831411\n \n🗓 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n📝 Juknis pelaksanaan\nhttps://bit.ly/JuknisPelaksanaanCEO2026\n📝Latihal Soal \nhttps://bit.ly/LatihanSoalCEO2026\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel‼️\n\nCP Ganendra Academy 081285191309\n🏆🥇🥈🥉🏆🥇🥈🥉🏆",
        url: "https://www.instagram.com/p/DcPdyIOTYfR/",
        timestamp: "2026-08-20T00:22:47.000Z",
      }
    ],
    itemCount: 1,
    startedAt: new Date('2026-08-20T00:22:00Z'),
    completedAt: new Date('2026-08-20T00:22:47Z'),
  },
];

export const FIXTURE_PARSER_VERSIONS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    version: 'v1.0.0',
    description: 'Initial stable parser version',
    sourceFile: 'gemini-extractor.ts',
    source: 'GEMINI' as const,
    isActive: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    version: '3.4g',
    description: 'Bright Data record-to-post field mapping',
    sourceFile: 'brightdata-record-mapper.ts',
    source: 'BRIGHTDATA' as const,
    isActive: true,
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    version: '3.4m',
    description: 'Apify actor-selection field mapping',
    sourceFile: 'instagram-adapter.ts',
    source: 'APIFY' as const,
    isActive: true,
  },
];

export const FIXTURE_UNPROCESSED_PAYLOADS = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    rawPayload: {
      id: '3963529569051570616',
      shortCode: 'DcQXaSEkf59',
      caption: 'READY TO DANCE & COMPETE?\n\nSaatnya tunjukkan skill terbaikmu di PAKUWON DANCE COMPETITION!\n\n🏆 TOTAL PRIZE Rp4.500.000!\n👧 Kids: 4–9 tahun\n👯‍♂️ Teens: 10–15 tahun\n📅 19 September 2026\n📍 Society Atrium, UG Floor\n\nBeginner maupun professional, semua boleh ikut! ✨\n\nJangan cuma jadi penonton, show us your best moves and compete for the prizes! 🏆\n\n📲 REGISTER NOW!\nHubungi Dream Star via WhatsApp:\n0822-6536-0331\n\nSave the date, grab your crew, and let’s dance!\n\n#pakuwonmalljogja',
      url: 'https://www.instagram.com/p/DcQXaSEkf59/',
      timestamp: '2026-08-14T19:41:47.000Z',
      ownerUsername: 'pakuwonmall.jogja',
    },
    validationError: [
      { keyword: 'required', instancePath: '/location', message: "must have required property 'location'" }
    ],
    context: {
      source: 'apify',
      scraperVendor: 'apify',
      accountId: '70000000-0000-0000-0000-000000000003',
      postUrl: 'https://www.instagram.com/p/DcQXaSEkf59/',
      timestamp: '2026-08-14T19:41:47.000Z',
      parserVersion: 'v1.0.0',
    },
    scraperActorRunId: '90000000-0000-0000-0000-000000000002',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    rawPayload: {
      id: '3963371557354770600',
      shortCode: 'DcAuW69BJCo',
      caption: "We're Hiring Marketing & Admin Specialist Wanitatama Museum, Hotel & Convention \n\nLowongan dapat ditutup sewaktu-waktu apabila kuota mencukupi\n\nSegera kirim berkas lamaran ke :\n📩mbwsekregm@gmail.com\n📲0882 0080 66086\n\n📍Mandala Bhakti Wanitatama\nLaksda Adisucipto No.88 Depok, Sleman, Yogyakarta\n\n#lowongankerja #marketingdigital #adminspecialist #lowonganmarketing #lowonganadmin",
      url: 'https://www.instagram.com/p/DcAuW69BJCo/',
      timestamp: '2026-08-14T06:58:52.000Z',
      ownerUsername: 'wanitatamajogja',
    },
    validationError: [
      { keyword: 'required', instancePath: '/location', message: "must have required property 'location'" }
    ],
    context: {
      source: 'apify',
      scraperVendor: 'apify',
      accountId: '70000000-0000-0000-0000-000000000004',
      postUrl: 'https://www.instagram.com/p/DcAuW69BJCo/',
      timestamp: '2026-08-14T06:58:52.000Z',
      parserVersion: 'v1.0.0',
    },
    scraperActorRunId: '90000000-0000-0000-0000-000000000003',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    rawPayload: {
      id: '3967520784889251793',
      shortCode: 'DcPdyIOTYfR',
      caption: "BABAK PENYISIHAN CHAANAKYA EKADANTA OLYMPIAD FLORES 2\n\n🏆 Tingkat Nasional 2026-2027\n\nMata pelajaran :  MATEMATIKA, SAINS, BAHASA INGGRIS\n\n📌CEO Telah Terdaftar di Puspresnas\n\n🎁 Hadiah Utama CEO‼️ \nGADGET 💻 📱Serta uang tunai total puluhan jutaan rupiah💸\n\nKategori sesuai Level Tahun ajaran 2026/2027\n📍 Level TK (TK A- TK B)\n📍 Level 1 (1-2 SD)\n📍 Level 2 (3-4 SD)\n📍 Level 3 (5-6 SD)\n📍 Level 4 (7-8-9 SMP)\n\n🗓 Jumat, 30 Oktober 2026\n🏢 Ganendra Academy\n💰 Biaya Rp. 85.000/mapel\n\n📝 Pendaftaran Menghubungi CP Ganendra Academy 081285191309\n\n💳  Pembayaran Transfer ke  Rekening Mandiri Cecep Nurnawadin 1810002831411\n \n🗓 Pendaftaran sampai H-3 atau jika kuota terpenuhi!\n\n📝 Juknis pelaksanaan\nhttps://bit.ly/JuknisPelaksanaanCEO2026\n📝Latihal Soal \nhttps://bit.ly/LatihanSoalCEO2026\n\nRaih hadiah utama dengan mengikuti minimal 2 mapel‼️\n\nCP Ganendra Academy 081285191309\n🏆🥇🥈🥉🏆🥇🥈🥉🏆",
      url: 'https://www.instagram.com/p/DcPdyIOTYfR/',
      timestamp: '2026-08-20T00:22:47.000Z',
      ownerUsername: 'chaanakyaekadanta_academy',
    },
    validationError: [
      { keyword: 'required', instancePath: '/location', message: "must have required property 'location'" }
    ],
    context: {
      source: 'apify',
      scraperVendor: 'apify',
      accountId: '70000000-0000-0000-0000-000000000005',
      postUrl: 'https://www.instagram.com/p/DcPdyIOTYfR/',
      timestamp: '2026-08-20T00:22:47.000Z',
      parserVersion: 'v1.0.0',
    },
    scraperActorRunId: '90000000-0000-0000-0000-000000000004',
  },
];

const FIXTURE_EVENTS = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    slug: 'past-jazz-night-2025-fixed',
    eventName: 'Past Jazz Night 2025',
    types: ['PERFORMANCE'],
    categories: ['MUSIC'],
    location: 'South Jakarta Art Hall',
    organizerName: 'Nusantara Sound Collective',
    contactInfo: 'https://instagram.com/jktcity.events/p/C1PASTJAZZ',
    confidenceScore: 0.96,
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].accountId,
    postId: FIXTURE_POSTS[0].id,
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    slug: 'ongoing-culture-fest-2026-2027-fixed',
    eventName: 'Ongoing Culture Fest 2026-2027',
    types: ['FESTIVAL', 'GATHERING'],
    categories: ['ARTS_AND_CULTURE', 'FAMILY_AND_KIDS'],
    location: 'Merdeka Square, Jakarta',
    organizerName: 'City Culture Office',
    contactInfo: 'https://instagram.com/jktcity.events/p/C2ONGOING',
    confidenceScore: 0.91,
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].accountId,
    postId: FIXTURE_POSTS[1].id,
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    slug: 'upcoming-family-workshop-2027-fixed',
    eventName: 'Upcoming Family Workshop 2027',
    types: ['WORKSHOP'],
    categories: ['FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS'],
    location: 'Bandung Community Hub',
    organizerName: 'Bandung Family Weekend',
    contactInfo: 'https://instagram.com/bdg.family.weekend/p/C3UPCOMING',
    confidenceScore: 0.93,
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[1].accountId,
    postId: FIXTURE_POSTS[2].id,
  },
  {
    id: '40000000-0000-0000-0000-000000000004',
    slug: 'cancellation-threshold-test-fixed',
    eventName: 'Cancellation Threshold Test Event',
    types: ['PERFORMANCE'],
    categories: ['MUSIC'],
    location: 'Cancellation Arena',
    organizerName: 'Nusantara Sound Collective',
    contactInfo: 'https://instagram.com/jktcity.events/p/C4CANCELLATION',
    confidenceScore: 0.99,
    sourceSocialMediaAccountId: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES[0].accountId,
    postId: '60000000-0000-0000-0000-000000000004',
  },
];

const FIXTURE_SCHEDULES = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    slug: 'past-jazz-night-2025-main-fixed',
    eventId: FIXTURE_EVENTS[0].id,
    isMainSchedule: true,
    eventStartDate: '2025-02-20',
    eventEndDate: '2025-02-20',
    eventStartTime: '19:30:00',
    eventEndTime: '22:00:00',
    title: 'Main Jazz Session',
    performers: ['Nusa Trio', 'Kota Brass'],
    location: 'South Jakarta Art Hall - Stage A',
    ticketPrice: 'IDR 150000',
    locationDetails: { coordinates: { latitude: -6.2615, longitude: 106.8106 } },
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    slug: 'ongoing-culture-fest-opening-fixed',
    eventId: FIXTURE_EVENTS[1].id,
    isMainSchedule: true,
    eventStartDate: '2026-01-10',
    eventEndDate: '2027-12-31',
    eventStartTime: '09:00:00',
    eventEndTime: '21:00:00',
    title: 'Daily Main Program',
    performers: ['Rotating Local Communities'],
    location: 'Merdeka Square - Main Area',
    ticketPrice: 'Free',
    locationDetails: { coordinates: { latitude: -6.1701, longitude: 106.8283 } },
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    slug: 'upcoming-family-workshop-main-fixed',
    eventId: FIXTURE_EVENTS[2].id,
    isMainSchedule: true,
    eventStartDate: '2027-11-15',
    eventEndDate: '2027-11-15',
    eventStartTime: '10:00:00',
    eventEndTime: '12:00:00',
    title: 'Creative Family Workshop',
    performers: ['Creative Kids Lab'],
    location: 'Bandung Community Hub - Room 2',
    ticketPrice: 'IDR 50000',
    locationDetails: { coordinates: { latitude: -6.9147, longitude: 107.6098 } },
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    slug: 'upcoming-family-workshop-bonus-fixed',
    eventId: FIXTURE_EVENTS[2].id,
    isMainSchedule: false,
    eventStartDate: '2027-11-16',
    eventEndDate: '2027-11-16',
    eventStartTime: '14:00:00',
    eventEndTime: '16:00:00',
    title: 'Parents Networking Session',
    performers: ['Community Facilitator Team'],
    location: 'Bandung Community Hub - Garden Deck',
    ticketPrice: 'Free with registration',
    locationDetails: { coordinates: { latitude: -6.9153, longitude: 107.6109 } },
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    slug: 'cancellation-threshold-test-main-fixed',
    eventId: '40000000-0000-0000-0000-000000000004',
    isMainSchedule: true,
    eventStartDate: '2027-11-20',
    eventEndDate: '2027-11-20',
    eventStartTime: '18:00:00',
    eventEndTime: '20:00:00',
    title: 'Cancellation Main Session',
    performers: ['Cancellation Performers'],
    location: 'Cancellation Arena - Main Area',
    ticketPrice: 'Free',
    locationDetails: { coordinates: { latitude: -6.1701, longitude: 106.8283 } },
  },
];

const FIXTURE_REPORTS = [
  {
    id: '80000000-0000-0000-0000-000000000001',
    eventId: '40000000-0000-0000-0000-000000000004',
    reporterUserId: FIXTURE_USERS[0].id,
    reason: 'cancelled' as const,
    details: 'Widely reported as cancelled',
    status: 'pending' as const,
  },
  {
    id: '80000000-0000-0000-0000-000000000002',
    eventId: '40000000-0000-0000-0000-000000000004',
    reporterUserId: FIXTURE_USERS[1].id,
    reason: 'cancelled' as const,
    details: 'Cancelled by organizer',
    status: 'pending' as const,
  },
];

export const FIXTURE_COUNTS = {
  users: FIXTURE_USERS.length,
  userLocations: FIXTURE_USER_LOCATIONS.length,
  socialMediaAccountProfiles: FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES.length,
  subscriptions: FIXTURE_SUBSCRIPTIONS.length,
  apiKeys: FIXTURE_API_KEYS.length,
  posts: FIXTURE_POSTS.length,
  scraperActorRuns: FIXTURE_SCRAPER_ACTOR_RUNS.length,
  events: FIXTURE_EVENTS.length,
  schedules: FIXTURE_SCHEDULES.length,
  reports: FIXTURE_REPORTS.length,
} as const;

export const FIXTURE_USER_IDS = FIXTURE_USERS.map((user) => user.id).sort();
export const FIXTURE_USER_LOCATION_IDS = FIXTURE_USER_LOCATIONS.map((location) => location.id).sort();
export const FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILE_IDS = FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES.map((profile) => profile.id).sort();
export const FIXTURE_SUBSCRIPTION_IDS = FIXTURE_SUBSCRIPTIONS.map((subscription) => subscription.id).sort();
export const FIXTURE_API_KEY_IDS = FIXTURE_API_KEYS.map((apiKey) => apiKey.id).sort();
export const FIXTURE_POST_IDS = FIXTURE_POSTS.map((post) => post.id).sort();
export const FIXTURE_EVENT_IDS = FIXTURE_EVENTS.map((event) => event.id).sort();
export const FIXTURE_SCHEDULE_IDS = FIXTURE_SCHEDULES.map((schedule) => schedule.id).sort();
export const FIXTURE_EVENT_SLUGS = FIXTURE_EVENTS.map((event) => event.slug).sort();
export const FIXTURE_SCHEDULE_SLUGS = FIXTURE_SCHEDULES.map((schedule) => schedule.slug).sort();
export const FIXTURE_REPORT_IDS = FIXTURE_REPORTS.map((report) => report.id).sort();

export function isLocalConnectionString(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    // Fail closed if URL parsing fails.
    return false;
  }
}

function assertSafeSeedTarget(connectionString: string): void {
  if (process.env.ALLOW_DESTRUCTIVE_SEED === 'true' || isLocalConnectionString(connectionString)) {
    return;
  }

  throw new Error(
    'Refusing to run destructive seed against a non-local database. Set ALLOW_DESTRUCTIVE_SEED=true to override intentionally.',
  );
}

export function createSqlClient(connectionString: string) {
  const isLocal = isLocalConnectionString(connectionString);

  return postgres(connectionString, {
    max: 1,
    ssl: isLocal ? false : 'require',
  });
}

type SqlClient = ReturnType<typeof postgres>;

async function migrateEnumTypes(sqlClient: SqlClient): Promise<void> {
  console.log('Starting enum type migrations...');
  try {
    // Check if the enum values are already in the correct case
    const result = await sqlClient`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'scraper_run_vendor')
      LIMIT 1
    `;

    if (result && result.length > 0 && result[0].enumlabel === 'APIFY') {
      // Already migrated
      console.log('✓ Scraper actor run enums already in uppercase, skipping migration');
      return;
    }
    console.log('Scraper actor run enums need migration');

    // Drop constraints and old enum types
    await sqlClient`ALTER TABLE scraper_actor_runs DROP CONSTRAINT IF EXISTS scraper_actor_runs_vendor_run_id_key`;
    await sqlClient`DROP INDEX IF EXISTS idx_scraper_actor_runs_vendor_status`;

    // Change column types to text temporarily and convert to uppercase
    await sqlClient`ALTER TABLE scraper_actor_runs ALTER COLUMN vendor DROP DEFAULT`;
    await sqlClient`ALTER TABLE scraper_actor_runs ALTER COLUMN vendor TYPE text USING UPPER(vendor::text)`;
    await sqlClient`ALTER TABLE scraper_actor_runs ALTER COLUMN trigger_mode TYPE text USING UPPER(trigger_mode::text)`;

    // Drop old enums
    await sqlClient`DROP TYPE IF EXISTS scraper_run_vendor CASCADE`;
    await sqlClient`DROP TYPE IF EXISTS scraper_run_trigger_mode CASCADE`;

    // Create new enums with uppercase values
    await sqlClient`CREATE TYPE scraper_run_vendor AS ENUM ('APIFY', 'BRIGHTDATA')`;
    await sqlClient`CREATE TYPE scraper_run_trigger_mode AS ENUM ('SYNC', 'ASYNC')`;

    // Convert columns back to enums (values are now uppercase)
    await sqlClient`ALTER TABLE scraper_actor_runs ALTER COLUMN vendor TYPE scraper_run_vendor USING vendor::scraper_run_vendor`;
    await sqlClient`ALTER TABLE scraper_actor_runs ALTER COLUMN trigger_mode TYPE scraper_run_trigger_mode USING trigger_mode::scraper_run_trigger_mode`;

    // Recreate constraints
    await sqlClient`
      ALTER TABLE scraper_actor_runs
      ADD CONSTRAINT scraper_actor_runs_vendor_run_id_key UNIQUE (vendor, run_id)
    `;
    await sqlClient`CREATE INDEX idx_scraper_actor_runs_vendor_status ON scraper_actor_runs (vendor, status)`;

    console.log('✓ Scraper actor run enum types migrated to uppercase');
  } catch (err: unknown) {
    console.warn('Could not migrate scraper enums (may already be correct):', (err as { message?: string }).message);
  }
}

export async function seedDatabase(connectionString?: string): Promise<void> {
  const resolvedConnectionString = connectionString ?? loadDatabaseEnv(__dirname).databaseUrl;
  assertSafeSeedTarget(resolvedConnectionString);
  const sqlClient = createSqlClient(resolvedConnectionString);
  const db = drizzle(sqlClient);

  try {
    // Clear reports table directly (before migrating enums) to avoid enum conflicts
    await sqlClient`TRUNCATE TABLE reports CASCADE`;

    // Now migrate enum types
    await migrateEnumTypes(sqlClient);

    await db.transaction(async (tx) => {
      for (const table of getTablesInDeleteOrder(['reports'])) {
        await tx.delete(table);
      }

      await tx.insert(users).values([...FIXTURE_USERS]);
      await tx.insert(userLocations).values([...FIXTURE_USER_LOCATIONS]);
      await tx.insert(socialMediaAccountProfiles).values([...FIXTURE_SOCIAL_MEDIA_ACCOUNT_PROFILES]);
      await tx.insert(subscriptions).values([...FIXTURE_SUBSCRIPTIONS]);
      await tx.insert(apiKeys).values([...FIXTURE_API_KEYS]);
      await tx.insert(posts).values([...FIXTURE_POSTS]);
      await tx.insert(scraperActorRuns).values([...FIXTURE_SCRAPER_ACTOR_RUNS]);
      await tx.insert(parserVersionRegistry).values([...FIXTURE_PARSER_VERSIONS]);
      await tx.insert(unprocessedScraperPayloads).values([...FIXTURE_UNPROCESSED_PAYLOADS]);
      await tx.insert(events).values([...FIXTURE_EVENTS]);
      await tx.insert(schedules).values([...FIXTURE_SCHEDULES]);
      await tx.insert(reports).values([...FIXTURE_REPORTS]);
    });
  } finally {
    await sqlClient.end();
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seed completed successfully.');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
