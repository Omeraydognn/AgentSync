# 🏛️ AgentSync - Sistem Mimarisi

## 🔄 Genel Sistem Akışı

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     AGENT SYNC ECOSYSTEM                                 │
│                                                                          │
│   Developer A (Cursor AI)          Developer B (Claude AI)              │
│          │                                  │                            │
│   ┌──────▼──────┐                  ┌──────▼──────┐                      │
│   │ VS Code     │                  │ VS Code     │                      │
│   │ Extension A │                  │ Extension B │                      │
│   │             │                  │             │                      │
│   │ • Y.Text    │                  │ • Y.Text    │                      │
│   │ • Monitor   │                  │ • Monitor   │                      │
│   │ • File Lock │                  │ • File Lock │                      │
│   └──────┬──────┘                  └──────┬──────┘                      │
│          │                                  │                            │
│          │         WebSocket (Ports 1234 & 1235)    │                            │
│          └──────────────────┬───────────────┘                            │
│                             │                                             │
│                   ┌─────────▼────────┐                                   │
│                   │  Node.js Server  │◄───── (Web3) ──► Monad Smart Contract │
│                   │  (y-websocket)   │                                   │
│                   │                  │◄──── (API) ───► OpenRouter (Claude 3.5) │
│                   │ • Yjs Broadcast  │                                   │
│                   │ • Traffic Control│                                   │
│                   │ • No DB (!)      │                                   │
│                   └──────────────────┘                                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 VS Code Extension (İstemci) Mimarisi

### Dosya Yapısı

```
vs-code-extension/
├── src/
│   ├── extension.ts              # Giriş noktası (activate/deactivate)
│   ├── sync/
│   │   ├── YjsManager.ts         # Yjs CRDT yönetimi
│   │   ├── WebSocketClient.ts    # WebSocket bağlantısı
│   │   └── SyncEngine.ts         # Metin değişikliği senkronizasyonu
│   ├── lock/
│   │   ├── FileLockManager.ts    # Dosya kilit yönetimi
│   │   ├── FilePermissions.ts    # OS-level izin değişimi
│   │   └── LockMonitor.ts        # Kilit durumu monitörü
│   ├── ui/
│   │   └── StatusBar.ts          # VS Code Status Bar
│   └── utils/
│       ├── Logger.ts             # Logging
│       └── Constants.ts          # Sabitler
├── package.json                  # Eklenti konfigürasyonu
└── tsconfig.json                 # TypeScript konfigürasyonu
```

### Bileşenleri Akış Diyagramı

```
┌────────────────────────────────────────────────────────────────┐
│               VS Code Extension Lifecycle                      │
└────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼────────┐
                    │  extension.ts    │
                    │   (activate)     │
                    └─────────┬────────┘
                              │
              ┌───────────────┴────────────────┐
              │                                │
      ┌───────▼─────────┐          ┌──────────▼──────────┐
      │ YjsManager      │          │ WebSocketClient     │
      │ • Y.Text init   │          │ • Connect server    │
      │ • Y.Text events │          │ • Reconnect logic   │
      └────────┬────────┘          └──────────┬──────────┘
               │                              │
               └──────────────┬───────────────┘
                              │
                    ┌─────────▼────────┐
                    │  SyncEngine      │
                    │ • onDidChange    │
                    │ • Apply updates  │
                    │ • Infinite loop  │
                    │   prevention     │
                    └─────────┬────────┘
                              │
                    ┌─────────▼────────┐
                    │ FileLockManager  │
                    │ • Monitor signals│
                    │ • Apply lock     │
                    │ • Release lock   │
                    └─────────┬────────┘
                              │
                    ┌─────────▼────────┐
                    │   StatusBar      │
                    │ • Show state     │
                    │ • Update icon    │
                    └──────────────────┘
```

---

## 🖥️ Node.js Sunucu Mimarisi

### Dosya Yapısı

```
node-server/
├── server.ts                    # Sunucu başlangıcı
├── types.ts                     # TypeScript tipler
└── index.js                     # y-websocket hazır paketi
```

### Sunucu Akışı

```
┌──────────────────────────────────────────────────┐
│         Node.js WebSocket Server                │
│        (y-websocket default)                    │
└──────────────────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
   ┌────▼─────┐              ┌──────▼──────┐
   │ Client A │◄────────────►│ Client B    │
   │ connects │   Broadcast  │ connects    │
   └────┬─────┘   Updates    └──────┬──────┘
        │                            │
        │   Y.Text Update / Lock     │
        └────────────────────────────┘
                      │
        ┌─────────────▼──────────────┐
        │       AI Traffic Agent     │
        │      (Port 1235 Control)   │
        └─────────────┬──────────────┘
                      │
        ┌─────────────▼──────────────┐
        │                            │
   ┌────▼─────┐              ┌──────▼──────┐
   │ Client A │              │ Client B    │
   │ receives │◄─────────────│ receives    │
   │ update   │  Broadcast   │ update      │
   └──────────┘              └─────────────┘
```

---

## 🔐 Dosya Kilidi Mekanizması Detayı

### Kilit Durumu Yönetimi

```
Başlangıç: dosya = 0o666 (yazılabilir)
                     │
           B ajanı yazıyor → "write_start" (Port 1235 üzerinden lock isteği)
                     │
                     ▼
           A'da: fs.chmodSync(file, 0o444)
                dosya = Salt Okunur
                     │
           A ajandı yazarsa: EACCES (izin hatası)
                     │
           A ajandı kilitli dosyaya erişmeye çalışırsa:
           Sunucu Claude AI'a danışır ve A'ya "Başka dosyaya geç" önerisi yollar. (Status bar: 💡)
                     │
           B bitirdi → "write_end" (Port 1235 üzerinden unlock)
                     │
                     ▼
           A'da: fs.chmodSync(file, 0o666)
                dosya = yazılabilir
```

### Güvenlik Ağı (Deactivation)

```
Eklenti kapatılırken (_deactivate):
  ├─ Tüm kilitli dosyaları bul
  ├─ Her dosya için: fs.chmodSync(file, 0o666)
  └─ Güvenli kapatma ✅
```

---

## 🔄 Metin Senkronizasyonu Detayı

### Sonsuz Döngü (Infinite Loop) Problemi

```
Sorun:
  1. A editör değiştirir
  2. SyncEngine bunu algılar
  3. Yjs'e gönderir (WebSocket)
  4. Sunucu broadcast yapar
  5. A'ya geri döner
  6. SyncEngine tekrar algılar
  7. -> Sonsuz Döngü! 🔄💥

Çözüm:
  const isRemote = (change) => change.source !== 'local';
  
  if (isRemote) {
    // Yjs güncellemesini VS Code'a uygula
    applyUpdate(editor);
  } else {
    // Kendi değişikliğimiz, Yjs'e gönder
    sendToYjs(change);
  }
```

---

## 📊 State Machine: Dosya Kilidi Durumları

```
    ┌─────────────────────────────────────┐
    │   INITIAL: Ready to Write (0o666)   │
    │      (Dosya yazılabilir)            │
    └──────────────────┬──────────────────┘
                       │
           "write_start" sinyali alındı
                       │
                       ▼
    ┌──────────────────────────────────────┐
    │  LOCKED: Read-Only (0o444)           │
    │  (Başka ajandı yazıyor)              │
    │  Timeout Timer: [Debounce]           │
    └──────────────────┬──────────────────┘
                       │
          "write_end" sinyali alındı
          VEYA Timer süresi doldu
                       │
                       ▼
    ┌─────────────────────────────────────┐
    │   RELEASED: Ready to Write (0o666)  │
    │      (Kendi ajanın yazabilir)       │
    └──────────────────┬──────────────────┘
```

---

## 🔄 Mesaj Akışı Örneği: A Yazarken, B'ye Ne Oluyor?

```
Zaman   │  A (Developer A)       │  Sunucu      │  B (Developer B)
────────┼────────────────────────┼──────────────┼─────────────────────
 t=0    │ "Hello" yazıyor        │              │ Idle
        │ Y.Text update gönder   │              │
 t=1    │                        │ Broadcast    │ Y.Text güncellemesi
        │                        │ "write_start"│
        │                        │              │ Alert: B yazılır mı?
 t=2    │ " World" yazıyor       │              │ fs.chmod(0o444)
        │ Y.Text update gönder   │              │ (Salt Okunur)
 t=3    │                        │ Broadcast    │
        │                        │ güncellemesi │
 t=4    │ Yazma bitirdi          │              │
        │ "write_end" sinyali    │              │
 t=5    │                        │ Broadcast    │ fs.chmod(0o666)
        │                        │ "write_end"  │ (Yazılabilir)
        │                        │              │ B artık yazabilir
```

---

## 📈 İletişim Protokolü

### WebSocket Mesaj Formatı

```typescript
// Yjs güncellemesi
{
  type: 'sync',
  payload: <Buffer>, // Y.Text binary update
}

// Dosya kilidi sinyali
{
  type: 'file_lock',
  filePath: 'src/main.ts',
  clientId: 'developer-a',
  action: 'write_start' | 'write_end'
}

// Heartbeat
{
  type: 'ping'
}
```

---

## ✅ Başarı Kriterleri (Per Architecture)

| Bileşen | Başarı | Başarısızlık |
|---------|--------|--------------|
| **Yjs Sync** | <100ms latency | >200ms latency |
| **Dosya Kilit** | Yazma çakışması yok | Çakışma meydana geldi |
| **Sonsuz Döngü** | Local/Remote flag çalışıyor | Loop yapıyor |
| **Deactivation** | Tüm kilitler açılıyor | Kalıntı kilitler kalıyor |

---

**Mimariyi Anladınız mı? Faz 1'e geçmeye hazır mısınız?** 🚀
