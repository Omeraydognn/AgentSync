# 🔌 Faz 2: VS Code Eklentisi İskeleti

## 🎯 Faz Hedefi

`yo code` kullanılarak TypeScript tabanlı yeni bir VS Code eklentisi oluşturmak ve Faz 1'deki sunucuya bağlamak.

**Çıktı**: 
- VS Code eklentisi oluşturuldu
- Eklenti, VS Code açıldığı an çalışıyor (`"activationEvents": ["*"]`)
- Eklenti, Faz 1 sunucusuna WebSocket üzerinden bağlanabiliyor

---

## ✅ Başarı Kriterleri

- [ ] VS Code eklentisi iskeleti oluşturuldu
- [ ] `package.json` aktivasyon olayları ayarlandı (`"*"`)
- [ ] `yjs` ve `y-websocket` paketleri eklendi
- [ ] Extension başladığında konsola mesaj yazılıyor
- [ ] WebSocket server'a başarıyla bağlanıyor
- [ ] Bağlantı durumu konsola yazılıyor ("Connected" / "Disconnected")
- [ ] Extension deactivate edildiğinde bağlantı kapatılıyor

---

## 📋 Yapılacak Adımlar

### 1. VS Code Eklentisi İskeleti Oluşturma

```bash
# Eklenti generator'ı kur (global)
npm install -g yo generator-code

# Yeni eklenti oluştur
yo code

# Sorulara cevaplar:
# - ✔ What type of extension do you want to create? → TypeScript
# - ✔ What's the name of your extension? → AgentSync
# - ✔ What's the identifier of your extension? → agent-sync
# - ✔ What's the description? → Multiplayer AI agent code sync
# - ✔ Enable JavaScript? → No (TypeScript kullanacağız)
# - ✔ Initialize a git repository? → Yes (eğer yoksa)

# Oluşturulan klasöre gir
cd agent-sync
```

### 2. Paket Kurulumu

```bash
npm install yjs y-websocket
npm install --save-dev @types/vscode
```

### 3. Extension.ts Dosyasını Güncelleme

Ana dosya: `src/extension.ts`

Yapı:
```typescript
import * as vscode from 'vscode';
import * as Y from 'yjs';
import * as WebsocketProvider from 'y-websocket';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('AgentSync');
  outputChannel.appendLine('AgentSync activated!');

  // WebSocket bağlantısını kur
  initializeWebSocket();

  // Deactivate temizleme
  context.subscriptions.push({
    dispose: deactivate
  });
}

function initializeWebSocket() {
  // WebSocket bağlantısı kodu
}

export function deactivate() {
  outputChannel.appendLine('AgentSync deactivated');
  // Bağlantı kapat
}
```

### 4. package.json Güncelleme

```json
{
  "activationEvents": ["*"],
  "main": "./out/extension.js",
  "contributes": {},
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "lint": "eslint src",
    "pretest": "npm run compile && npm run lint",
    "test": "node ./out/test/runTest.js"
  }
}
```

---

## 🔧 WebSocket Bağlantısı Kurulum Kodu

### Dosya: `src/websocket.ts` (Yeni dosya)

```typescript
import * as vscode from 'vscode';
import * as Y from 'yjs';
import * as WebsocketProvider from 'y-websocket';

let provider: WebsocketProvider;
let ydoc: Y.Doc;

export function connectToServer(
  serverUrl: string,
  onConnected: () => void,
  onDisconnected: () => void
) {
  try {
    ydoc = new Y.Doc();
    provider = new WebsocketProvider(
      serverUrl,
      'agentsync-room',
      ydoc,
      { connect: true }
    );

    provider.on('connection-close', () => {
      vscode.window.showWarningMessage('AgentSync: Connection lost');
      onDisconnected();
    });

    provider.on('connection-error', (error) => {
      vscode.window.showErrorMessage(`AgentSync Error: ${error.message}`);
    });

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        vscode.window.showInformationMessage('AgentSync: Connected!');
        onConnected();
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to connect: ${error}`);
  }
}

export function disconnect() {
  if (provider) {
    provider.disconnect();
    ydoc.destroy();
  }
}
```

---

## 📊 Dosya Yapısı (Faz 2 Sonunda)

```
agent-sync/
├── src/
│   ├── extension.ts       # Ana eklenti dosyası
│   ├── websocket.ts       # WebSocket yönetimi
│   ├── test/
│   │   └── suite/
│   │       └── extension.test.ts
├── package.json           # Konfigürasyon
├── tsconfig.json         # TypeScript ayarları
├── .vscodeignore
├── README.md
└── out/                  # Compiled output (ts-node build'den sonra)
```

---

## 🧪 Test Planı

### Manuel Test

```bash
# Terminal 1: Faz 1 sunucusunu başlat
cd /Users/omeraydogan/AgentSync
npm start

# Terminal 2: Eklentiyi test et
cd agent-sync
npm run compile
npm run watch  # TypeScript'i izlemek için

# Terminal 3: VS Code'u debug modunda aç
code --extensionDevelopmentPath=$(pwd)

# Beklenen:
# 1. Yeni bir VS Code penceresi açılacak (Extension Host)
# 2. Output panelinde "AgentSync activated!" görülecek
# 3. Konsol'da "Connected" mesajı görülecek
```

---

## 📝 Aktivasyon Açıklaması

### `"activationEvents": ["*"]`

- **Anlamı**: Eklenti, VS Code açılır açılmaz aktive olacak
- **Avantaj**: Her zaman çalışan, bağlantı hazır
- **Dezavantaj**: Startup performance'ı etkileyebilir (ileride optimize edilebilir)

---

## 🔍 Hata Ayıklama

| Problem | Çözüm |
|---------|-------|
| "Cannot find module" | `npm install` çalıştır |
| WebSocket bağlanmıyor | Server'ın çalıştığını kontrol et (`npm start` Faz 1'de) |
| TypeScript hataları | `npm run compile` çalıştır |
| Extension yüklenmiyor | VS Code debug modunda olduğundan emin ol |

---

## 📌 Komutlar Özet

```bash
# Kurulum
npm install
npm install yjs y-websocket
npm install --save-dev @types/vscode

# Geliştirme
npm run compile
npm run watch

# Test
npm run test

# Debug (VS Code içinde)
F5 tuşu
```

---

## ✨ Faz 2 Tamamlandığında

Şunlar olmalı:
1. ✅ `agent-sync` klasörü oluşturuldu
2. ✅ TypeScript eklentisi kompil edildi
3. ✅ Faz 1 sunucusuna WebSocket ile bağlanıyor
4. ✅ Output kanalında "Connected!" mesajı görülüyor
5. ✅ VS Code debug modunda çalışıyor

---

## 📌 Sonraki Adımlar

Faz 3'de, bu WebSocket bağlantısını kullanarak:
- VS Code editöründeki metin değişikliklerini Yjs'e gönderecek
- Yjs güncellemelerini VS Code editöründe gösterecek
- Sonsuz döngü engelleyecek

---

**Status**: ⏳ Beklemede  
**Başlangıç**: -  
**Bitiş**: -  
**Not**: Faz 1 tamamlandığında Faz 2'ye başlanacak

