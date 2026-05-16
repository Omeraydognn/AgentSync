# 📡 Faz 1: İletişim Altyapısının Kurulması

## 🎯 Faz Hedefi

Sadece `yjs` ve `y-websocket` kurularak, paket içindeki hazır WebSocket sunucusu ayağa kaldırmak.

**Çıktı**: Çalışan bir Node.js WebSocket sunucusu, iki istemciyi bağlayabilen ve Yjs güncellemelerini broadcast yapabilen.

---

## ✅ Başarı Kriterleri

- [ ] Node.js projesi oluşturuldu
- [ ] `yjs` paketi kuruldu
- [ ] `y-websocket` paketi kuruldu
- [ ] WebSocket sunucusu başlıyor
- [ ] Port 1234'te dinliyor (varsayılan)
- [ ] İki test istemcisi bağlanabiliyor
- [ ] Yjs güncellemeleri broadcast yapılıyor
- [ ] Konsola "Server running on ws://localhost:1234" mesajı çıkıyor

---

## 📋 Yapılacak Adımlar

### 1. Node.js Projesi Oluşturma
```bash
# Proje dizini (zaten varsa skip)
cd /Users/omeraydogan/AgentSync

# package.json oluştur
npm init -y

# TypeScript setup (opsiyonel ama önerilir)
npm install -D typescript ts-node @types/node
```

### 2. Paket Kurulumu
```bash
npm install yjs y-websocket
```

### 3. WebSocket Sunucusu Başlatma

Dosya: `server.ts` veya `server.js`

```typescript
import * as Y from 'yjs';
import * as WebsocketProvider from 'y-websocket';

// y-websocket'in WebSocket sunucusu
// paket içinde hazır WebSocket sunucusu var

// Başlangıç kodunuz burada
```

### 4. Test İstemcileri Bağlanması

İki istemcinin bağlanabildiğini test etmek için basit bir Node.js test script'i.

---

## 🔧 İmplementasyon Detayları

### Server.ts Yapısı (Şablon)

```typescript
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as webSocket from 'y-websocket';

const port = process.env.PORT || 1234;
const wss = new webSocket.WebSocketServer({ port });

console.log(`Server running on ws://localhost:${port}`);

wss.on('connection', (conn) => {
  console.log('Client connected');
  conn.on('close', () => {
    console.log('Client disconnected');
  });
});
```

### Key Components

| Bileşen | Amaç |
|---------|------|
| **Y.Doc** | CRDT belgesini temsil eder |
| **Y.Text** | Metin tipi (yazı) |
| **WebSocketProvider** | WebSocket bağlantı yönetimi |
| **Awareness** | Client durumunu shared olarak tutmak |

---

## 📊 Beklenen Çıktı

### Server Başlatıldığında
```
Server running on ws://localhost:1234
```

### Client Bağlandığında
```
Server running on ws://localhost:1234
Client connected
Client connected
```

### Client Koptuğunda
```
Client disconnected
```

---

## 🧪 Test Planı

### Manuel Test
```bash
# Terminal 1: Sunucuyu başlat
npm start

# Terminal 2: Client 1 (simülasyon)
npm run test:client1

# Terminal 3: Client 2 (simülasyon)
npm run test:client2

# Beklenen: Her iki client'da Y.Text güncellemeleri görülecek
```

---

## 📁 Dosya Yapısı (Faz 1 Sonunda)

```
AgentSync/
├── package.json
├── package-lock.json
├── tsconfig.json
├── server.ts          # Ana sunucu dosyası
├── test/
│   └── client-test.ts # Test istemcileri (opsiyonel)
└── node_modules/
    ├── yjs/
    └── y-websocket/
```

---

## 🚀 Başlatma Komutu

```bash
# Geliştirme
npm run dev

# Production
npm run start
```

---

## 🔍 Hata Ayıklama

| Problem | Çözüm |
|---------|-------|
| Port zaten kullanımda | `lsof -i :1234` ile kontrol et, farklı port kullan |
| `y-websocket` kurulu değil | `npm install y-websocket` çalıştır |
| "Cannot find module" | `npm install` ve `npm run build` çalıştır |

---

## 📝 Notlar

- **Veritabanı yok**: Sadece sunucu trafiği yönlendirir
- **Persistence yok**: Sunucu kapanırsa veri silinir (test için iyidir)
- **Port 1234**: Varsayılan, environment variable ile değiştirebilir

---

## ✨ Faz 1 Tamamlandığında

Aşağıdaki komutu çalıştırdığında:
```bash
npm start
```

Konsola şu çıkmalı:
```
Server running on ws://localhost:1234
```

Ve iki test istemcisini bağladığında:
```
Server running on ws://localhost:1234
Client connected
Client connected
```

---

## 📌 Sonraki Adımlar

Faz 1 tamamlandığında ve test geçtiğinde, Faz 2'de (VS Code Eklentisi) bu sunucuya bağlanacağız.

---

**Status**: ⏳ Beklemede  
**Başlangıç**: 2026-05-16  
**Bitiş**: -  
**Not**: Faz 1 tamamlanması için komut bekleniyor.

