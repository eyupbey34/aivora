# Aivora — AI Business Platform

Aivora'nın mobil uyumlu ilk web arayüzü. Bu paket, telefondan GitHub'a yüklenip GitHub Pages ile yayınlanabilecek statik bir prototiptir.

## Dosyalar
- `index.html` — sayfa yapısı
- `styles.css` — koyu premium, mobil uyumlu tasarım
- `app.js` — menüler, demo asistan oluşturma ve demo bakiye etkileşimleri

## Telefonda GitHub'a yükleme
1. GitHub uygulamasını veya Chrome'da https://github.com adresini aç.
2. **New repository** ile `aivora` adında bir repository oluştur. Public seçebilirsin.
3. Repository içinde **Add file → Upload files** seç.
4. ZIP'i önce telefonda çıkar. İçindeki `index.html`, `styles.css`, `app.js` ve `README.md` dosyalarını yükle. Dosyalar repository'nin kök dizininde olmalı.
5. **Commit changes** ile kaydet.
6. Repository'de **Settings → Pages** aç.
7. **Deploy from a branch** seç; branch `main`, folder `/(root)` olsun ve kaydet.
8. GitHub Pages birkaç dakika içinde bir yayın adresi oluşturur.

## Önemli
Bu sürüm bir arayüz prototipidir. Veriler aynı tarayıcıdaki `localStorage` alanında tutulur. Gerçek kullanıcı hesabı, güvenli veritabanı, AI API, telefon/SIP, WhatsApp Business ve ödeme altyapısı henüz eklenmemiştir. API anahtarlarını tarayıcı koduna koymayın. Gerçek servisler için sunucu tarafı backend ve güvenlik yapılandırması gerekir.
