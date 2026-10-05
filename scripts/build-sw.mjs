import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const assets = (await readdir('dist/assets')).map(name => `/assets/${name}`)
const files = ['/', '/index.html', '/manifest.webmanifest', '/hawtend-favicon-32.png', '/hawtend-apple-touch-180.png', '/hawtend-icon-192.png', '/hawtend-icon-512.png', '/hawtend-maskable-512.png', ...assets]
const hash = createHash('sha256')
for (const file of files.filter(file => file !== '/')) hash.update(file).update(await readFile(`dist${file}`))
const version = hash.digest('hex').slice(0, 12)
await writeFile('dist/sw.js', `
const CACHE = 'hawtend-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('hawtend-') || key.startsWith('shiguang-')) && key !== CACHE).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html', { ignoreVary: true })));
  } else if (url.pathname.startsWith('/assets/') || FILES.includes(url.pathname)) {
    // 仅限同源构建静态资源；避免预览服务器的 Vary: Origin 使模块请求错过预缓存。
    event.respondWith(caches.match(event.request, { ignoreVary: true, ignoreSearch: true }).then(hit => hit || fetch(event.request)));
  }
});
`)
console.log('Offline app shell generated:', version)
