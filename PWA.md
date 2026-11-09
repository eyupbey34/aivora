# Installable Aivora web app

Open https://aivora.tr/install.html in Chrome on Android, then choose the install button or Chrome menu → Add to Home screen → Install. Safari on iOS uses Share → Add to Home Screen. The same account, Google OAuth flow and cloud conversations are used. This is an installable web app, not an APK or a Play Store listing. AI and account features require connectivity.

The manifest has 192/512px maskable icons, a standalone display and an in-scope business shortcut. All HTML entry points load the independent install helper. The sidebar exposes installation; unsupported/in-app browsers receive manual instructions. Installation is only prompted after a user gesture and the install control is hidden in standalone mode.

The service worker caches only the public offline page and application icons. Application HTML/JS/CSS, Supabase/API requests, private messages and OAuth responses are never cached. Navigation always uses the network and shows the offline page only on network failure. Existing account, Google login and chat code are unchanged. Update the cache version when changing the offline page or icons; other application assets remain fresh over the network.

Validation: `node pwa-tests.mjs`, JavaScript syntax checks, browser preview of the sidebar install instructions and installation landing page. Installation on a real Android device and the final Google account consent are user-device checks.
