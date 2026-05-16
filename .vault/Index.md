# 📑 AgentSync - Ana İçindekiler

## 🎯 Proje Tanıtımı

[[01-Project-Vision]] | [[02-Tech-Stack]] | [[03-Architecture]]

---

## 📋 Genel Bilgiler

### Proje Nedir?
**AgentSync**, AI ajanları (Cursor, Claude vb.) kullanan geliştiricilerin aynı projede eşzamanlı (multiplayer) çalışmasını sağlayan bir VS Code eklentisidir.

### Ana Problem
Normalde ajanlar birbirinden habersiz aynı dosyaları değiştirdiği için devasa çakışmalar (merge conflict) yaşanır.

### Çözüm
1. **WebSocket + Yjs (CRDT)** → Anlık metin senkronizasyonu
2. **OS-Level File Permissions** → Yazma çakışmalarını engelleme

---

## 🚀 5 Fazlı Geliştirme Yol Haritası

| Faz | Başlık | Durum | Dosya |
|-----|--------|-------|-------|
| 1️⃣ | İletişim Altyapısının Kurulması | ✅ Tamamlandı | [[04-Faz-1-Iletişim-Altyapısı\|Faz 1]] |
| 2️⃣ | VS Code Eklentisi İskeleti | ✅ Tamamlandı | [[05-Faz-2-VS-Code-Eklentisi\|Faz 2]] |
| 3️⃣ | Metin Senkronizasyonu (Çekirdek Motor) | ✅ Tamamlandı | [[06-Faz-3-Metin-Senkronizasyonu\|Faz 3]] |
| 4️⃣ | AI Çakışmalarını Engelleme (OS-Level Lock) | ✅ Tamamlandı | [[07-Faz-4-OS-Level-Lock\|Faz 4]] |
| 5️⃣ | Güvenlik Komutları ve Hata Telafisi | ✅ Tamamlandı | [[08-Faz-5-UX-Arayüzü\|Faz 5]] |

---

## 📚 Detaylı Sayfalar

### Mimari & Teknoloji
- [[02-Tech-Stack]] - Node.js, TypeScript, Yjs, y-websocket
- [[03-Architecture]] - Sistem tasarımı ve bileşenleri

### Faz Detayları
1. [[04-Faz-1-Iletişim-Altyapısı]] - Node.js + y-websocket sunucusu
2. [[05-Faz-2-VS-Code-Eklentisi]] - Eklenti iskeleti ve kurulum
3. [[06-Faz-3-Metin-Senkronizasyonu]] - CRDT tabanlı senkronizasyon
4. [[07-Faz-4-OS-Level-Lock]] - Dosya izinleri ve kilit mekanizması
5. [[08-Faz-5-UX-Arayüzü]] - Status bar ve kullanıcı arayüzü

---

## ⚙️ Geliştirme Kuralları

### 🔴 EN ÖNEMLİ KURAL
**Bir fazı tamamen bitirip, test edip onay almadan ASLA bir sonraki faza geçmeyeceksin!**

Her fazın sonunda: *"Faz X tamamlandı, Faz Y'ye geçmek için onaylıyor musunuz?"*

### 📋 Kod Yazarken Kural
- **Modüler ve hatasız kod**
- Adım adım inşa
- Her faz sonunda test
- Onay beklemeden ilerleme YOK

---

## 📊 Progress Tracking

- **Başlangıç**: 2026-05-16
- **Faz 1 Durumu**: ⏳ Beklemede
- **Faz 2 Durumu**: ⏳ Beklemede
- **Faz 3 Durumu**: ⏳ Beklemede
- **Faz 4 Durumu**: ⏳ Beklemede
- **Faz 5 Durumu**: ⏳ Beklemede

---

**Son Güncelleme**: 2026-05-16
