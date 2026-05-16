# 🟢 AgentSync 

AgentSync, Vibe Coding yapan geliştiricilerin ve otonom AI ajanlarının (Cursor, Claude vb.) aynı projede çakışmadan çalışmasını sağlayan eşzamanlı bir senkronizasyon motorudur.

## 🚀 Özellikler

* **Gerçek Zamanlı Senkronizasyon:** Yjs (CRDT) altyapısı ile sıfır gecikmeli metin aktarımı.
* **Otonom Kilit Sistemi (OS-Level Mutex):** Bir ajan dosyaya yazmaya başladığında, o dosya diğer bilgisayarlarda anında donanımsal olarak kilitlenir (`Read-Only`).
* **Çakışma Önleme:** Ajanların birbirinin kodunu ezmesini ve sonsuz döngü hatalarını engeller.

## 🛠️ Nasıl Çalışır?

Sistem tamamen arka planda çalışır. Eklentiyi kurduğunuzda sağ alt köşedeki **Status Bar** üzerinden sistemin durumunu takip edebilirsiniz:
* `🟢 AgentSync: Idle` - Dosyalar serbest, kod yazmaya uygun.
* `🔴 LOCKED: [Dosya Adı]` - Takım arkadaşınızın ajanı o an bu dosyaya yazıyor. Bekleyin.

## 🚨 Sorun Giderme

Eğer bir ağ kopması yaşanırsa ve dosyalar kilitli kalırsa, komut paletinden (`Cmd+Shift+P`) panik butonunu kullanabilirsiniz:
`> AgentSync: Force Unlock All Files`
