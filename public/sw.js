// Minimal service worker for PWA install support.
// Does NOT cache any data or API responses.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', () => {
  // No caching — all requests go to the network.
});
