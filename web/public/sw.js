// Service worker mínimo: existe porque o navegador só oferece "Instalar" para sites que têm um.
// De propósito não guarda nada em cache — assim uma versão nova do Syden nunca fica presa no PC de ninguém.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
