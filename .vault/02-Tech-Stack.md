# ⚙️ AgentSync - Teknoloji Yığını (Tech Stack)

## 🏗️ Mimarik Katmanlar

```
┌─────────────────────────────────────────────────┐
│        VS Code Extension (İstemci)              │
│   TypeScript + VS Code Extension API            │
└─────────────────────────────────────────────────┘
                       ↓ WebSocket
┌─────────────────────────────────────────────────┐
│        Node.js WebSocket Server                 │
│   (y-websocket paket tarafından sağlanmış)      │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│   Yjs CRDT (Conflict-free Replicated DataType)  │
│   (Sinkronizasyon motoru)                       │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│      OS File System (fs modülü)                 │
│   (Dosya izin yönetimi - fs.chmodSync)          │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Teknoloji Detayları

### Backend (Sunucu)

| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| **Node.js** | 16+ | JavaScript runtime |
| **y-websocket** | Latest | WebSocket sunucusu (hazır paket) |
| **yjs** | Latest | CRDT algoritması (sinkronizasyon) |
| **TypeScript** | 4.5+ | Tip güvenliği |

**Veritabanı**: YOKTUR! Sadece trafiği yönlendiren sunucu.

### İstemci (VS Code Extension)

| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| **VS Code Extension API** | Latest | Eklenti geliştirme |
| **TypeScript** | 4.5+ | Tip güvenliği |
| **yjs** | Latest | İstemci tarafı CRDT |
| **y-websocket** | Latest | İstemci tarafı WebSocket |
| **Node.js fs modülü** | Built-in | Dosya izin yönetimi |

---

## 🔄 Senkronizasyonu Mekanizması: Yjs (CRDT)

### Yjs Nedir?

**Yjs**, "Conflict-free Replicated Data Type" (CRDT) algoritmasını kullanan bir JavaScript kütüphanesidir.

### Özelliği

```
A Editöründe:  "Hello W[orld]" yazıldı
               ↓
B Editöründe:  "Hello [W]orld" yazıldı

Çakışma: Aynı yere iki farklı karakter?

Yjs CRDT Çözüyor:
  - Benzersiz operation ID'ler (timestamp + client_id)
  - Otomatik olarak sırası düzenler
  - Sonuç: Her editör aynı metni görür ✅
```

### Avantajı

- ✅ Merkezi veritabanı gerekmiyor
- ✅ Çekirdek CRDT mantığı otomatik (conflict resolution)
- ✅ Düşük latency (peer-to-peer senkron)
- ✅ Offline desteği (optional)

---

## 🔒 Dosya Kilidi Mekanizması: OS-Level Permissions

### fs.chmodSync() Nedir?

Node.js'in `fs` modülü, işletim sistemi seviyesinde dosya izinlerini değiştirebilir.

```javascript
// Dosyayı Salt Okunur Yap (0o444 = r--r--r--)
fs.chmodSync(filePath, 0o444);

// Dosyayı Yazılabilir Yap (0o666 = rw-rw-rw-)
fs.chmodSync(filePath, 0o666);
```

### Kullanım Mantığı

```
B ajanı yazarken "dosyaX yazılıyor" sinyali
  ↓
A'nın eklentisi fs.chmodSync(dosyaX, 0o444) çalıştırır
  ↓
Artık A ajanı dosyaX'e yazamaz
  ↓
"EACCES: permission denied" hatası alır ve durdurulur ✅
  ↓
B bitince, A'nın eklentisi fs.chmodSync(dosyaX, 0o666) çalıştırır
  ↓
A yazabiliyor ✅
```

### Neden İşletim Sistemi Seviyesi?

- 🔒 Hiçbir yazılım bunu bypass edemez (ajandan da değil)
- ⚡ Hızlı ve güvenilir
- 🛡️ Kernel düzeyinde enforce (en güvenli)

---

## 📡 WebSocket İletişim Protokolü

### Bağlantı Akışı

```
VS Code Eklentisi A          WebSocket Sunucu          VS Code Eklentisi B
         |                          |                          |
         |------- WebSocket Handshake ----->|                  |
         |<------ Handshake OK -------------|                  |
         |                          |                          |
         |                          |<----- WebSocket Handshake ---|
         |                          |------ Handshake OK -------->|
         |                          |                          |
    Değişiklik yapıyor              |                          |
         |--- Y.Text Güncellemesi -->|                          |
         |                          |-- Yayınla (Broadcast) -->|
         |                          |                          |
         |<---- B'nin güncellemesi --|                          |
         |                          |<-- Y.Text Güncellemesi ---|
```

### Mesaj Tipi (Örnek)

```json
{
  "type": "file_write_start",
  "filePath": "src/main.ts",
  "clientId": "developer-b-machine"
}

{
  "type": "file_write_end",
  "filePath": "src/main.ts",
  "clientId": "developer-b-machine"
}
```

---

## 🎯 Teknoloji Stack Özeti

| Katman | Teknoloji | Rol |
|--------|-----------|-----|
| **Frontend** | VS Code Extension API | UI & dosya editörü |
| **Senkronizasyon** | Yjs + WebSocket | Gerçek zamanlı sync |
| **Sunucu** | Node.js + y-websocket | Mesaj broker |
| **Dosya Kilidi** | fs.chmodSync | Yazma engeli |
| **Dil** | TypeScript | Tip güvenliği |

---

## ⚡ Performans Beklentileri

| Metrik | Hedef | Açıklama |
|--------|-------|----------|
| Senkronizasyon Latency | <100ms | Metin güncellemesi |
| WebSocket Handshake | <50ms | Bağlantı kurma |
| Dosya Kilidi Uygulanması | <10ms | fs.chmodSync işlemi |

---

**Hazır mısın? Devam!** 🚀
