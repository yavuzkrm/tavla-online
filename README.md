# Tavla Online

İki kişinin tarayıcıdan, bir oda koduyla eşleşip klasik (düz) tavla oynayabildiği gerçek zamanlı bir web uygulaması. Hesap açmak gerekmiyor: biri oda kuruyor, diğeri 6 haneli kodu girip katılıyor.

> **Not:** Bu projeyi Claude (Anthropic) ile birlikte, ne istediğimi anlatarak geliştirdim. Kodu satır satır ben yazmadım. Kural motorunu testlerle doğruladım ve aşağıdaki mimariyi anlatabilecek kadar inceledim.

## Özellikler

- Oda kodu ile eşleşme (karışabilecek `0/O`, `1/I` gibi karakterler kodlarda kullanılmıyor)
- 3, 5, 7, 9 veya 11 puanlık maç seçimi, mars kuralı
- Kırık taşın bara gitmesi, bardan giriş, toplama ve çift zar dahil tüm klasik kurallar
- **Zorunlu maksimum oynama:** oynanabilecek en fazla zarı oynatmayan hamlelere izin verilmiyor
- Oynanabilecek hamle yoksa sıra otomatik geçiyor
- Hamle geri alma, sohbet, emoji gönderme, rövanş teklifi
- Bağlantı koparsa 30 saniye içinde aynı oyuna geri dönme (sayfa yenilense bile)
- Zar, taş ve kırma için ses efektleri

## Mimari

```
server/   Node.js + TypeScript + Socket.IO   ->  oyunun tüm mantığı burada
client/   React + TypeScript + Vite + Zustand ->  sadece çizim ve kullanıcı girdisi
```

Oyunun doğruluğu sunucuda sağlanıyor. İstemci, sunucudan gelen `legalMoves` listesi dışında bir hamle gönderemiyor. Sunucu da gelen her hamleyi tekrar doğruluyor, yani tarayıcıdan hile yapılamıyor. Zarlar `crypto.randomInt` ile sunucuda atılıyor.

| Dosya | İçerik |
|---|---|
| `server/src/gameEngine.ts` | Saf fonksiyonlardan oluşan kural motoru: hamle üretimi, bar ve toplama kuralları, mars, pip sayısı |
| `server/src/gameEngine.test.ts` | Kural motorunun testleri (22 test, vitest) |
| `server/src/roomManager.ts` | Oda kodu üretimi ve oda durumunun bellekte tutulması |
| `server/src/index.ts` | Socket.IO olayları: zar atma, hamle, geri alma, sohbet, rövanş, yeniden bağlanma |
| `client/src/components/Board.tsx` | Tahta ve tıkla-taşı arayüzü |
| `client/src/sound.ts` | Ses efektleri (zar sesi dosyadan, diğerleri Web Audio API ile üretiliyor) |

Zorunlu maksimum oynama kuralı en uğraştırıcı kısımdı. `getMaxPlayableDiceSequence`, olası tüm hamle dizilerini DFS ile tarayıp en uzun diziyi buluyor. `getLegalMovesNow` da yalnızca bu dizilerin ilk adımlarına izin veriyor.

## Çalıştırma

Node.js 18+ gerekiyor.

```bash
# Sunucu (http://localhost:4000)
cd server
npm install
npm run dev
npm test        # kural motoru testleri

# İstemci (http://localhost:5173), ayrı bir terminalde
cd client
npm install
npm run dev
```

İstemci varsayılan olarak `http://localhost:4000` adresine bağlanıyor. Başka bir sunucu için `client/.env` dosyasına şunu ekle:

```
VITE_SERVER_URL=http://sunucu-adresi:4000
```

Denemek için `localhost:5173`'ü iki ayrı sekmede aç. Birinde oda kur, diğerinde o kodla katıl.

## Eksikler

- Taşlar sürükle-bırak ile değil, tıklayarak oynanıyor.
- Odalar sunucunun belleğinde tutuluyor. Sunucu yeniden başlarsa devam eden oyunlar ve skorlar siliniyor.

## Yayına alma

Her iki klasörde de Railway için `railway.toml` var. Sunucu tarafında `npm run build && npm start` yeterli. İstemcide `npm run build` ile oluşan `dist/` klasörü herhangi bir statik barındırmaya konabilir. Bu durumda `VITE_SERVER_URL` değişkeni sunucunun adresine ayarlanmalı.

## Lisans

MIT
