import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(fs.readFileSync(new URL('./manifest.webmanifest', import.meta.url)));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, './');
for (const icon of manifest.icons) assert.ok(fs.existsSync(new URL(icon.src, import.meta.url)));
for (const page of ['index.html', 'business.html', 'install.html']) {
  const html = fs.readFileSync(new URL(page, import.meta.url), 'utf8');
  assert.ok(html.includes('rel="manifest"'));
  assert.ok(html.includes('pwa.js?v=1'));
}

const handlers = {};
let networkFails = false;
const writes = [];
const deleted = [];
const offline = new Response('offline');
const workerContext = {
  URL, Response,
  self: { location: { href: 'https://aivora.tr/service-worker.js' }, addEventListener: (name, fn) => handlers[name] = fn },
  fetch: async () => { if (networkFails) throw Error('offline'); return new Response('network'); },
  caches: {
    open: async () => ({ addAll: async assets => writes.push(...assets) }),
    match: async url => url.endsWith('/offline.html') ? offline.clone() : undefined,
    keys: async () => ['aivora-offline-v0', 'aivora-offline-v1', 'unrelated-cache'],
    delete: async key => deleted.push(key)
  }
};
vm.runInNewContext(fs.readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8'), workerContext);
await new Promise((resolve, reject) => handlers.install({ waitUntil: p => p.then(resolve, reject) }));
assert.equal(writes.length, 4);
assert.ok(writes.every(url => /\/(offline\.html|app-icon-(192|512)\.png|apple-touch-icon\.png)$/.test(url)));
await new Promise((resolve, reject) => handlers.activate({ waitUntil: p => p.then(resolve, reject) }));
assert.deepEqual(deleted, ['aivora-offline-v0']);
async function request(url, mode = 'cors', method = 'GET') {
  let result;
  handlers.fetch({ request: { url, mode, method }, respondWith: promise => { result = promise; } });
  return result === undefined ? null : (await result).text();
}
assert.equal(await request('https://aivora.tr/', 'navigate'), 'network');
networkFails = true;
assert.equal(await request('https://aivora.tr/?code=oauth-code', 'navigate'), 'offline');
assert.equal(await request('https://pdvovstitmkjkmgqfjwi.supabase.co/auth/v1/user'), null);
assert.equal(await request('https://aivora.tr/chat.js'), null);
assert.equal(await request('https://aivora.tr/api/messages', 'cors', 'POST'), null);
assert.equal(await request('https://aivora.tr/app-icon-192.png?token=private'), null);

const events = {};
let promptCount = 0;
const button = { hidden: false, disabled: false, addEventListener: (name, fn) => button[name] = fn };
const media = { matches: false, addEventListener() {} };
vm.runInNewContext(fs.readFileSync(new URL('./pwa.js', import.meta.url), 'utf8'), {
  window: { matchMedia: () => media, addEventListener: (name, fn) => events[name] = fn, isSecureContext: false },
  navigator: {}, document: { querySelectorAll: () => [button], querySelector: () => null }
});
events.beforeinstallprompt({ preventDefault() {}, prompt: async () => { promptCount++; events.appinstalled(); }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
await button.click();
assert.equal(promptCount, 1);
assert.equal(button.hidden, true);
await button.click();
assert.equal(promptCount, 1);
console.log('PASS: manifest/assets, install hooks, installed state, offline fallback, cache upgrades and private/API/auth cache exclusion');
