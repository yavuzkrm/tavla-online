# Tavla — Online 2 Kişilik Klasik (Düz) Tavla

Gerçek zamanlı, sadece **oda kodu** ile eşleşen, klasik tavla kurallarına (mars +
seçilebilir 3/5/7/9/11 puanlık maç) uyan iki kişilik web uygulaması.

## ⚠️ Şeffaflık Notu — Bu Bir "Vibe Coding" Projesidir

Bu projenin kodu **Claude (Anthropic)** ile birlikte, doğal dilde verilen bir
spesifikasyondan üretildi — satır satır elle yazılmadı. Kural motoru (`gameEngine.ts`)
üretilirken tanımlanan tüm kurallara karşı **17 unit testle** doğrulandı ve
hem sunucu hem istemci hatasız derleniyor, ancak:

- Kodun büyük kısmı **detaylıca incelenmedi/refactor edilmedi**; production kalitesinde
  bir kod review'dan geçmedi.
- Amaç bir teknoloji denemesi / prototip / CV'ye eklenecek bir referans projesi —
  "ben bunu satır satır yazdım" iddiası değil.
- Repoyu inceleyen biri (örn. bir mülakatta) kodun nasıl çalıştığını sorarsa,
  mimari kararları (oda kodu akışı, sunucu-taraflı kural doğrulama, forced-maximal-play
  mantığı vb.) açıklayabilecek kadar anladığımdan emin olmam gerekiyor — bu README'nin
  "Kuralların Uygulanışı" bölümü bu yüzden var.

Bunu gizlemek yerine açıkça belirtmeyi tercih ettim.

## Klasör Yapısı

```
tavla/
  server/   Node.js + TypeScript + Socket.IO — TÜM oyun mantığı burada çalışır
  client/   React + TypeScript + Vite + Zustand — sadece görselleştirme/girdi
```

## Nasıl Çalıştırılır

### 1) Sunucu

```bash
cd server
npm install
npm run dev        # http://localhost:4000 üzerinde Socket.IO sunucusu başlar
```

Kural motorunun testlerini çalıştırmak için:

```bash
npm test           # vitest — bar girişi, bearing-off, çift zar, mars vb. testleri
```

### 2) İstemci

Başka bir terminalde:

```bash
cd client
npm install
npm run dev         # http://localhost:5173 açılır
```

Varsayılan olarak istemci `http://localhost:4000` adresindeki sunucuya bağlanır.
Farklı bir adres kullanmak için `client/.env` dosyasına:

```
VITE_SERVER_URL=http://SUNUCU_ADRESIN:4000
```

### 3) İki oyuncuyla test

`http://localhost:5173`'ü iki farklı sekmede/tarayıcıda açın. Birinde "Oda Kur",
diğerinde çıkan kodu "Odaya Katıl" ekranına girin.

## Kuralların Uygulanışı — Nerede Ne Var

- **Kural motoru (saf fonksiyonlar):** `server/src/gameEngine.ts`
  - Mutlak/göreceli nokta dönüşümü: `toPlayerRelativePoint` / `toAbsoluteIndex`
  - Tek zar hamle üretimi (blok, vurma, bar girişi, bearing-off eşik + overage): `getSingleDieMoves`
  - **Forced maximal play** (mümkün olan maksimum zar sayısını oynama zorunluluğu):
    `getMaxPlayableDiceSequence` + `getLegalMovesNow` — tüm olası hamle dizilerini
    DFS ile tarar, en uzun diziyi bulur, sadece o dizilerin ilk adımlarına izin verir.
  - **Mars kuralı:** `isMars` — kaybedenin `borneOff === 0` olup olmadığını kontrol eder;
    `applyMove` oyunu bitiren hamlede otomatik olarak `isMarsWin` alanını doldurur.
  - Pip count: `getPipCount`.
- **Oda/maç yönetimi:** `server/src/roomManager.ts` (in-memory `Map<roomId, Room>`,
  6 karakterli, karışabilecek karakterler (0/O, 1/I) hariç tutulmuş oda kodları).
- **Socket.IO olayları ve maç akışı:** `server/src/index.ts` — zar atma (kriptografik
  RNG, `crypto.randomInt`), hamle doğrulama, otomatik pas geçme senaryoları
  (3.3'teki TÜM senaryolar dahil), oyun/maç bitişi, otomatik yeni oyun başlatma,
  tekrar oyna teklifi, 30 saniyelik yeniden bağlanma toleransı.
- **İstemci:** `client/src/components/Board.tsx` tıkla-taşı arayüzü; sunucudan gelen
  `legalMoves` listesi dışında hiçbir hamle gönderilemez (hile istemciden yapılamaz —
  sunucu her hamleyi `isMoveCurrentlyLegal` ile yeniden doğrular).

## Bilinçli Olarak Basitleştirilmiş / Eksik Bırakılan Kısımlar

Bu teslim çalışan, kuralca doğru bir iskelet + tam bir kural motorudur, ancak
zaman/verilen kapsam nedeniyle şu "ek/opsiyonel" (spesifikasyonun 7. bölümü,
zorunlu değil) kısımlar sadece temel/stub seviyesinde bırakıldı:

- **Sesler:** Kontrol çubuğunda ses aç/kapa butonu var ama gerçek ses dosyaları
  eklenmedi (`ControlBar.tsx` içine `<audio>` eklemek yeterli olur).
- **Sürükle-bırak:** Hamleler şu an tıkla-seç / tıkla-taşı ile yapılıyor
  (spesifikasyondaki hem tıklama hem sürükle-bırak seçeneklerinden biri).
- **Görsel cila:** Zar atma animasyonu, pul sıçrama efekti, tahta dokusu görseldeki
  kadar detaylı değil — CSS ile temel bir ahşap tema uygulandı, ince ayar gerekir.
- **Kalıcı istatistik:** Oyun geçmişi / toplam galibiyet sayacı eklenmedi (in-memory
  `Room` state'i process yeniden başlayınca sıfırlanır; kalıcılık için Redis/DB eklenebilir).
- **Otomatik "rejoin" tetikleyici:** Sunucu tarafı reconnect mantığı (30 sn tolerans)
  tam çalışır; istemci tarafında sayfa yenilenince otomatik `rejoin_room` çağrısı
  şu an tetiklenmiyor (roomId + playerId'yi localStorage'a yazıp `useEffect` içinde
  `rejoin_room` emit etmek yeterli olur).

Tüm ZORUNLU kural maddeleri (3.1–3.9), oda kodu akışı (5. bölüm) ve maç
uzunluğu/mars sistemi tam olarak, testlerle doğrulanmış şekilde uygulandı.

## Canlıya Alma (Deploy)

- `server`: herhangi bir Node.js barındırma (Render, Railway, Fly.io, kendi VPS'iniz)
  üzerinde `npm run build && npm start`.
- `client`: `npm run build` ile üretilen `dist/` klasörünü herhangi bir statik
  barındırmaya (Vercel, Netlify, Cloudflare Pages) koyup `VITE_SERVER_URL`'i
  gerçek sunucu adresinize göre ayarlayın.
