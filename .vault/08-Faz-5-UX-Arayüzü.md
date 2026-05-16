# 🎨 Faz 5: UX ve Arayüz

## 🎯 Faz Hedefi

VS Code Status Bar'a sistemin durumunu gösteren bir ikon ve bilgi mesajı eklemek. Kullanıcıya "Online/Offline/Locked" durumunu görünür kılmak.

**Çıktı**: 
- Status Bar'da "🟢 AgentSync: Online" gösteriliyor
- Dosya kilitliyken "🔒 [main.ts] Locked" gösteriliyor
- Bağlantı koptuğunda "🔴 AgentSync: Offline" gösteriliyor
- Tıklanınca bağlantı durumu açılabiliyor (opsiyonel)

---

## ✅ Başarı Kriterleri

- [ ] Status Bar item oluşturuldu
- [ ] Bağlantı durumu "Online/Offline" gösteriliyor
- [ ] Kilitli dosya adı gösteriliyor
- [ ] Ikon renkleri değişiyor (🟢 online, 🔴 offline, 🔒 locked)
- [ ] Gerçek zamanlı güncelleniyor
- [ ] Tüm VS Code temalarında uyumlu
- [ ] Bilgi mesajları açık ve anlaşılır
- [ ] Teknik olmayan kullanıcılara anlaşılır

---

## 📋 Yapılacak Adımlar

### 1. Status Bar Manager Oluşturma

Dosya: `src/ui/StatusBarManager.ts`

```typescript
import * as vscode from 'vscode';

export class StatusBarManager {
  private statusBar: vscode.StatusBarItem;

  constructor() {
    this.statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBar.show();
  }

  setOnline() {
    this.statusBar.text = '🟢 AgentSync: Online';
    this.statusBar.tooltip = 'AgentSync connected and ready';
    this.statusBar.color = new vscode.ThemeColor('statusBar.foreground');
  }

  setOffline() {
    this.statusBar.text = '🔴 AgentSync: Offline';
    this.statusBar.tooltip = 'AgentSync disconnected - reconnecting...';
    this.statusBar.color = new vscode.ThemeColor('errorForeground');
  }

  setLocked(fileName: string) {
    this.statusBar.text = `🔒 ${fileName} Locked`;
    this.statusBar.tooltip = `File "${fileName}" is being edited by another developer`;
    this.statusBar.color = new vscode.ThemeColor('warningForeground');
  }

  setReady(fileName?: string) {
    if (fileName) {
      this.statusBar.text = `🟢 ${fileName}`;
      this.statusBar.tooltip = 'File is ready to edit';
    } else {
      this.statusBar.text = '🟢 AgentSync: Ready';
      this.statusBar.tooltip = 'All files ready to edit';
    }
    this.statusBar.color = new vscode.ThemeColor('statusBar.foreground');
  }

  // Tıklanınca bilgi göster
  setCommand(command: string) {
    this.statusBar.command = command;
  }

  dispose() {
    this.statusBar.dispose();
  }
}
```

### 2. UI Event Handler

Dosya: `src/ui/UIController.ts`

```typescript
import * as vscode from 'vscode';
import { StatusBarManager } from './StatusBarManager';

export class UIController {
  constructor(private statusBar: StatusBarManager) {}

  setupCommands(context: vscode.ExtensionContext) {
    // Status bar tıklaması
    const cmd = vscode.commands.registerCommand(
      'agentsync.showStatus',
      () => this.showStatusInfo()
    );
    context.subscriptions.push(cmd);

    this.statusBar.setCommand('agentsync.showStatus');
  }

  private showStatusInfo() {
    const info = `
AgentSync Status
================
🟢 Connected
📡 Syncing in real-time
🔒 OS-level file locking active
    `;
    vscode.window.showInformationMessage(info);
  }

  onConnected() {
    this.statusBar.setOnline();
  }

  onDisconnected() {
    this.statusBar.setOffline();
  }

  onFileLocked(fileName: string) {
    this.statusBar.setLocked(fileName);
  }

  onFileUnlocked(fileName: string) {
    this.statusBar.setReady(fileName);
  }

  dispose() {
    this.statusBar.dispose();
  }
}
```

### 3. Extension.ts İçine Entegrasyon

```typescript
import { StatusBarManager } from './ui/StatusBarManager';
import { UIController } from './ui/UIController';

let uiController: UIController;

export function activate(context: vscode.ExtensionContext) {
  const statusBar = new StatusBarManager();
  uiController = new UIController(statusBar);

  uiController.setupCommands(context);

  // WebSocket bağlantısı
  connectToServer(
    'ws://localhost:1234',
    () => {
      uiController.onConnected();
      outputChannel.appendLine('Connected to AgentSync server');
    },
    () => {
      uiController.onDisconnected();
      outputChannel.appendLine('Disconnected from AgentSync server');
    }
  );

  // Dosya kilit durumlarını takip et
  setupLockStatusTracking(uiController);

  context.subscriptions.push({
    dispose: deactivate
  });
}

export function deactivate() {
  uiController?.dispose();
}

function setupLockStatusTracking(uiController: UIController) {
  // FileLockManager'dan events dinle
  lockManager.on('locked', (fileName: string) => {
    uiController.onFileLocked(fileName);
  });

  lockManager.on('unlocked', (fileName: string) => {
    uiController.onFileUnlocked(fileName);
  });
}
```

### 4. Package.json Güncellemeleri

Yeni komutlar eklenmesi gerekiyor:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "agentsync.showStatus",
        "title": "AgentSync: Show Status"
      },
      {
        "command": "agentsync.forceUnlock",
        "title": "AgentSync: Tüm Kilitleri Aç"
      },
      {
        "command": "agentsync.setWalletKey",
        "title": "AgentSync: Cüzdan Anahtarı Ayarla"
      }
    ],
    "statusBar": []
  }
}
```

---

## 🎨 Status Bar İkonları ve Renkleri

### İkon Seçenekleri

| Durum | İkon | Anlam |
|-------|------|-------|
| Online | 🟢 | Bağlantılı ve hazır |
| Offline | 🔴 | Bağlantısı kesilmiş |
| Locked | 🔒 | Dosya başka birisi yazıyor |
| Syncing | ⚡ | Senkronizasyon devam ediyor |
| Error | ⚠️ | Hata oluştu |

### Renk Teması

```typescript
// VS Code tema renklerini kullan
'statusBar.foreground'        // Varsayılan metin rengi
'errorForeground'             // Hata rengi (kırmızı)
'warningForeground'           // Uyarı rengi (sarı)
'statusBar.background'        // Arka plan
```

---

## 📊 Status Bar UI Akışı

```
┌─────────────────────────────────────────────────────┐
│  VS Code Status Bar                                 │
├──────────────────────────────────────────┬──────────┤
│                                          │ 🟢 Online │
│                                          └──────────┘
└─────────────────────────────────────────────────────┘
        │
        │ (Tıkla)
        ▼
┌──────────────────────────────┐
│  AgentSync Status            │
│  ==================          │
│  🟢 Connected                │
│  📡 Syncing in real-time     │
│  🔒 File locking active      │
│                              │
│  [OK]                        │
└──────────────────────────────┘
```

---

## 🎯 User Experience İyileştirmeleri

### 1. Bilgi Mesajları

```typescript
// Bağlandığında
vscode.window.showInformationMessage(
  '✅ AgentSync connected! Ready for multiplayer editing'
);

// Dosya kilitlendiğinde
vscode.window.showWarningMessage(
  `🔒 ${fileName} is being edited by another developer`
);

// Bağlantı kesildiğinde
vscode.window.showErrorMessage(
  '❌ AgentSync connection lost. Attempting reconnect...'
);
```

### 2. Hover Tooltip'leri

Status bar'a hover ettiğinde detaylı bilgi:

```typescript
this.statusBar.tooltip = 
  'AgentSync: Connected to server\n' +
  'Files: 3 open, 0 locked\n' +
  'Latency: 42ms';
```

### 3. Quick Status Paneli

```
┌─────────────────────────────────┐
│ AgentSync Quick Info (Cmd+Shift+A) │
├─────────────────────────────────┤
│ Status: 🟢 Online               │
│ Server: ws://localhost:1234     │
│ Clients: 2 connected            │
│ Synced Files: 5                 │
│ Locked: src/main.ts             │
│ Latency: 23ms                   │
└─────────────────────────────────┘
```

---

## 🧪 Test Planı

### Senaryo 1: Status Bar Gösteriliyor

```
1. Extension aktif
2. Status Bar'da "🟢 AgentSync: Online" görünmeli
3. Tıkla → Bilgi paneli açılmalı
```

### Senaryo 2: Bağlantı Durumu

```
1. Sunucu açık → Status: 🟢 Online
2. Sunucu kapat → Status: 🔴 Offline (1-2 saniye)
3. Sunucu aç → Status: 🟢 Online
```

### Senaryo 3: Dosya Kilit Gösterimi

```
1. A editörü: src/main.ts yazmaya başla
2. B editörü Status Bar'da: "🔒 main.ts Locked"
3. A editörü: Yazma bitir
4. B editörü Status Bar'da: "🟢 AgentSync: Online"
```

### Senaryo 4: Tema Uyumluluğu

```
1. VS Code temasını değiştir (Light, Dark, High Contrast)
2. Status Bar renkleri her temada uyumlu olmalı
```

---

## 📁 Dosya Yapısı (Faz 5 Sonunda)

```
agent-sync/
├── src/
│   ├── extension.ts
│   ├── websocket.ts
│   ├── sync/
│   │   ├── YjsManager.ts
│   │   └── SyncEngine.ts
│   ├── lock/
│   │   ├── FileLockManager.ts
│   │   └── LockMonitor.ts
│   └── ui/
│       ├── StatusBarManager.ts     # ← YENİ
│       └── UIController.ts         # ← YENİ
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📋 Package.json Örneği

```json
{
  "name": "agent-sync",
  "version": "0.1.0",
  "description": "Multiplayer AI agent code sync for VS Code",
  "activationEvents": ["*"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "agentsync.showStatus",
        "title": "AgentSync: Show Status",
        "icon": "$(sync)"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "npm run compile && node ./out/test/runTest.js"
  },
  "dependencies": {
    "yjs": "^13.5.0",
    "y-websocket": "^1.4.0"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "@types/vscode": "^1.70.0",
    "typescript": "^4.7.0"
  }
}
```

---

## 🎯 İsteğe Bağlı Özellikler (Sonrası)

Eğer zaman kalırsa:
- [ ] Bağlantı geçmişi göster (geçmiş 10 bağlantı)
- [ ] Açılır menü (dropdown) eklentinin ayarlarına
- [ ] Notification center entegrasyonu
- [ ] Keyboard shortcut (`Ctrl+Shift+A` gibi)
- [ ] WebView tabında detaylı dashboard

---

## ✨ Faz 5 Tamamlandığında

Şunlar olmalı:
1. ✅ Status Bar'da AgentSync durumu gösteriliyor
2. ✅ Bağlantı durumu gerçek zamanlı güncelleniyor
3. ✅ Dosya kilit durumu görünüyor
4. ✅ Tıklanınca bilgi paneli açılıyor
5. ✅ Tüm temalarda uyumlu
6. ✅ Mesajlar açık ve anlaşılır

---

## 🎉 PROJE TAMAMLANDI!

Tüm 5 faz bittiğinde:
- ✅ WebSocket sunucusu çalışıyor
- ✅ VS Code eklentisi metin senkronizasyonu yapıyor
- ✅ OS-level dosya kilitleri çalışıyor
- ✅ UI göstergeler eklenmiş
- ✅ Tam multiplayer AI agent senkronizasyonu!

---

**Status**: ⏳ Beklemede  
**Başlangıç**: -  
**Bitiş**: -  
**Not**: Faz 4 tamamlandığında Faz 5'ye başlanacak

