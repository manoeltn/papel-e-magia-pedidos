// Guarda os arquivos do app no aparelho para abrir rápido.
// Os pedidos NÃO ficam aqui: eles vêm sempre do Supabase, depois do login.
const VERSAO = "pm-pedidos-v1";
const ARQUIVOS = ["./", "index.html", "config.js", "nuvem.js", "vendor/supabase.js", "manifest.webmanifest",
  "icons/favicon.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Arquivos do próprio app: busca a versão nova na internet e, sem internet, usa a guardada.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
