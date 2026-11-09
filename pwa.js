'use strict';
(() => {
  let pendingInstall = null;
  let installing = false;
  let installedThisSession = false;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const installed = () => installedThisSession || standalone.matches || navigator.standalone === true;
  const buttons = () => [...document.querySelectorAll('[data-install-app]')];
  const sync = () => buttons().forEach(button => { button.hidden = installed(); button.disabled = installing; });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingInstall = event;
    sync();
  });
  window.addEventListener('appinstalled', () => {
    installedThisSession = true;
    pendingInstall = null;
    document.querySelector('#aivoraInstallDialog')?.close();
    buttons().forEach(button => { button.hidden = true; });
  });
  standalone.addEventListener('change', sync);
  function instructions() {
    let dialog = document.querySelector('#aivoraInstallDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'aivoraInstallDialog';
      dialog.setAttribute('aria-labelledby', 'aivoraInstallTitle');
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      dialog.innerHTML = '<button type="button" class="aivora-install-close" aria-label="Yükleme ekranını kapat">×</button><img src="app-icon-192.png" width="64" height="64" alt=""><h2 id="aivoraInstallTitle">Aivora hep elinin altında.</h2><p>Ana ekranına yükle, Aivora’yı kendi penceresinde aç.</p><ol>' + (ios
        ? '<li>Bu sayfayı <strong>Safari</strong> ile aç.</li><li><strong>Paylaş</strong> menüsünden <strong>Ana Ekrana Ekle</strong> seçeneğine dokun.</li><li><strong>Ekle</strong> ile tamamla.</li>'
        : '<li>Bu sayfayı <strong>Chrome</strong> ile aç. Uygulama içi tarayıcıdaysan menüden <strong>Chrome’da aç</strong> seçeneğini kullan.</li><li>Chrome’un <strong>⋮</strong> menüsüne dokun.</li><li><strong>Ana ekrana ekle → Yükle</strong> veya <strong>Uygulamayı yükle</strong> seçeneğini seç.</li>')
        + '</ol><p class="aivora-install-note">Yapay zekâ yanıtları ve hesap işlemleri için internet bağlantısı gerekir.</p><button type="button" class="aivora-install-done">Tamam</button>';
      document.body.append(dialog);
      dialog.querySelector('.aivora-install-close').onclick = dialog.querySelector('.aivora-install-done').onclick = () => dialog.close();
    }
    if (!dialog.open) dialog.showModal();
  }
  async function install() {
    if (installing || installed()) return;
    if (!pendingInstall) return instructions();
    installing = true;
    sync();
    const prompt = pendingInstall;
    pendingInstall = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch { instructions(); }
    finally { installing = false; sync(); }
  }
  buttons().forEach(button => button.addEventListener('click', install));
  sync();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).catch(() => {
        // The online app continues normally when offline support is unavailable.
      });
    }, { once: true });
  }
})();
