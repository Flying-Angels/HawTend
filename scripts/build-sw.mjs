import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const assets = (await readdir('dist/assets')).map(name => `/assets/${name}`)
const version = createHash('sha256').update(await readFile('dist/index.html')).digest('hex').slice(0, 12)
const files = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', ...assets]
await writeFile('dist/sw.js', `
const CACHE = 'shiguang-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('shiguang-') && key !== CACHE).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html', { ignoreVary: true })));
  } else if (url.pathname.startsWith('/assets/') || FILES.includes(url.pathname)) {
    // 仅限同源构建静态资源；避免预览服务器的 Vary: Origin 使模块请求错过预缓存。
    event.respondWith(caches.match(event.request, { ignoreVary: true }).then(hit => hit || fetch(event.request)));
  }
});
`)
console.log('Offline app shell generated:', version)
