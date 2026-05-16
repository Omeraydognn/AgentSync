# 🔄 Faz 3: Metin Senkronizasyonu (Çekirdek Motor)

## 🎯 Faz Hedefi

VS Code editöründeki metin değişikliklerini Yjs'e gönderip, uzak sunucudan gelen güncellemeleri editöre uygulamak. **KRİTİK**: Sonsuz döngü engelleme mekanizması kurulmalı.

**Çıktı**: 
- Eklenti, editördeki metni Yjs Y.Text objesine yazıyor
- Yjs güncellemeleri WebSocket üzerinden alıyor
- Editör otomatik olarak güncelleniyor
- Sonsuz döngü engelleniyor

---

## ✅ Başarı Kriterleri

- [ ] `vscode.workspace.onDidChangeTextDocument` dinleniyor
- [ ] Metin değişiklikleri `Y.Text.insert()` kullanılarak Yjs'e yazılıyor
- [ ] Yjs güncellemeleri `Y.Text.observe()` ile dinleniyor
- [ ] `vscode.WorkspaceEdit` kullanılarak editöre uygulanıyor
- [ ] Local/Remote bayrak sistemi çalışıyor (sonsuz döngü yok)
- [ ] İki editor arasında metin senkronizasyonu <100ms
- [ ] Tüm karakterler doğru şekilde sinkronize oluyor
- [ ] Cursor pozisyonu korunuyor (opsiyonel ama iyi)

---

## 📋 Yapılacak Adımlar

### 1. SyncEngine Oluşturma

Dosya: `src/sync/SyncEngine.ts`

Amaç: VS Code editörü ↔ Yjs Y.Text senkronizasyonunu yönetmek

```typescript
import * as vscode from 'vscode';
import * as Y from 'yjs';

export class SyncEngine {
  private isApplyingRemoteUpdate = false;

  constructor(private ydoc: Y.Doc) {}

  initialize() {
    // Y.Text observer'ını kur (Yjs → VS Code)
    this.setupYTextObserver();

    // VS Code editor değişikliklerini dinle (VS Code → Yjs)
    this.setupEditorChangeListener();
  }

  private setupYTextObserver() {
    const ytext = this.ydoc.getMap('documents').get('main') as Y.Text;

    if (ytext) {
      ytext.observe((event) => {
        if (this.isApplyingRemoteUpdate) {
          return; // Zaten uyguluyoruz, skip
        }

        // Yjs güncellemelerini VS Code'a uygula
        this.applyRemoteUpdates(event);
      });
    }
  }

  private setupEditorChangeListener() {
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.isDirty) {
        // Mark as local update
        this.isApplyingRemoteUpdate = false;

        // VS Code değişikliğini Yjs'e gönder
        this.applyLocalUpdates(event);
      }
    });
  }

  private applyLocalUpdates(event: vscode.TextDocumentChangeEvent) {
    const ytext = this.ydoc.getMap('documents').get('main') as Y.Text;

    for (const change of event.contentChanges) {
      const { range, text } = change;

      if (range) {
        // Silme
        ytext.delete(range.start.character, range.end.character - range.start.character);
      }

      // Ekleme
      if (text) {
        ytext.insert(range?.start.character ?? 0, text);
      }
    }
  }

  private applyRemoteUpdates(event: Y.YTextEvent) {
    this.isApplyingRemoteUpdate = true;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const edit = new vscode.WorkspaceEdit();
    const uri = editor.document.uri;

    // Güncellemeleri editöre uygula
    for (const delta of event.delta) {
      if ('insert' in delta) {
        // Metni ekle
        edit.insert(uri, editor.selection.active, delta.insert as string);
      } else if ('delete' in delta) {
        // Metni sil
        const pos = editor.selection.active;
        const range = new vscode.Range(pos, new vscode.Position(pos.line, pos.character + delta.delete));
        edit.delete(uri, range);
      }
    }

    vscode.workspace.applyEdit(edit);
    this.isApplyingRemoteUpdate = false;
  }

  dispose() {
    // Temizleme
  }
}
```

### 2. Y.Text Initialization

Y.Doc içinde Y.Text oluşturmalıyız.

Dosya: `src/sync/YjsManager.ts`

```typescript
import * as Y from 'yjs';

export class YjsManager {
  private ydoc: Y.Doc;

  constructor() {
    this.ydoc = new Y.Doc();
    this.initializeSharedTypes();
  }

  private initializeSharedTypes() {
    const ymap = this.ydoc.getMap('documents');
    const ytext = new Y.Text();
    ymap.set('main', ytext);
  }

  getYDoc(): Y.Doc {
    return this.ydoc;
  }

  getYText(): Y.Text {
    return this.ydoc.getMap('documents').get('main') as Y.Text;
  }
}
```

### 3. Extension.ts İçinde Entegrasyon

```typescript
import { YjsManager } from './sync/YjsManager';
import { SyncEngine } from './sync/SyncEngine';

let syncEngine: SyncEngine;

export function activate(context: vscode.ExtensionContext) {
  const yjsManager = new YjsManager();
  syncEngine = new SyncEngine(yjsManager.getYDoc());

  // WebSocket bağlantısından sonra
  connectToServer('ws://localhost:1234', () => {
    syncEngine.initialize();
    outputChannel.appendLine('SyncEngine initialized');
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => {})
  );
}

export function deactivate() {
  if (syncEngine) {
    syncEngine.dispose();
  }
}
```

---

## 🔄 Sonsuz Döngü Engelleme Mekanizması

### Problem

```
1. A editörü metin değiştirir
   ↓
2. SyncEngine algılar → Yjs'e gönder
   ↓
3. Yjs güncellemesi → Sunucu broadcast
   ↓
4. A'nın Y.Text.observe() tetiklenir
   ↓
5. Editöre uygulanır (tekrar!)
   ↓
6. onDidChangeTextDocument tetiklenir (tekrar!)
   ↓
7. → SONSUZ DÖNGÜ! 🔄💥
```

### Çözüm

**Flag Mekanizması**: `isApplyingRemoteUpdate` boolean bayrak

```typescript
class SyncEngine {
  private isApplyingRemoteUpdate = false;

  private setupYTextObserver() {
    ytext.observe((event) => {
      // Eğer zaten remote update uyguluyorsak, skip!
      if (this.isApplyingRemoteUpdate) {
        return;
      }

      // Yjs güncellemelerini VS Code'a uygula
      this.applyRemoteUpdates(event);
    });
  }

  private setupEditorChangeListener() {
    vscode.workspace.onDidChangeTextDocument((event) => {
      // Eğer remote update uygulıyorsak, VS Code → Yjs gönderme!
      if (this.isApplyingRemoteUpdate) {
        return;
      }

      // Local değişikliği Yjs'e gönder
      this.applyLocalUpdates(event);
    });
  }

  private applyRemoteUpdates(event: Y.YTextEvent) {
    this.isApplyingRemoteUpdate = true; // ← Flag ON
    
    // Editöre uygula...
    vscode.workspace.applyEdit(edit);
    
    this.isApplyingRemoteUpdate = false; // ← Flag OFF
  }
}
```

---

## 📊 Metin Senkronizasyonu Akışı

```
┌──────────────────────────────────────────────────────────────┐
│                    Local Edit                                │
│  A: "hello" → "hello world"                                  │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ onDidChangeTextDoc   │
    │ isApplyingRemoteUpdate = false
    │ → OK, send to Yjs    │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ applyLocalUpdates()  │
    │ Y.Text.insert(" world")
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ WebSocket Broadcast  │
    │ (to server)          │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Server → Client B    │
    │ Yjs update           │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ B's Y.Text.observe() │
    │ isApplyingRemoteUpdate = true
    │ → Flag ON            │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ applyRemoteUpdates() │
    │ WorkspaceEdit apply  │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ B'nin editor update  │
    │ "hello world"        │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │ onDidChangeTextDoc   │
    │ isApplyingRemoteUpdate = true
    │ → SKIP (Flag OFF)    │
    └──────────────────────┘
```

---

## 🧪 Test Planı

### Senaryo 1: Single Editor (Kendi Kendine Sync)

```typescript
// A editor'da "hello" yazı
await editor.edit(editBuilder => {
  editBuilder.insert(new vscode.Position(0, 0), "hello");
});

// Y.Text'de "hello" olmalı
const ytext = ydoc.getMap('documents').get('main') as Y.Text;
assert(ytext.toString() === 'hello');
```

### Senaryo 2: İki Editor Arasında Sync

```
Terminal 1: Sunucu
Terminal 2: VS Code Instance 1 (A)
Terminal 3: VS Code Instance 2 (B)

1. A: "hello" yaz
2. B'de otomatik "hello" görünmeli
3. B: " world" ekle
4. A'da otomatik " world" eklenmiş olmalı
5. Sonuç: Her iki editör "hello world" göstermeli
```

### Senaryo 3: Sonsuz Döngü Test

```
✓ Metin yazınca, onDidChangeTextDocument sadece bir kez tetiklenecek
✗ Sonsuz döngü YOK
✓ Hiçbir performance drop YOK
```

---

## 📁 Dosya Yapısı (Faz 3 Sonunda)

```
agent-sync/
├── src/
│   ├── extension.ts
│   ├── websocket.ts
│   ├── sync/
│   │   ├── YjsManager.ts      # ← YEDİ
│   │   └── SyncEngine.ts       # ← YEDİ
│   └── test/
├── package.json
└── tsconfig.json
```

---

## 🔍 Hata Ayıklama

| Problem | Çözüm |
|---------|-------|
| Metin senkronize olmuyor | Y.Text'in initialize edildiğini kontrol et |
| Sonsuz döngü | `isApplyingRemoteUpdate` flag'ini kontrol et |
| Performans düşüyor | Yjs event'lerini optimize et (debounce) |

---

## ✨ Faz 3 Tamamlandığında

Şunlar olmalı:
1. ✅ Eklenti iki editor'ı bağlayabiliyor
2. ✅ A'da metin yazarsa, B'de otomatik görünüyor
3. ✅ B'de metin yazarsa, A'da otomatik görünüyor
4. ✅ Sonsuz döngü yok, hiçbir performans düşüşü yok
5. ✅ Metin senkronizasyonu <100ms

---

## 📌 Sonraki Adımlar

Faz 4'de, yazma çakışmalarını engellemeye başlayacağız:
- Dosya yazma sinyallerini dinleyecek
- `fs.chmodSync()` ile dosyayı salt okunur yapacak
- Sinyal kesilince tekrar yazılabilir yapacak

---

**Status**: ⏳ Beklemede  
**Başlangıç**: -  
**Bitiş**: -  
**Not**: Faz 2 tamamlandığında Faz 3'ye başlanacak

