# 🎯 AgentSync - Proje Vizyonu

## 📖 Proje Tanımı

**AgentSync**, AI ajanları (Cursor, Claude, ChatGPT vb.) kullanan geliştiricilerin **aynı VS Code projesinde eşzamanlı (multiplayer) çalışmasını sağlayan bir VS Code eklentisidir**.

---

## 🔴 Ana Problem

Normalde, çoklu AI ajanları aynı dosyayı aynı anda düzenlerken:
- **Birbirinden habersiz** değişiklik yapıyorlar
- **Devasa merge conflict'ler** yaşanıyor
- **Kod kayıpları** meydana geliyor
- **İş verimliliği** düşüyor

### Örnek Senaryo
```
Dakika 0:    A ajanı dosyaX'i açar, B ajanı dosyaX'i açar
Dakika 1:    A ajandaki prompt: "Fonksiyon ekle"
Dakika 1:    B ajandaki prompt: "Dosya yapısını düzenle"
Dakika 2:    A dosya üzerinde yazıyor...
Dakika 2:    B dosya üzerinde yazıyor...
Sonuç:       🔥 Massive Merge Conflict! 🔥
```

---

## ✅ Çözüm: AgentSync'in Yaptığı

### 1️⃣ **Anlık Metin Senkronizasyonu**
- **WebSocket** üzerinden tüm editörleri bağla
- **Yjs (CRDT)** kullanarak milisaniyelik senkronizasyon
- Her editörde aynı kod, **her zaman senkronize**

```
A Editörü: Değişiklik → WebSocket → Yjs Server → B Editörü: Güncelle
```

### 2️⃣ **OS-Level Dosya Kilidi**
B kişisinin ajandı dosya yazarken, A kişisinin ajanında o dosya **"Salt Okunur" (Read-Only) durumuna** geçer.

```
Senaryo:
  B ajanı yazmaya başladı → "dosyaX yazılıyor" sinyali
  ↓
  A'nın işletim sistemi: fs.chmodSync(dosyaX, 0o444) [Read-Only]
  ↓
  A ajanı yazmaya kalkarsa: "EACCES: permission denied" ❌
  ↓
  B bitince sinyali → A'nın dosyası yine yazılabilir hale dönüyor
```

### 3️⃣ **Sınırlandırılmış Çakışma**
- Aynı satırda **iki ajan yazamaz**
- Aynı dosyada **yazma işlemi çakışmaz**
- Tüm senkronizasyon **otomatik ve anlık**

---

## 🎨 Kullanıcı Deneyimi

### Senaryo: İki Geliştirici, Bir Dosya

**Başlangıç:**
```
developer-a@
  Claude AI: "Fonksiyon getUserById'yi refactor et"
  
developer-b@
  Cursor AI: "Hata işlemeyi ekle"
```

**AgentSync Çalışırken:**
```
developer-a$ Kod yazıyor...
  ✅ Gerçek zamanlı senkronizasyon
  
developer-b$ Aynı dosyayı açtı
  🟡 [fileName.ts] şu anda A tarafından düzenleniyor
  🔴 Salt Okunur Mod Aktif
  
developer-a$ Bitirdi, dosya kaydedildi
  ✅ developer-b'nin dosyası tekrar yazılabilir hale geldi
  
developer-b$ Şimdi yazabilir
  ✅ A'nın tüm değişiklikleri görünüyor
  ✅ B kendi değişikliklerini yapabiliyor
```

---

## 🎯 Başarı Kriterleri

- ✅ Aynı dosyadaki yazma çakışması **yok**
- ✅ Metin senkronizasyonu **<100ms**
- ✅ Yanlış dosya kilidi (false positive) **yok**
- ✅ Güvenli deactivation (kapatılırken kilitleri açma)
- ✅ Kullanıcı dostu UX

---

## 🚀 Hedef Platform

- **IDE**: VS Code (VS Code Extension API)
- **İşletim Sistemi**: macOS, Windows, Linux (OS-level file permissions)
- **Kullanıcılar**: AI-assisted developers (Cursor, Claude kullanıcıları)

---

## 📊 Proje Özeti

| Öğe | Açıklama |
|-----|----------|
| **Adı** | AgentSync |
| **Türü** | VS Code Extension |
| **Amacı** | Multiplayer AI-agent yazma senkronizasyonu |
| **Teknoloji** | Node.js, TypeScript, Yjs, WebSocket, OS File Permissions |
| **Faz Sayısı** | 5 |
| **Tahmini Süre** | Hackathon (Sınırlı) |

---

**Vizyonu Anladınız mı? Devam edelim!** 🚀
