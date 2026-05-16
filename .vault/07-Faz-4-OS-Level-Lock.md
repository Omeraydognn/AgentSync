# 🔒 Faz 4: AI Çakışmalarını Engelleme (OS-Level Lock)

## 🎯 Faz Hedefi

WebSocket üzerinden "Dosya Yazılıyor" sinyali geldiğinde, ilgili dosyayı işletim sistemi seviyesinde salt okunur (read-only) yaparak, diğer ajanların yazmasını engellemek.

**Çıktı**: 
- WebSocket'ten "write_start" sinyali gelince, dosya `0o444` (salt okunur) hale geliyor
- "write_end" sinyali veya debounce timer'ı gelince, dosya `0o666` (yazılabilir) hale dönüyor
- Başka ajandan yazma denemesi `EACCES: permission denied` hatası alıyor
- Eklenti kapanırken tüm kilitli dosyalar otomatik olarak açılıyor

---

## ✅ Başarı Kriterleri

- [ ] WebSocket'ten "write_start" ve "write_end" sinyalleri alınıyor
- [ ] `fs.chmodSync()` ile dosya izinleri değiştirilebiliyor
- [ ] Dosya salt okunur hale gelmiş yazma denemesi `EACCES` hatası veriyor
- [ ] Debounce mekanizması çalışıyor (varsayılan 500ms)
- [ ] Eklenti kapatılırken (`deactivate`) tüm kilitli dosyalar açılıyor
- [ ] Güvenlik ağı (cleanup) çalışıyor
- [ ] WebSocket message format doğru şekilde parse ediliyor
- [ ] İki editor arasında yazma çakışması yok

---

## 📋 Yapılacak Adımlar

### 1. FileLockManager Oluşturma

Dosya: `src/lock/FileLockManager.ts`

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class FileLockManager {
  private lockedFiles: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs = 500;

  lockFile(filePath: string) {
    try {
      const absolutePath = path.resolve(filePath);

      // Zaten kilitli mi?
      if (this.lockedFiles.has(absolutePath)) {
        clearTimeout(this.lockedFiles.get(absolutePath)!);
      }

      // Dosyayı salt okunur yap
      fs.chmodSync(absolutePath, 0o444);
      vscode.window.showInformationMessage(`🔒 Locked: ${path.basename(filePath)}`);

      // Debounce timer set et
      const timer = setTimeout(() => {
        this.unlockFile(filePath);
      }, this.debounceMs);

      this.lockedFiles.set(absolutePath, timer);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to lock file: ${error}`);
    }
  }

  unlockFile(filePath: string) {
    try {
      const absolutePath = path.resolve(filePath);

      // Timer'ı iptal et
      if (this.lockedFiles.has(absolutePath)) {
        clearTimeout(this.lockedFiles.get(absolutePath)!);
        this.lockedFiles.delete(absolutePath);
      }

      // Dosyayı yazılabilir yap
      fs.chmodSync(absolutePath, 0o666);
      vscode.window.showInformationMessage(`🔓 Unlocked: ${path.basename(filePath)}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to unlock file: ${error}`);
    }
  }

  // Eklenti kapatılırken çalıştırılacak
  unlockAllFiles() {
    for (const [filePath, timer] of this.lockedFiles.entries()) {
      clearTimeout(timer);
      try {
        fs.chmodSync(filePath, 0o666);
      } catch (error) {
        console.error(`Failed to unlock ${filePath}:`, error);
      }
    }
    this.lockedFiles.clear();
  }

  dispose() {
    this.unlockAllFiles();
  }
}
```

### 2. File Lock Handler

Dosya: `src/lock/LockMonitor.ts`

WebSocket'ten sinyalleri dinleyip FileLockManager'ı çağıracak.

```typescript
import * as vscode from 'vscode';
import { FileLockManager } from './FileLockManager';

export class LockMonitor {
  constructor(
    private lockManager: FileLockManager,
    private serverUrl: string
  ) {}

  setupWebSocketListener(ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'file_lock') {
          this.handleFileLockSignal(message);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
  }

  private handleFileLockSignal(message: {
    type: string;
    filePath: string;
    clientId: string;
    action: 'write_start' | 'write_end';
  }) {
    const { filePath, action, clientId } = message;

    // Kendi sinyal ise ignore et
    const currentClientId = this.getClientId();
    if (clientId === currentClientId) {
      return;
    }

    if (action === 'write_start') {
      this.lockManager.lockFile(filePath);
    } else if (action === 'write_end') {
      this.lockManager.unlockFile(filePath);
    }
  }

  private getClientId(): string {
    // Unique client ID (hostname + random)
    const os = require('os');
    return `${os.hostname()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  dispose() {
    this.lockManager.dispose();
  }
}
```

### 3. WebSocket İçine Entegrasyon

Dosya: `src/websocket.ts` (Var olan dosyada güncelleme)

```typescript
import { WebSocket } from 'ws';

let ws: WebSocket;

export function connectToServer(
  serverUrl: string,
  onConnected: () => void,
  onDisconnected: () => void
) {
  try {
    ws = new WebSocket(serverUrl);

    ws.onopen = () => {
      vscode.window.showInformationMessage('Connected to AgentSync');
      onConnected();
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Dosya kilidi sinyalini ele al
      if (message.type === 'file_lock') {
        handleFileLockSignal(message);
      }
    };

    ws.onerror = (error) => {
      vscode.window.showErrorMessage(`WebSocket Error: ${error}`);
    };

    ws.onclose = () => {
      vscode.window.showWarningMessage('Disconnected from AgentSync');
      onDisconnected();
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Connection failed: ${error}`);
  }
}

function handleFileLockSignal(message: any) {
  // LockMonitor'e yönlendir
}

export function sendFileLockSignal(filePath: string, action: 'write_start' | 'write_end') {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'file_lock',
      filePath,
      clientId: getClientId(),
      action
    }));
  }
}
```

### 4. Editor Değişikliklerini Monitörleme

`src/sync/SyncEngine.ts` içinde dosya yazma sinyali gönderme:

```typescript
import { sendFileLockSignal } from '../websocket';

export class SyncEngine {
  private writeStartTimer: NodeJS.Timeout | null = null;
  private writeDebounceMs = 1000;

  private setupEditorChangeListener() {
    vscode.workspace.onDidChangeTextDocument((event) => {
      const { document } = event;

      // Yazma başladığını sinyal et
      if (this.writeStartTimer === null) {
        sendFileLockSignal(document.uri.fsPath, 'write_start');
      }

      // Debounce: yazma bittiğini sinyal etmek için timer reset et
      if (this.writeStartTimer) {
        clearTimeout(this.writeStartTimer);
      }

      this.writeStartTimer = setTimeout(() => {
        sendFileLockSignal(document.uri.fsPath, 'write_end');
        this.writeStartTimer = null;
      }, this.writeDebounceMs);

      // ... metni Yjs'e gönder
    });
  }

  dispose() {
    if (this.writeStartTimer) {
      clearTimeout(this.writeStartTimer);
    }
  }
}
```

### 5. Extension.ts'de Entegrasyon

```typescript
import { FileLockManager } from './lock/FileLockManager';
import { LockMonitor } from './lock/LockMonitor';

let lockManager: FileLockManager;
let lockMonitor: LockMonitor;

export function activate(context: vscode.ExtensionContext) {
  lockManager = new FileLockManager();
  lockMonitor = new LockMonitor(lockManager, 'ws://localhost:1234');

  connectToServer('ws://localhost:1234', () => {
    lockMonitor.setupWebSocketListener(ws);
  });

  context.subscriptions.push({
    dispose: deactivate
  });
}

export function deactivate() {
  lockManager?.dispose();
  lockMonitor?.dispose();
  vscode.window.showInformationMessage('AgentSync: All file locks released');
}
```

---

## 📊 Dosya Kilidi Durumu Makinesi

```
┌────────────────────────────┐
│   READY (0o666)            │
│   Dosya yazılabilir        │
└──────────┬─────────────────┘
           │
      A ajandı yazmaya başladı
      (A yazma sinyali gönderir)
           │
           ▼
┌────────────────────────────┐
│   B's perspective:         │
│   Receive "write_start"    │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│   LOCKED (0o444)           │
│   Salt Okunur              │
│   Timer: 500ms debounce    │
└──────────┬─────────────────┘
           │
      A yazma bitirdi
      (A yazma sonu sinyali)
           │
           ▼
┌────────────────────────────┐
│   Receive "write_end"      │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│   UNLOCKED (0o666)         │
│   Dosya yazılabilir        │
│   Timer temizlendi         │
└────────────────────────────┘
```

---

## 🧪 Test Planı

### Senaryo 1: Basit Kilit Testi

```bash
# Terminal 1: Sunucu
npm start

# Terminal 2: VS Code Instance A
code --extensionDevelopmentPath=$(pwd)

# A'da bir dosya aç
# Dosyayı yaz (metin ekle)
# Beklenen: WebSocket'ten "write_start" sinyali gönderilecek
```

### Senaryo 2: İki Editor Kilit Testi

```
Terminal 1: Sunucu
Terminal 2: VS Code Instance A
Terminal 3: VS Code Instance B

1. A: src/main.ts dosyasını aç
2. A: Metin yaz
3. B: src/main.ts dosyasını aç
4. B: Metin yazmaya deneme
   ✓ B'nin dosyası salt okunur olmalı
   ✓ B'nin yazma denemesi EACCES hatası vermeli
5. A: Yazma bitirdi (Ctrl+S)
6. B: Artık yazabilmelidir
```

### Senaryo 3: Debounce Testi

```
1. A: Hızlı hızlı metin yaz (5 karakter 1 saniyede)
2. Beklenen: Timer reset olacak, yazma sonu
   sinyal 1 saniye yazma bittikten SONRA gönderilecek
3. Küçük yazmaların çok sık sinyal göndermesini engelleyecek
```

### Senaryo 4: Deactivation Güvenlik Ağı

```
1. A: Dosya kilitli durumda
2. A: Extension'ı kapat (Cmd+Shift+P → Disable)
3. Beklenen: 
   ✓ Otomatik olarak file unlock() çalışır
   ✓ Dosya 0o666 hale dönüyor
   ✓ Başka programlar dosyayı kullanabilir
```

---

## 📁 Dosya Yapısı (Faz 4 Sonunda)

```
agent-sync/
├── src/
│   ├── extension.ts
│   ├── websocket.ts          # Güncellenmiş
│   ├── sync/
│   │   ├── YjsManager.ts
│   │   └── SyncEngine.ts     # Güncellenmiş
│   └── lock/
│       ├── FileLockManager.ts      # ← YENİ
│       └── LockMonitor.ts          # ← YENİ
├── package.json
└── tsconfig.json
```

---

## 🔍 Hata Ayıklama

| Problem | Çözüm |
|---------|-------|
| Dosya kilitlenmiyor | `fs.chmodSync()` izni kontrol et, sudo gerekebilir |
| EACCES hatası çıkmıyor | Dosya izinlerini kontrol et (`ls -l`) |
| Timer çalışmıyor | Debounce timeout değerini artır |
| Deactivation temizlemesi çalışmıyor | `unlockAllFiles()` çağrıldığını kontrol et |

---

## ⚡ WebSocket Mesaj Formatı

### A Yazma Başlatıyor

```json
{
  "type": "file_lock",
  "filePath": "/Users/user/project/src/main.ts",
  "clientId": "mycomputer-abc1234",
  "action": "write_start"
}
```

### A Yazma Bitiriyor

```json
{
  "type": "file_lock",
  "filePath": "/Users/user/project/src/main.ts",
  "clientId": "mycomputer-abc1234",
  "action": "write_end"
}
```

---

## ✨ Faz 4 Tamamlandığında

Şunlar olmalı:
1. ✅ İki editor arasında yazma çakışması yok
2. ✅ Dosya yazılırken başka editor'da salt okunur
3. ✅ Yazma bitince dosya tekrar yazılabilir
4. ✅ Eklenti kapatılırken tüm kilitler açılıyor
5. ✅ Debounce mekanizması çalışıyor
6. ✅ Hiçbir kalıntı kilit kalmıyor

---

## 📌 Sonraki Adımlar

Faz 5'de, kullanıcı arayüzü geliştireceğiz:
- Status Bar'da durumu gösteren ikon
- "AgentSync: Online" / "AgentSync: [File] Locked" mesajları
- Bağlantı durumu göstergesi

---

**Status**: ⏳ Beklemede  
**Başlangıç**: -  
**Bitiş**: -  
**Not**: Faz 3 tamamlandığında Faz 4'ye başlanacak

