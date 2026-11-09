'use strict';
// Login requests only identity scopes. Gmail consent remains a separate action.
window.aivoraGoogleAuth = {
  async signIn(client, baseUrl, publishableKey, beforeRedirect = () => {}) {
    if (!client) throw Error('Bağlantı kurulamadı. Sayfayı yenile.');
    const response = await fetch(baseUrl + '/auth/v1/settings', {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw Error('Google giriş ayarları kontrol edilemedi. Tekrar dene.');
    const settings = await response.json();
    if (!settings.external?.google) {
      throw Error('Google ile giriş henüz etkinleştirilmedi. Şimdilik e-posta ile giriş yapabilirsin.');
    }
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: location.origin + location.pathname,
        scopes: 'openid email profile',
        queryParams: { prompt: 'select_account' },
        skipBrowserRedirect: true
      }
    });
    if (error) throw error;
    const target = new URL(data?.url);
    if (target.origin !== new URL(baseUrl).origin || target.pathname !== '/auth/v1/authorize') {
      throw Error('Google giriş bağlantısı oluşturulamadı. Tekrar dene.');
    }
    beforeRedirect();
    location.assign(target.href);
  },
  callbackError() {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.slice(1));
    const error = query.get('error') || hash.get('error');
    const code = query.get('error_code') || hash.get('error_code');
    if (!error && !code) return '';
    // Never reflect provider error descriptions or tokens into the page.
    for (const key of ['error', 'error_code', 'error_description']) query.delete(key);
    const suffix = query.toString();
    history.replaceState(null, '', location.pathname + (suffix ? '?' + suffix : ''));
    return error === 'access_denied'
      ? 'Google ile giriş iptal edildi veya izin verilmedi. Yeniden deneyebilirsin.'
      : 'Google ile giriş tamamlanamadı. Yeniden dene veya e-posta ile giriş yap.';
  }
};
