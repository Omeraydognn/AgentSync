# AgentSync

**Multiplayer AI Agent Code Synchronization & Conflict Resolution Tool**

AgentSync, aynı projede çalışan birden fazla AI ajanının (Cursor, Claude Code, Copilot vb.) birbirinin kodunu ezmeden, çakışma yaşamadan eş zamanlı çalışmasını sağlayan bir VS Code eklentisidir.

---

## Neden AgentSync?

Modern yazılım geliştirmede Vibe Coding yaygınlaşıyor: bir geliştirici Cursor'da bir AI ajanıyla çalışırken, başka bir geliştirici aynı dosyada Claude Code ile çalışıyor. Bu durum kaçınılmaz olarak şu sorunları doğurur:

- **Kayıp değişiklikler:** İki ajan aynı anda aynı dosyaya yazarsa, biri diğerinin değişiklikini siler.
- **Sonsuz döngü çakışmaları:** Bir ajanın çıktısı diğerini tetikler, o da birincisini tetikler.
- **Merge cehennemi:** Git birleşme çakışmaları elle çözülmek zorunda kalır.

AgentSync bu sorunları **gerçek zamanlı senkronizasyon** ve **donanımsal dosya kilitleme** ile kökten çözer.

---

## Nasıl Çalışır?

### Mimari

```
[Geliştirici A - Cursor]          [Geliştirici B - Claude Code]
        |                                    |
   [AgentSync]                         [AgentSync]
        |                                    |
        +--------> WebSocket Server <--------+
                   (ws://localhost:1234)
                   Yjs CRDT Sync Engine
```

### Temel Bileşenler

**1. WebSocket Relay Server (`server/server.js`)**
- Node.js tabanlı basit bir broadcast sunucusu
- Port 1234 üzerinde çalışır
- Tüm bağlı istemcilere mesajları iletir
- Yjs protokolünü anlar, CRDT senkronizasyonunu yönetir

**2. VS Code Eklentisi (`agent-sync/`)**
- Her açık dosya için bir `Y.Text` CRDT nesnesi oluşturur
- Yerel değişiklikler → WebSocket → Uzak istemciler zincirine yayar
- Uzak değişiklikleri alarak editöre uygular
- OS seviyesinde dosya kilitleme/açma yapar

### Senkronizasyon Akışı

```
Kullanıcı A bir karakter yazar
         ↓
onDidChangeTextDocument tetiklenir
         ↓
Yjs Y.Text güncellenir (CRDT)
         ↓
WebSocket üzerinden sunucuya gönderilir
         ↓
Sunucu tüm istemcilere yayar
         ↓
Kullanıcı B'nin eklentisi değişikliği alır
         ↓
isApplyingRemoteChange = true (döngü önleme)
         ↓
WorkspaceEdit ile editöre uygulanır
         ↓
isApplyingRemoteChange = false
```

### Dosya Kilitleme Akışı

```
Kullanıcı A yazmaya başlar
         ↓
fileLocks Y.Map'e {uri: clientID} eklenir
         ↓
WebSocket üzerinden tüm istemcilere yayılır
         ↓
Kullanıcı B'nin eklentisi kilidi algılar
         ↓
fs.chmodSync(dosya, 0o444) → Dosya READ-ONLY yapılır
         ↓
Status Bar: "🔴 LOCKED: dosya.ts (By Teammate)"
         ↓
Kullanıcı A 2 saniye yazmayı durdurur
         ↓
fileLocks'tan kilit silinir, Kullanıcı B'ye yayılır
         ↓
fs.chmodSync(dosya, 0o666) → Dosya tekrar yazılabilir
         ↓
Status Bar: "🟢 AgentSync: Idle"
```

---

## Özellikler

| Özellik | Açıklama |
|---|---|
| **Gerçek Zamanlı Sync** | Yjs CRDT ile milisaniyeler içinde karakter bazında senkronizasyon |
| **OS Seviye Kilit** | `chmod 0o444` ile donanımsal write koruması |
| **Sonsuz Döngü Koruması** | `isApplyingRemoteChange` bayrağı ile remote→local döngüsü engellenir |
| **Spam Koruması** | Zaten kilitli dosyalar için tekrar `chmod` çağrılmaz |
| **Debounce** | Son tuş basımından 2 saniye sonra kilit otomatik kalkar |
| **Panik Butonu** | Ağ koptuğunda tüm kilitleri zorla açma komutu |
| **Status Bar** | Anlık kilit durumu görsel göstergesi |
| **Output Channel** | Tüm sync ve kilit olaylarının log'u |

---

## Kurulum

### Gereksinimler

- VS Code `^1.75.0` veya Cursor (VS Code tabanlı)
- Node.js `^18.0.0`
- npm

### 1. Sunucuyu Başlatın

```bash
cd server
npm install
node server.js
# 🚀 WebSocket server running on ws://localhost:1234
```

### 2. Eklentiyi Yükleyin

**VSIX dosyasından (önerilen):**
```bash
# VS Code / Cursor'da:
# Cmd+Shift+P → "Extensions: Install from VSIX..."
# agentsync-0.0.1.vsix dosyasını seçin
```

**Geliştirme modunda:**
```bash
cd agent-sync
npm install
npm run compile
# VS Code'da F5 tuşuna basarak Extension Host başlatın
```

### 3. Takım arkadaşları da aynı adımları uygulasın

Her geliştirici kendi makinesinde sunucuyu başlatır ve eklentiyi yükler. (İlerideki sürümlerde merkezi bir sunucu desteği planlanmaktadır.)

---

## Kullanım

Eklenti kurulunca otomatik olarak aktif olur. Herhangi bir ayar gerekmez.

### Status Bar Göstergeleri

- `🟢 AgentSync: Idle` — Tüm dosyalar serbest, kod yazmaya hazır.
- `🔴 LOCKED: [DosyaAdı] (By Teammate)` — Bir takım arkadaşınızın ajanı o an bu dosyaya yazıyor, bekleyin.

### Output Channel

Tüm olayları görmek için:
- `View → Output → AgentSync` sekmesini açın

```
🔄 AgentSync başlıyor...
✓ Sunucuya bağlandı
[+] Takibe alındı: /proje/src/index.ts
🔴 Kilitlendi: index.ts
🟢 Kilit açıldı: index.ts
```

---

## Sorun Giderme

### Ağ koptu, dosyalar kilitli kaldı

Komut paletini açın (`Cmd+Shift+P` / `Ctrl+Shift+P`):

```
> AgentSync: Force Unlock All Files
```

Bu komut:
- Tüm Yjs kilit kayıtlarını temizler
- Tüm `chmod 0o444` kilitlerini `0o666`'ya döndürür
- Status Bar'ı sıfırlar
- Timer'ları iptal eder

### Sunucuya bağlanılamıyor

1. `server.js`'in çalıştığını kontrol edin: `node server.js`
2. Firewall'un 1234 portuna izin verdiğini kontrol edin
3. `ws://localhost:1234` adresinin doğru olduğunu doğrulayın

### Değişiklikler karşı tarafa geçmiyor

1. Her iki tarafın da aynı sunucuya bağlı olduğunu kontrol edin
2. Output Channel'da hata mesajı olup olmadığını kontrol edin
3. Eklentiyi yeniden yükleyin: `Cmd+Shift+P → Developer: Reload Window`

---

## Teknik Detaylar

### Yjs CRDT Nedir?

CRDT (Conflict-free Replicated Data Type), merkezi bir koordinatöre ihtiyaç duymadan birden fazla tarafın aynı veriyi eş zamanlı düzenleyebileceği bir veri yapısıdır. AgentSync, `Y.Text` tipini kullanır:

- Her karakter ekleme/silme bir **operasyon** olarak temsil edilir
- Operasyonlar ağ sırası ne olursa olsun her zaman aynı sonucu üretir
- Çakışan düzenlemeler otomatik olarak birleştirilir

### Kilit Mekanizması

```typescript
// Kilit edinme
fileLocks.set(uri, provider.awareness.clientID);

// Kilit gözlemleme
fileLocks.observe(() => {
  // Başka bir istemcinin kilidi → chmod 0o444
  // Kilit kalktı → chmod 0o666
});

// Debounce ile otomatik bırakma
setTimeout(() => fileLocks.delete(uri), 2000);
```

### Sonsuz Döngü Koruması

Remote değişiklik uygulandığında `onDidChangeTextDocument` tekrar tetiklenir. Bu döngüyü kesmek için:

```typescript
// Observer'da SENKRON olarak set edilir (async başlamadan önce)
isApplyingRemoteChange = true;
applyRemoteChanges(fileUri, event)
  .finally(() => { isApplyingRemoteChange = false; });

// onDidChangeTextDocument'in en başında kontrol edilir
if (isApplyingRemoteChange) { return; }
```

---

## Proje Yapısı

```
AgentSync/
├── agent-sync/              # VS Code eklentisi
│   ├── src/
│   │   └── extension.ts     # Ana eklenti kodu
│   ├── out/                 # Derlenmiş JS çıktısı
│   ├── package.json         # Eklenti manifest
│   ├── tsconfig.json        # TypeScript ayarları
│   └── icon.png             # Eklenti ikonu
│
└── server/                  # WebSocket relay sunucusu
    ├── server.js            # Sunucu kodu
    └── package.json
```

---

## Teknoloji Yığını

| Teknoloji | Versiyon | Kullanım Amacı |
|---|---|---|
| TypeScript | ^5.0 | Tip güvenli eklenti geliştirme |
| Yjs | ^13.6.30 | CRDT senkronizasyon motoru |
| y-websocket | ^3.0.0 | Yjs için WebSocket provider |
| ws | ^8.20.1 | WebSocket istemci ve sunucu |
| VS Code API | ^1.75.0 | Editör entegrasyonu |
| Node.js | ^18.0 | Sunucu runtime |

---

## Yol Haritası

- [ ] Merkezi bulut sunucusu desteği (takımlar arasında ortak relay)
- [ ] Awareness UI: Kim hangi satırda çalışıyor görsel göstergesi
- [ ] Ajan kimlik sistemi: "Claude", "Cursor", "Copilot" etiketleri
- [ ] Kilit öncelik sırası: Daha uzun süredir bekleyen ajana öncelik
- [ ] VS Code Marketplace yayını

---

## Lisans

MIT

---

## Geliştirici

**ArfDev-on-ArfDAO**

> AgentSync, Vibe Coding çağında AI ajanlarının barış içinde bir arada çalışması için tasarlandı.
